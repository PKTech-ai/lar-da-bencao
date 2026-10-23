import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { maskCpf } from "@/lib/cpf";
import { assertSameOrigin } from "@/lib/csrf";
import { query, transaction } from "@/lib/db";
import { AppError, AuthorizationError, errorResponse } from "@/lib/errors";
import { requireFlag } from "@/lib/feature-flags";
import { createAdminClient } from "@/lib/supabase/admin";
import { provisionWorkerAccess } from "@/lib/worker-access";
import {
  assertWorkerScope, canEditWorkerFicha, departmentsWith, fichaSchema, normalizeFicha, statusAfterEdit, todayInSaoPaulo, updateWorkerFicha, type WorkerStatus
} from "@/lib/workers";

const patchSchema = fichaSchema.extend({
  version: z.number().int().positive(),
  /** Afastar/reativar trabalhador já aprovado. */
  active: z.boolean().optional()
});

type WorkerRow = {
  id: string; full_name: string; cpf: string | null; status: WorkerStatus; version: number; functions: string[]; departments: string[];
};

async function loadWorker(id: string) {
  const result = await query(
    `select w.*, coalesce(array_agg(wd.department_key order by wd.department_key) filter (where wd.department_key is not null), '{}') as departments
       from app.workers w left join app.worker_departments wd on wd.worker_id = w.id
      where w.id = $1 group by w.id`,
    [id]
  );
  return result.rows[0] as (WorkerRow & Record<string, unknown>) | undefined;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    await requireFlag("module_workers");
    const id = z.string().uuid().parse((await context.params).id);
    const worker = await loadWorker(id);
    if (!worker) throw new AppError("Trabalhador não encontrado.", 404, "NOT_FOUND");
    const scope = await departmentsWith(actor, "read");
    if (scope && !worker.departments.some((d) => scope.includes(d))) throw new AppError("Trabalhador não encontrado.", 404, "NOT_FOUND");
    const history = await query(
      `select x.id, x.decision, x.authority, x.meeting_date, x.minute_ref, x.reason, x.departments, x.functions,
              x.decided_at, u.full_name as decided_by_name, u.role_key as decided_by_role
         from app.worker_approval_decisions x join app.users u on u.id = x.decided_by
        where x.worker_id = $1 order by x.decided_at desc`,
      [id]
    );
    return Response.json({ worker, history: history.rows }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  let actor = null;
  let createdAuthUserId: string | undefined;
  try {
    assertSameOrigin(request);
    actor = await requireActor();
    await requireFlag("module_workers");
    const id = z.string().uuid().parse((await context.params).id);
    const raw = patchSchema.parse(await request.json());
    const input = normalizeFicha(raw);
    const author = actor;
    const outcome = await transaction(async (client) => {
      const current = await client.query<WorkerRow>(
        `select w.id, w.full_name, w.status, w.version, w.functions, w.cpf,
                coalesce((select array_agg(department_key order by department_key) from app.worker_departments where worker_id = w.id), '{}') as departments
           from app.workers w where w.id=$1 for update`,
        [id]
      );
      const before = current.rows[0];
      if (!before) throw new AppError("Trabalhador não encontrado.", 404, "NOT_FOUND");
      if (before.version !== raw.version) throw new AppError("A ficha foi alterada por outra sessão. Recarregue a página.", 409, "VERSION_CONFLICT");

      if (!canEditWorkerFicha(author)) {
        if (raw.active === undefined) throw new AuthorizationError();
        await assertWorkerScope(author, "update", before.departments);
        if (before.status !== "active" && before.status !== "inactive") {
          throw new AppError("Somente trabalhador aprovado pela Diretoria pode ser ativado ou afastado.", 409, "NOT_APPROVED");
        }
        const status = raw.active ? "active" : "inactive";
        await client.query(
          "update app.workers set status=$2, updated_by=$3, updated_at=now(), version=version+1 where id=$1",
          [id, status, author.id]
        );
        await appendAudit(author, {
          category: "Edição",
          action: status === "active" ? "Trabalhador reativado" : "Trabalhador afastado",
          module: "Trabalhadores", section: "Admissões", entityType: "worker", entityId: id, details: before.full_name,
          before: { status: before.status }, after: { status }
        }, client);
        return { status, resubmitted: false };
      }

      const edit = statusAfterEdit(before.status, before, input);
      let resubmitted = edit.resubmitted;
      let status = edit.status;
      const approveOnSave = before.status === "pending" || before.status === "rejected";
      if (approveOnSave) {
        status = "active";
        resubmitted = false;
      } else if (raw.active !== undefined && !resubmitted) {
        if (before.status !== "active" && before.status !== "inactive") {
          throw new AppError("Somente trabalhador aprovado pela Diretoria pode ser ativado ou afastado.", 409, "NOT_APPROVED");
        }
        status = raw.active ? "active" : "inactive";
      }

      await updateWorkerFicha(client, id, input, { status, resubmitted, authorId: author.id });
      let accessNote = "";
      if (approveOnSave) {
        const today = todayInSaoPaulo();
        const access = await provisionWorkerAccess(
          client,
          { id, full_name: input.full_name, cpf: input.cpf, departments: input.departments },
          author.id,
          (credentials) => createAdminClient().auth.admin.createUser(credentials)
        );
        if (access.createdAuthUserId) {
          createdAuthUserId = access.createdAuthUserId;
          accessNote = ` Acesso criado. Login pelo CPF ${maskCpf(input.cpf)}. Troca de senha obrigatória no primeiro acesso.`;
        } else if (access.linkedExisting) {
          accessNote = " Ficha vinculada ao acesso que este CPF já possui. Login e perfil permanecem os mesmos.";
        }
        await client.query(
          `insert into app.worker_approval_decisions (worker_id, decision, meeting_date, minute_ref, reason, departments, functions, decided_by)
           values ($1,$2,$3::date,$4,$5,$6,$7,$8)`,
          [id, "approved", today, "", "Aprovação automática ao salvar a ficha.", input.departments, input.functions, author.id]
        );
        await client.query(
          "update app.workers set status=$2, approved_at=$3::date, updated_by=$4, updated_at=now(), version=version+1 where id=$1",
          [id, "active", today, author.id]
        );
      }
      await appendAudit(author, {
        category: "Edição",
        action: approveOnSave ? "Ficha editada e aprovada" : resubmitted ? "Ficha reenviada para análise da Diretoria" : status !== before.status ? (status === "active" ? "Trabalhador reativado" : "Trabalhador afastado") : "Atualização de ficha de trabalhador",
        module: "Trabalhadores",
        section: "Admissões",
        entityType: "worker",
        entityId: id,
        details: `${input.full_name}${accessNote}`,
        before: { status: before.status, departments: before.departments, functions: before.functions },
        after: { status, departments: input.departments, functions: input.functions }
      }, client);
      return { status, resubmitted, approved: approveOnSave, linkedExisting: approveOnSave && !createdAuthUserId && Boolean(accessNote) };
    });
    return Response.json({ result: "updated", ...outcome });
  } catch (error) {
    if (createdAuthUserId) await createAdminClient().auth.admin.deleteUser(createdAuthUserId).catch(console.error);
    if (actor) {
      await appendAudit(actor, {
        category: "Edição", action: "Falha ao atualizar trabalhador", module: "Trabalhadores", result: "failed",
        reasonCode: error instanceof AppError ? error.code : "INTERNAL_ERROR"
      }).catch(console.error);
    }
    return errorResponse(error);
  }
}

/** Exclui a ficha. O acesso ao sistema, se já existir, permanece e só perde o vínculo com ela. */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  let actor = null;
  try {
    assertSameOrigin(request);
    actor = await requireActor();
    await requireFlag("module_workers");
    if (!canEditWorkerFicha(actor)) throw new AuthorizationError();
    const id = z.string().uuid().parse((await context.params).id);
    const author = actor;
    await transaction(async (client) => {
      const current = await client.query<{ full_name: string }>("select full_name from app.workers where id=$1 for update", [id]);
      const worker = current.rows[0];
      if (!worker) throw new AppError("Trabalhador não encontrado.", 404, "NOT_FOUND");
      await client.query("select app.delete_worker_ficha($1)", [id]);
      await appendAudit(author, {
        category: "Exclusão", action: "Ficha de trabalhador excluída", module: "Trabalhadores", section: "Admissões",
        entityType: "worker", entityId: id, details: worker.full_name
      }, client);
    });
    return Response.json({ result: "deleted" });
  } catch (error) {
    const failure = error && typeof error === "object" && "code" in error && error.code === "23503"
      ? new AppError("Esta ficha está ligada a outros registros do sistema e não pode ser excluída.", 409, "WORKER_IN_USE")
      : error;
    if (actor) {
      await appendAudit(actor, {
        category: "Exclusão", action: "Falha ao excluir ficha de trabalhador", module: "Trabalhadores", result: "failed",
        reasonCode: failure instanceof AppError ? failure.code : "INTERNAL_ERROR"
      }).catch(console.error);
    }
    return errorResponse(failure);
  }
}
