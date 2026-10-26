import type { PoolClient } from "pg";
import { z } from "zod";
import type { Actor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { query, transaction } from "@/lib/db";
import { AppError, AuthorizationError } from "@/lib/errors";
import { PATRIMONY_FLAG } from "@/lib/patrimonio";
import { requireFlag } from "@/lib/feature-flags";
import { departmentsWithPermission, hasPermission } from "@/lib/permissions";
import { todayInSaoPaulo } from "@/lib/workers";

/** Ordens de Serviço: qualquer departamento abre, o Patrimônio executa e dá a posição. */
const MODULE = "Patrimônio";
const SECTION = "Ordens de Serviço";

export const OS_KINDS = ["Manutenção", "Conserto", "Instalação", "Limpeza", "Outro"] as const;
export const OS_PRIORITIES = ["Baixa", "Normal", "Urgente"] as const;
export const OS_STATUS = { open: "Aberta", in_progress: "Em andamento", done: "Concluída", rejected: "Recusada", cancelled: "Cancelada" } as const;
export type OsStatus = keyof typeof OS_STATUS;
const CLOSED: readonly OsStatus[] = ["done", "rejected", "cancelled"];

export const serviceOrderCreateSchema = z.object({
  department_key: z.string().trim().min(1, "Informe o departamento.").max(40),
  kind: z.enum(OS_KINDS, { message: "Informe o tipo de serviço." }),
  priority: z.enum(OS_PRIORITIES).optional().default("Normal"),
  title: z.string().trim().min(1, "Informe o que precisa ser feito.").max(150),
  description: z.string().trim().min(1, "Descreva o serviço.").max(2000),
  location: z.string().trim().max(200).optional().default(""),
  asset_id: z.string().uuid().optional().or(z.literal("")).default("")
});

export const serviceOrderActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), version: z.number().int().positive(), status: z.enum(["in_progress", "done", "rejected"]), note: z.string().trim().max(2000).optional().default("") }),
  z.object({ action: z.literal("note"), version: z.number().int().positive(), note: z.string().trim().min(1, "Escreva a posição.").max(2000) }),
  z.object({ action: z.literal("cancel"), version: z.number().int().positive(), note: z.string().trim().min(3, "Informe o motivo do cancelamento.").max(2000) })
]);
type ServiceOrderAction = z.infer<typeof serviceOrderActionSchema>;

/** Quem pode fazer o quê (puro, testado em unidade). */
export function validateServiceOrderAction(current: OsStatus, input: ServiceOrderAction, who: { executor: boolean; requester: boolean }) {
  if (CLOSED.includes(current)) throw new AppError("Esta OS já foi encerrada.", 409, "ALREADY_CLOSED");
  if (input.action === "status") {
    if (!who.executor) throw new AuthorizationError("Somente o Patrimônio muda a situação da OS.");
    if (input.status === current) throw new AppError("A OS já está nesta situação.");
    if (input.status !== "in_progress" && !input.note) {
      throw new AppError(input.status === "done" ? "Conte o que foi feito para concluir a OS." : "Informe o motivo da recusa.");
    }
  }
  if (input.action === "note" && !who.executor && !who.requester) throw new AuthorizationError();
  if (input.action === "cancel") {
    if (!who.requester) throw new AuthorizationError("Somente o departamento que abriu a OS pode cancelá-la.");
    if (current !== "open") throw new AppError("A OS já está com o Patrimônio. Escreva uma posição pedindo o cancelamento.", 409, "ALREADY_STARTED");
  }
  return input.action === "status" ? input.status : input.action === "cancel" ? "cancelled" : current;
}

export async function serviceOrderAccess(actor: Actor) {
  await requireFlag(PATRIMONY_FLAG);
  const [read, create, executor, patrimonyRead] = await Promise.all([
    departmentsWithPermission(actor, "read"),
    departmentsWithPermission(actor, "create"),
    hasPermission(actor, "department", "update", "patrimonio"),
    hasPermission(actor, "department", "read", "patrimonio")
  ]);
  return { read, create, executor, seesAll: patrimonyRead };
}

export async function listServiceOrders(actor: Actor, filters: { department?: string; status?: string; q?: string }) {
  const access = await serviceOrderAccess(actor);
  if (!access.seesAll && !access.read.length) throw new AuthorizationError();
  const values: unknown[] = [];
  const where: string[] = [];
  if (!access.seesAll) { values.push(access.read); where.push(`o.department_key = any($${values.length})`); }
  if (filters.department) { values.push(filters.department); where.push(`o.department_key = $${values.length}`); }
  if (filters.status === "active") where.push("o.status in ('open','in_progress')");
  else if (filters.status && filters.status in OS_STATUS) { values.push(filters.status); where.push(`o.status = $${values.length}`); }
  if (filters.q) {
    values.push(`%${filters.q.toLowerCase()}%`);
    where.push(`(lower(o.number) like $${values.length} or lower(o.title) like $${values.length} or lower(o.location) like $${values.length} or lower(coalesce(a.tombamento,'')) like $${values.length})`);
  }
  const result = await query(
    `select o.id, o.number, o.department_key, d.label as department_label, o.kind, o.priority, o.title, o.description, o.location,
            o.status, o.requested_at, ru.full_name as requested_by_name, o.updated_at, o.closed_at, o.version,
            o.asset_id, a.tombamento as asset_tombamento, a.description as asset_description,
            coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'kind', u.kind, 'status', u.status, 'note', u.note,
                                                          'created_at', u.created_at, 'created_by_name', uu.full_name) order by u.created_at)
                        from app.service_order_updates u join app.users uu on uu.id = u.created_by where u.order_id = o.id), '[]'::jsonb) as updates
       from app.service_orders o
       join app.departments d on d.key = o.department_key
       join app.users ru on ru.id = o.requested_by
       left join app.patrimony_assets a on a.id = o.asset_id
      ${where.length ? `where ${where.join(" and ")}` : ""}
      order by (o.status in ('open','in_progress')) desc, (o.priority = 'Urgente') desc, o.requested_at desc limit 500`,
    values
  );
  const departments = await query<{ key: string; label: string }>(
    "select key, label from app.departments where active and key = any($1) order by label",
    [access.create]
  );
  const assets = access.create.length
    ? (await query("select id, tombamento, description from app.patrimony_assets where archived_at is null and disposal_date is null order by tombamento")).rows
    : [];
  return {
    orders: result.rows,
    departments: departments.rows,
    assets,
    capabilities: { open: access.create.length > 0, execute: access.executor, requesterOf: access.create }
  };
}

async function nextNumber(client: PoolClient) {
  const year = todayInSaoPaulo().slice(0, 4);
  await client.query("select pg_advisory_xact_lock(hashtext('service_orders:' || $1))", [year]);
  const max = await client.query<{ n: number }>(
    "select coalesce(max(split_part(number, '-', 3)::int), 0) as n from app.service_orders where number like $1",
    [`OS-${year}-%`]
  );
  return `OS-${year}-${String(max.rows[0].n + 1).padStart(4, "0")}`;
}

export async function createServiceOrder(actor: Actor, body: unknown) {
  const input = serviceOrderCreateSchema.parse(body);
  const access = await serviceOrderAccess(actor);
  if (!access.create.includes(input.department_key)) throw new AuthorizationError("Você não pode abrir OS por este departamento.");
  return transaction(async (client) => {
    if (input.asset_id) {
      const asset = await client.query("select 1 from app.patrimony_assets where id = $1 and archived_at is null and disposal_date is null", [input.asset_id]);
      if (!asset.rowCount) throw new AppError("Este bem não está mais no patrimônio. Escolha outro ou deixe em branco.", 409, "ASSET_UNAVAILABLE");
    }
    const number = await nextNumber(client);
    const inserted = await client.query<{ id: string }>(
      `insert into app.service_orders (number, department_key, asset_id, kind, priority, title, description, location, requested_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [number, input.department_key, input.asset_id || null, input.kind, input.priority, input.title, input.description, input.location, actor.id]
    );
    const id = inserted.rows[0].id;
    await client.query("insert into app.service_order_updates (order_id, kind, status, created_by) values ($1,'created','open',$2)", [id, actor.id]);
    await appendAudit(actor, {
      category: "Inclusão", action: "Ordem de serviço aberta", module: MODULE, section: SECTION,
      entityType: "patrimonio-os", entityId: id, details: `${number} — ${input.title} · ${input.department_key}`,
      after: { number, ...input }
    }, client);
    return { id, number };
  });
}

export async function actOnServiceOrder(actor: Actor, id: string, body: unknown) {
  const input = serviceOrderActionSchema.parse(body);
  const access = await serviceOrderAccess(actor);
  return transaction(async (client) => {
    const found = await client.query<{ number: string; department_key: string; status: OsStatus; version: number }>(
      "select number, department_key, status, version from app.service_orders where id = $1 for update",
      [id]
    );
    const order = found.rows[0];
    if (!order || (!access.seesAll && !access.read.includes(order.department_key))) throw new AppError("OS não encontrada.", 404, "NOT_FOUND");
    if (order.version !== input.version) throw new AppError("Esta OS mudou enquanto você escrevia. Feche e abra de novo.", 409, "VERSION_CONFLICT");
    const next = validateServiceOrderAction(order.status, input, { executor: access.executor, requester: access.create.includes(order.department_key) });
    await client.query(
      `update app.service_orders set status = $2, updated_at = now(), version = version + 1,
              closed_at = case when $2 in ('done','rejected','cancelled') then now() else null end
        where id = $1`,
      [id, next]
    );
    await client.query(
      "insert into app.service_order_updates (order_id, kind, status, note, created_by) values ($1,$2,$3,$4,$5)",
      [id, input.action, next, input.note, actor.id]
    );
    await appendAudit(actor, {
      category: input.action === "cancel" ? "Exclusão" : "Edição",
      action: input.action === "note" ? "Posição registrada na ordem de serviço"
        : input.action === "cancel" ? "Ordem de serviço cancelada" : `Ordem de serviço: ${OS_STATUS[next]}`,
      module: MODULE, section: SECTION, entityType: "patrimonio-os", entityId: id,
      details: `${order.number}${input.note ? ` · ${input.note}` : ""}`,
      before: { status: order.status }, after: { status: next }
    }, client);
    return { status: next };
  });
}
