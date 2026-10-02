import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { query, transaction } from "@/lib/db";
import { AppError, AuthorizationError, errorResponse } from "@/lib/errors";
import { requireFlag } from "@/lib/feature-flags";
import { departmentsWith, fichaSchema, insertWorker, normalizeFicha } from "@/lib/workers";

const createSchema = fichaSchema.extend({ origin_department: z.string().regex(/^[a-z_]+$/).optional() });
const listSchema = z.object({
  status: z.enum(["pending", "active", "inactive", "rejected"]).optional(),
  department: z.string().regex(/^[a-z_]+$/).optional()
});

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    await requireFlag("module_workers");
    const scope = await departmentsWith(actor, "read");
    if (scope && !scope.length) throw new AuthorizationError();
    const params = new URL(request.url).searchParams;
    const filters = listSchema.parse({ status: params.get("status") ?? undefined, department: params.get("department") ?? undefined });
    const result = await query(
      `select w.id, w.full_name, w.email, w.phone, w.birth_date, w.status, w.functions, w.available_days,
              w.contribution_cents::text as contribution_cents, w.contribution_due_day,
              w.origin_department, w.requested_at, w.approved_at, w.version,
              coalesce(array_agg(wd.department_key order by wd.department_key) filter (where wd.department_key is not null), '{}') as departments,
              (select row_to_json(d) from (
                 select decision, meeting_date, minute_ref, decided_at, u.full_name as decided_by_name
                   from app.worker_approval_decisions x join app.users u on u.id = x.decided_by
                  where x.worker_id = w.id order by x.decided_at desc limit 1) d) as last_decision
         from app.workers w
         left join app.worker_departments wd on wd.worker_id = w.id
        where ($1::text is null or w.status = $1)
          and ($2::text[] is null or exists (select 1 from app.worker_departments s where s.worker_id = w.id and s.department_key = any($2)))
          and ($3::text is null or exists (select 1 from app.worker_departments f where f.worker_id = w.id and f.department_key = $3))
        group by w.id
        order by (w.status = 'pending') desc, w.full_name`,
      [filters.status ?? null, scope, filters.department ?? null]
    );
    return Response.json({ workers: result.rows }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Cadastro de ficha: sempre nasce pendente, aguardando a Diretoria. */
export async function POST(request: Request) {
  let actor = null;
  try {
    assertSameOrigin(request);
    actor = await requireActor();
    await requireFlag("module_workers");
    const raw = createSchema.parse(await request.json());
    const input = normalizeFicha(raw);
    const scope = await departmentsWith(actor, "create");
    const origin = raw.origin_department ?? (scope ? input.departments.find((d) => scope.includes(d)) : input.departments[0]);
    if (!origin || (scope && !scope.includes(origin))) throw new AuthorizationError();
    if (!input.departments.includes(origin)) throw new AppError("O departamento solicitante precisa estar entre os departamentos da ficha.");
    const author = actor;
    const id = await transaction(async (client) => {
      const workerId = await insertWorker(client, input, { origin, authorId: author.id });
      await appendAudit(author, {
        category: "Inclusão",
        action: "Ficha de trabalhador enviada para aprovação",
        module: "Trabalhadores",
        section: "Admissões",
        entityType: "worker",
        entityId: workerId,
        details: `${input.full_name} · solicitante: ${origin}`,
        after: { departments: input.departments, functions: input.functions, status: "pending" }
      }, client);
      return workerId;
    });
    return Response.json({ id, status: "pending" }, { status: 201 });
  } catch (error) {
    if (actor) {
      await appendAudit(actor, {
        category: "Inclusão", action: "Falha ao cadastrar trabalhador", module: "Trabalhadores", result: "failed",
        reasonCode: error instanceof AppError ? error.code : "INTERNAL_ERROR"
      }).catch(console.error);
    }
    return errorResponse(error);
  }
}
