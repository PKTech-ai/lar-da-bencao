import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { query, transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { requireFlag } from "@/lib/feature-flags";
import {
  assertWorkerScope, departmentsWith, fichaSchema, normalizeFicha, statusAfterEdit, type WorkerStatus
} from "@/lib/workers";

const patchSchema = fichaSchema.extend({
  version: z.number().int().positive(),
  /** Afastar/reativar trabalhador já aprovado. */
  active: z.boolean().optional()
});

type WorkerRow = {
  id: string; full_name: string; status: WorkerStatus; version: number; functions: string[]; departments: string[];
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
        `select w.id, w.full_name, w.status, w.version, w.functions,
                coalesce((select array_agg(department_key order by department_key) from app.worker_departments where worker_id = w.id), '{}') as departments
           from app.workers w where w.id=$1 for update`,
        [id]
      );
      const before = current.rows[0];
      if (!before) throw new AppError("Trabalhador não encontrado.", 404, "NOT_FOUND");
      await assertWorkerScope(author, "update", before.departments);
      if (before.version !== raw.version) throw new AppError("A ficha foi alterada por outra sessão. Recarregue a página.", 409, "VERSION_CONFLICT");

      const edit = statusAfterEdit(before.status, before, input);
      const resubmitted = edit.resubmitted;
      let status = edit.status;
      if (raw.active !== undefined && !resubmitted) {
        if (before.status !== "active" && before.status !== "inactive") {
          throw new AppError("Somente trabalhador aprovado pela Diretoria pode ser ativado ou afastado.", 409, "NOT_APPROVED");
        }
        status = raw.active ? "active" : "inactive";
      }

      await client.query(
        `update app.workers set full_name=$2, email=$3, phone=$4, birth_date=nullif($5,'')::date, naturality=$6,
            marital_status=$7, profession=$8, address=$9, filled_date=coalesce(nullif($10,'')::date, filled_date),
            volunteer_service=$11, accepts_volunteer_law=$12, image_authorization=$13, functions=$14, available_days=$15,
            notes=$16, status=$17,
            requested_at=case when $18 then now() else requested_at end,
            approved_at=case when $18 then null else approved_at end,
            updated_by=$19, updated_at=now(), version=version+1
          where id=$1`,
        [id, input.full_name, input.email || null, input.phone || null, input.birth_date ?? "", input.naturality || null,
          input.marital_status || null, input.profession || null, input.address || null, input.filled_date ?? "",
          input.volunteer_service, input.accepts_volunteer_law, input.image_authorization, input.functions, input.available_days,
          input.notes, status, resubmitted, author.id]
      );
      await client.query("delete from app.worker_departments where worker_id=$1", [id]);
      for (const department of input.departments) {
        await client.query("insert into app.worker_departments(worker_id, department_key) values ($1,$2)", [id, department]);
      }
      await appendAudit(author, {
        category: "Edição",
        action: resubmitted ? "Ficha reenviada para análise da Diretoria" : status !== before.status ? (status === "active" ? "Trabalhador reativado" : "Trabalhador afastado") : "Atualização de ficha de trabalhador",
        module: "Trabalhadores",
        section: "Admissões",
        entityType: "worker",
        entityId: id,
        details: input.full_name,
        before: { status: before.status, departments: before.departments, functions: before.functions },
        after: { status, departments: input.departments, functions: input.functions }
      }, client);
      return { status, resubmitted };
    });
    return Response.json({ result: "updated", ...outcome });
  } catch (error) {
    if (actor) {
      await appendAudit(actor, {
        category: "Edição", action: "Falha ao atualizar trabalhador", module: "Trabalhadores", result: "failed",
        reasonCode: error instanceof AppError ? error.code : "INTERNAL_ERROR"
      }).catch(console.error);
    }
    return errorResponse(error);
  }
}
