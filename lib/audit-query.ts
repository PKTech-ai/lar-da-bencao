import type { PoolClient } from "pg";
import { dbPool } from "@/lib/db";

export type AuditFilters = {
  search?: string;
  actor?: string;
  category?: string;
  module?: string;
  result?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
};

export async function getAuditRows(filters: AuditFilters, client: PoolClient | ReturnType<typeof dbPool> = dbPool()) {
  const values: unknown[] = [];
  const clauses: string[] = [];
  function add(value: unknown, expression: (index: number) => string) {
    values.push(value);
    clauses.push(expression(values.length));
  }
  if (filters.search) add(`%${filters.search}%`, (i) => `(actor_name_snapshot ilike $${i} or action ilike $${i} or module ilike $${i} or section ilike $${i} or details ilike $${i})`);
  if (filters.actor) add(filters.actor, (i) => `actor_user_id = $${i}::uuid`);
  if (filters.category) add(filters.category, (i) => `category = $${i}`);
  if (filters.module) add(filters.module, (i) => `module = $${i}`);
  if (filters.result) add(filters.result, (i) => `result = $${i}`);
  if (filters.from) add(filters.from, (i) => `occurred_at >= $${i}::date`);
  if (filters.to) add(filters.to, (i) => `occurred_at < ($${i}::date + interval '1 day')`);
  const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
  const count = await client.query<{ total: string }>(`select count(*)::text as total from app.audit_events ${where}`, values);
  values.push(filters.pageSize, (filters.page - 1) * filters.pageSize);
  const rows = await client.query(
    `select id, occurred_at, actor_user_id, actor_name_snapshot, role_snapshot, category,
            action, module, section, entity_type, entity_id, result, reason_code, details,
            request_id, app_version, encode(event_hash,'hex') as event_hash
       from app.audit_events
       ${where}
      order by sequence desc
      limit $${values.length - 1} offset $${values.length}`,
    values
  );
  return { rows: rows.rows, total: Number(count.rows[0]?.total ?? 0) };
}

export async function getAuditFacets() {
  const [users, modules] = await Promise.all([
    dbPool().query("select distinct actor_user_id as id, actor_name_snapshot as name from app.audit_events where actor_user_id is not null order by name"),
    dbPool().query("select distinct module from app.audit_events order by module")
  ]);
  return { users: users.rows, modules: modules.rows.map((row) => row.module) };
}
