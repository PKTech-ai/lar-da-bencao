import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { transaction } from "@/lib/db";
import { AppError, AuthorizationError, errorResponse } from "@/lib/errors";
import { requireFlag } from "@/lib/feature-flags";
import { canDecideAdmissions, decisionSchema, todayInSaoPaulo, validateDecision } from "@/lib/workers";

/** Decisão da Diretoria sobre a ficha: só Presidente e Administrador. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let actor = null;
  try {
    assertSameOrigin(request);
    actor = await requireActor();
    await requireFlag("module_workers");
    if (!(await canDecideAdmissions(actor))) throw new AuthorizationError("Somente Presidente ou Administrador registra a decisão da Diretoria.");
    const id = z.string().uuid().parse((await context.params).id);
    const input = decisionSchema.parse(await request.json());
    validateDecision(input, todayInSaoPaulo());
    const author = actor;
    const outcome = await transaction(async (client) => {
      const current = await client.query<{ full_name: string; status: string; version: number; functions: string[]; departments: string[] }>(
        `select w.full_name, w.status, w.version, w.functions,
                coalesce((select array_agg(department_key order by department_key) from app.worker_departments where worker_id = w.id), '{}') as departments
           from app.workers w where w.id=$1 for update`,
        [id]
      );
      const worker = current.rows[0];
      if (!worker) throw new AppError("Trabalhador não encontrado.", 404, "NOT_FOUND");
      if (worker.status !== "pending") throw new AppError("A ficha não está mais pendente. Atualize a lista.", 409, "NOT_PENDING");
      if (worker.version !== input.version) {
        throw new AppError("A ficha foi alterada durante a análise. Abra novamente para conferir os dados atuais.", 409, "VERSION_CONFLICT");
      }
      const approved = input.decision === "approved";
      await client.query(
        `insert into app.worker_approval_decisions (worker_id, decision, meeting_date, minute_ref, reason, departments, functions, decided_by)
         values ($1,$2,$3::date,$4,$5,$6,$7,$8)`,
        [id, input.decision, input.meeting_date, input.minute_ref, input.reason, worker.departments, worker.functions, author.id]
      );
      await client.query(
        `update app.workers set status=$2, approved_at=$3::date, updated_by=$4, updated_at=now(), version=version+1 where id=$1`,
        [id, approved ? "active" : "rejected", approved ? input.meeting_date : null, author.id]
      );
      await appendAudit(author, {
        category: "Edição",
        action: approved ? "Aprovação de trabalhador" : "Reprovação de trabalhador",
        module: "Diretoria",
        section: "Aprovação de Trabalhadores",
        entityType: "worker",
        entityId: id,
        details: `${worker.full_name}: ${approved ? "aprovado" : "reprovado"} pela Diretoria. Deliberação: ${input.meeting_date}.${input.minute_ref ? ` Ata: ${input.minute_ref}.` : ""}${input.reason ? ` ${input.reason}` : ""}`,
        before: { status: "pending" },
        after: { status: approved ? "active" : "rejected", departments: worker.departments, functions: worker.functions }
      }, client);
      return { status: approved ? "active" : "rejected", name: worker.full_name };
    });
    return Response.json(outcome);
  } catch (error) {
    if (actor) {
      await appendAudit(actor, {
        category: "Edição", action: "Falha ao registrar decisão de admissão", module: "Diretoria",
        section: "Aprovação de Trabalhadores", result: error instanceof AuthorizationError ? "denied" : "failed",
        reasonCode: error instanceof AppError ? error.code : "INTERNAL_ERROR"
      }).catch(console.error);
    }
    return errorResponse(error);
  }
}
