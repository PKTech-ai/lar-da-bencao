import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { requireFlag } from "@/lib/feature-flags";
import { assertPermission } from "@/lib/permissions";
import { fichaFromSubmission, reviewSchema, submissionPayloadSchema, type ExistingFicha } from "@/lib/worker-submissions";
import { fichaSchema, insertWorker, normalizeFicha, statusAfterEdit, updateWorkerFicha, type WorkerStatus } from "@/lib/workers";

type CurrentWorker = ExistingFicha & { id: string; status: WorkerStatus; version: number };

/**
 * Decisão do Administrador sobre um envio do cadastro online:
 * criar ficha nova (nasce pendente), atualizar uma ficha existente ou descartar.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let actor = null;
  try {
    assertSameOrigin(request);
    actor = await requireActor();
    await requireFlag("module_workers");
    await assertPermission(actor, "modules", "admin");
    const id = z.string().uuid().parse((await context.params).id);
    const review = reviewSchema.parse(await request.json());
    const admin = actor;
    const outcome = await transaction(async (client) => {
      const found = await client.query<{ status: string; payload: unknown }>(
        "select status, payload from app.worker_submissions where id=$1 for update",
        [id]
      );
      const submission = found.rows[0];
      if (!submission) throw new AppError("Envio não encontrado.", 404, "NOT_FOUND");
      if (submission.status !== "received") throw new AppError("Este envio já foi tratado por outra sessão. Recarregue a página.", 409, "ALREADY_REVIEWED");

      if (review.action === "discard") {
        await client.query(
          "update app.worker_submissions set status='discarded', review_note=$2, reviewed_by=$3, reviewed_at=now() where id=$1",
          [id, review.note, admin.id]
        );
        await appendAudit(admin, {
          category: "Exclusão", action: "Cadastro online descartado", module: "Trabalhadores", section: "Cadastros online",
          entityType: "worker_submission", entityId: id, details: review.note
        }, client);
        return { result: "discarded" as const };
      }

      const payload = submissionPayloadSchema.parse(submission.payload);
      let workerId: string;
      let status: WorkerStatus = "pending";
      let resubmitted = false;
      if (review.action === "create") {
        const input = normalizeFicha(fichaSchema.parse(fichaFromSubmission(payload)));
        const origin = review.origin_department ?? input.departments[0];
        if (!input.departments.includes(origin)) throw new AppError("O departamento solicitante precisa estar entre os departamentos da ficha.");
        workerId = await insertWorker(client, input, { origin, authorId: admin.id });
        await appendAudit(admin, {
          category: "Inclusão", action: "Ficha de trabalhador criada a partir do cadastro online", module: "Trabalhadores",
          section: "Cadastros online", entityType: "worker", entityId: workerId,
          details: `${input.full_name} · solicitante: ${origin}`,
          after: { departments: input.departments, functions: input.functions, status: "pending" },
          metadata: { submissionId: id }
        }, client);
      } else {
        const current = await client.query<CurrentWorker>(
          `select w.id, w.status, w.version, w.full_name, w.email, w.phone, w.birth_date::text as birth_date, w.naturality,
                  w.marital_status, w.profession, w.address, w.filled_date::text as filled_date, w.volunteer_service,
                  w.accepts_volunteer_law, w.image_authorization, w.functions, w.available_days, w.notes,
                  w.contribution_cents::text as contribution_cents, w.contribution_due_day,
                  coalesce((select array_agg(department_key order by department_key) from app.worker_departments where worker_id = w.id), '{}') as departments
             from app.workers w where w.id=$1 for update`,
          [review.worker_id]
        );
        const before = current.rows[0];
        if (!before) throw new AppError("Trabalhador não encontrado.", 404, "NOT_FOUND");
        if (before.version !== review.version) throw new AppError("A ficha foi alterada por outra sessão. Recarregue a página.", 409, "VERSION_CONFLICT");
        const input = normalizeFicha(fichaSchema.parse(fichaFromSubmission(payload, before)));
        ({ status, resubmitted } = statusAfterEdit(before.status, before, input));
        workerId = before.id;
        await updateWorkerFicha(client, workerId, input, { status, resubmitted, authorId: admin.id });
        await appendAudit(admin, {
          category: "Edição",
          action: resubmitted ? "Ficha atualizada pelo cadastro online e reenviada para a Diretoria" : "Ficha atualizada pelo cadastro online",
          module: "Trabalhadores", section: "Cadastros online", entityType: "worker", entityId: workerId,
          details: input.full_name,
          before: { status: before.status, departments: before.departments, functions: before.functions },
          after: { status, departments: input.departments, functions: input.functions },
          metadata: { submissionId: id }
        }, client);
      }
      await client.query(
        "update app.worker_submissions set status='applied', matched_worker_id=$2, reviewed_by=$3, reviewed_at=now() where id=$1",
        [id, workerId, admin.id]
      );
      return { result: review.action === "create" ? "created" as const : "updated" as const, worker_id: workerId, status, resubmitted };
    });
    return Response.json(outcome);
  } catch (error) {
    if (actor) {
      await appendAudit(actor, {
        category: "Edição", action: "Falha ao tratar cadastro online", module: "Trabalhadores", section: "Cadastros online",
        result: "failed", reasonCode: error instanceof AppError ? error.code : "INTERNAL_ERROR"
      }).catch(console.error);
    }
    return errorResponse(error);
  }
}
