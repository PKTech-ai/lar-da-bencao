import type { PoolClient } from "pg";
import type { Actor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { dbPool, query, transaction } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireFlag } from "@/lib/feature-flags";
import { assertPermission, hasPermission, type PermissionAction } from "@/lib/permissions";
import { RESOURCES } from "@/lib/resources/registry";
import { RULES, type RuleContext } from "@/lib/resources/rules";
import { inputSchema, selectList, toDbValue } from "@/lib/resources/schema";
import type { Field, ResourceDef } from "@/lib/resources/types";
import { todayInSaoPaulo } from "@/lib/workers";

export function resolveResource(key: string): ResourceDef {
  const def = RESOURCES[key];
  if (!def) throw new AppError("Cadastro não encontrado.", 404, "NOT_FOUND");
  return def;
}

export async function requireResource(actor: Actor, def: ResourceDef, action: PermissionAction) {
  await requireFlag(def.flag);
  await assertPermission(actor, def.scope.resource, action, def.scope.department);
}

export async function resourceCapabilities(actor: Actor, def: ResourceDef) {
  const [create, update, remove] = await Promise.all(
    (["create", "update", "delete"] as const).map((a) => hasPermission(actor, def.scope.resource, a, def.scope.department))
  );
  return { create, update, delete: remove };
}

const normalize = (v: unknown) => String(v ?? "").trim().toLocaleUpperCase("pt-BR").replace(/\s+/g, "");

async function validateReferences(client: PoolClient, def: ResourceDef, values: Record<string, unknown>, id: string | null) {
  const today = todayInSaoPaulo();
  for (const field of def.fields) {
    const value = values[field.name];
    if (value === undefined || value === null || value === "") continue;
    if (field.type === "date") {
      if (field.notFuture && String(value) > today) throw new AppError(`${field.label} não pode ser uma data futura.`);
      const other = field.notBeforeField ? values[field.notBeforeField] : null;
      if (other && String(value) < String(other)) {
        const ref = def.fields.find((f) => f.name === field.notBeforeField)?.label ?? field.notBeforeField;
        throw new AppError(`${field.label} não pode ser anterior a ${ref}.`);
      }
    }
    if (field.type === "department") {
      const found = await client.query("select 1 from app.departments where key=$1 and active", [value]);
      if (!found.rowCount) throw new AppError(`${field.label}: departamento inválido.`);
    }
    if (field.type === "worker") {
      const found = await client.query(
        `select 1 from app.workers w where w.id=$1 and w.status='active'
           ${field.department ? "and exists (select 1 from app.worker_departments d where d.worker_id=w.id and d.department_key=$2)" : ""}`,
        field.department ? [value, field.department] : [value]
      );
      if (!found.rowCount) throw new AppError(`${field.label}: trabalhador sem aprovação da Diretoria ou fora do departamento.`);
    }
    if ((field.type === "text") && field.unique) {
      const dup = await client.query(
        `select 1 from app.${def.table} where upper(regexp_replace(${field.name}, '\\s+', '', 'g')) = $1 and ($2::uuid is null or id <> $2)`,
        [normalize(value), id]
      );
      if (dup.rowCount) throw new AppError(`${field.label} já cadastrado (inclusive entre os arquivados).`, 409, "DUPLICATE");
    }
  }
}

function writableFields(def: ResourceDef) {
  return def.fields.filter((f) => !f.readOnly);
}

export async function listRecords(def: ResourceDef, params: URLSearchParams) {
  const where: string[] = [];
  const values: unknown[] = [];
  const archived = params.get("archived");
  if (archived !== "all") where.push(archived === "only" ? "r.archived_at is not null" : "r.archived_at is null");
  for (const filter of def.filters ?? []) {
    const value = params.get(filter.name);
    if (value) { values.push(value); where.push(`r.${filter.name}::text = $${values.length}`); }
  }
  const q = params.get("q")?.trim();
  if (q && def.search.length) {
    values.push(`%${q.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()}%`);
    where.push(`(${def.search.map((c) => `translate(lower(r.${c}::text), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like $${values.length}`).join(" or ")})`);
  }
  const result = await query(
    `select ${selectList(def)} from app.${def.table} r ${where.length ? `where ${where.join(" and ")}` : ""} order by ${def.orderBy} limit 1000`,
    values
  );
  return result.rows;
}

export async function getRecord(def: ResourceDef, id: string, client?: PoolClient, lock = false) {
  const executor = client ?? dbPool();
  const result = await executor.query(`select ${selectList(def)} from app.${def.table} r where r.id=$1 ${lock ? "for update" : ""}`, [id]);
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new AppError(`${def.singular} não encontrado.`, 404, "NOT_FOUND");
  return row;
}

async function runRules(def: ResourceDef, ctx: RuleContext) {
  if (def.rules) await RULES[def.rules]?.(ctx);
}

function diff(def: ResourceDef, before: Record<string, unknown> | null, after: Record<string, unknown>) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const field of def.fields) {
    const a = before?.[field.name] ?? null;
    const b = after[field.name] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(b)) changes[field.name] = { from: a, to: b };
  }
  return changes;
}

export async function createRecord(def: ResourceDef, actor: Actor, body: unknown) {
  const input = inputSchema(def).parse(body) as Record<string, unknown>;
  return transaction(async (client) => {
    await validateReferences(client, def, input, null);
    await runRules(def, { client, actor, def, input, before: null, mode: "create" });
    const fields = writableFields(def);
    const cols = fields.map((f) => f.name);
    const inserted = await client.query<{ id: string }>(
      `insert into app.${def.table} (${cols.join(", ")}, created_by, updated_by)
       values (${cols.map((_, i) => `$${i + 1}`).join(", ")}, $${cols.length + 1}, $${cols.length + 1}) returning id`,
      [...fields.map((f) => toDbValue(f, input[f.name])), actor.id]
    );
    const id = inserted.rows[0].id;
    await appendAudit(actor, {
      category: "Inclusão", action: `Cadastro: ${def.singular}`, module: def.module, section: def.section,
      entityType: def.key, entityId: id, details: summary(def, input), after: input
    }, client);
    return id;
  });
}

export async function updateRecord(def: ResourceDef, actor: Actor, id: string, body: unknown) {
  const { version, ...rest } = (body ?? {}) as { version?: unknown };
  if (typeof version !== "number") throw new AppError("Versão do registro ausente. Recarregue a página.");
  const input = inputSchema(def).parse(rest) as Record<string, unknown>;
  return transaction(async (client) => {
    const before = await getRecord(def, id, client, true);
    if (before.version !== version) throw new AppError("Registro alterado por outra sessão. Recarregue a página.", 409, "VERSION_CONFLICT");
    if (before.archived_at) throw new AppError("Registro arquivado. Restaure antes de editar.", 409, "ARCHIVED");
    await validateReferences(client, def, input, id);
    await runRules(def, { client, actor, def, input, before, mode: "update" });
    const fields = writableFields(def);
    await client.query(
      `update app.${def.table} set ${fields.map((f, i) => `${f.name} = $${i + 2}`).join(", ")},
         updated_by = $${fields.length + 2}, updated_at = now(), version = version + 1 where id = $1`,
      [id, ...fields.map((f) => toDbValue(f, input[f.name])), actor.id]
    );
    const changes = diff(def, before, { ...before, ...input });
    await appendAudit(actor, {
      category: "Edição", action: `Alteração: ${def.singular}`, module: def.module, section: def.section,
      entityType: def.key, entityId: id, details: summary(def, input),
      before: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.from])),
      after: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.to]))
    }, client);
  });
}

export async function archiveRecord(def: ResourceDef, actor: Actor, id: string, body: { version?: unknown; reason?: unknown; restore?: unknown }) {
  if (!def.archiveLabel) throw new AppError(`${def.singular}: registros não podem ser arquivados.`, 409, "ARCHIVE_NOT_ALLOWED");
  const restore = body.restore === true;
  const reason = String(body.reason ?? "").trim().slice(0, 500);
  if (!restore && reason.length < 3) throw new AppError("Informe o motivo do arquivamento.");
  return transaction(async (client) => {
    const before = await getRecord(def, id, client, true);
    if (before.version !== body.version) throw new AppError("Registro alterado por outra sessão. Recarregue a página.", 409, "VERSION_CONFLICT");
    await runRules(def, { client, actor, def, input: before, before, mode: restore ? "restore" : "archive" });
    await client.query(
      `update app.${def.table} set archived_at = ${restore ? "null" : "now()"}, archived_by = ${restore ? "null" : "$2"},
         archive_reason = $3, updated_by = $2, updated_at = now(), version = version + 1 where id = $1`,
      [id, actor.id, restore ? "" : reason]
    );
    await appendAudit(actor, {
      category: restore ? "Edição" : "Exclusão", action: `${restore ? "Restauração" : "Arquivamento"}: ${def.singular}`,
      module: def.module, section: def.section, entityType: def.key, entityId: id, details: reason || summary(def, before)
    }, client);
  });
}

export async function recordHistory(def: ResourceDef, id: string) {
  const result = await query(
    `select occurred_at, actor_name_snapshot as actor, action, result, before_json, after_json, details
       from app.audit_events where entity_type=$1 and entity_id=$2 order by sequence desc limit 200`,
    [def.key, id]
  );
  return result.rows;
}

function summary(def: ResourceDef, values: Record<string, unknown>) {
  const first = def.fields.slice(0, 2).map((f) => values[f.name]).filter((v) => v !== null && v !== undefined && v !== "");
  return first.map(String).join(" · ").slice(0, 300);
}

export type { Field };
