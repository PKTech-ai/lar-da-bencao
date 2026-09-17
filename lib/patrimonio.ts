import type { PoolClient } from "pg";
import { z } from "zod";
import type { Actor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { dbPool, query, transaction } from "@/lib/db";
import { AppError, AuthorizationError } from "@/lib/errors";
import { requireFlag } from "@/lib/feature-flags";
import { assertPermission, hasPermission, type PermissionAction } from "@/lib/permissions";
import { todayInSaoPaulo } from "@/lib/workers";

export const PATRIMONY_FLAG = "module_patrimonio";
const MODULE = "Patrimônio";
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

export async function requirePatrimony(actor: Actor, action: PermissionAction) {
  await requireFlag(PATRIMONY_FLAG);
  await assertPermission(actor, "department", action, "patrimonio");
}

/** Leitura dos memorandos: aba do Patrimônio ou aba da Diretoria. */
export async function canReadDisposals(actor: Actor) {
  return (await hasPermission(actor, "department", "read", "patrimonio")) || (await hasPermission(actor, "presidencia", "read"));
}

/** Decisão: Administrador ou Presidente com acesso completo à Diretoria (regra do mock). */
export async function canDecideDisposals(actor: Actor) {
  if (!["administrador", "presidente"].includes(actor.role)) return false;
  return hasPermission(actor, "presidencia", "approve");
}

// ---------------------------------------------------------------- Baixas

const SNAPSHOT_FIELDS = ["id", "tombamento", "description", "department_key", "entry_date", "disposal_date", "value_cents", "condition", "location", "responsible"] as const;
type AssetRow = Record<(typeof SNAPSHOT_FIELDS)[number], unknown> & { archived_at: string | null; version: number };

async function loadAsset(client: PoolClient, id: string, lock = false) {
  const result = await client.query<AssetRow>(
    `select id, tombamento, description, department_key, to_char(entry_date,'YYYY-MM-DD') as entry_date,
            to_char(disposal_date,'YYYY-MM-DD') as disposal_date, value_cents::text as value_cents, condition, location, responsible,
            archived_at, version
       from app.patrimony_assets where id = $1 ${lock ? "for update" : ""}`,
    [id]
  );
  if (!result.rows[0]) throw new AppError("Bem não encontrado.", 404, "NOT_FOUND");
  return result.rows[0];
}

export function assetSnapshot(asset: Record<string, unknown>) {
  return Object.fromEntries(SNAPSHOT_FIELDS.map((k) => [k, asset[k] === null || asset[k] === undefined ? "" : String(asset[k])]));
}

function sameSnapshot(a: Record<string, unknown>, b: Record<string, unknown>) {
  return SNAPSHOT_FIELDS.every((k) => String(a[k] ?? "") === String(b[k] ?? ""));
}

export const disposalRequestSchema = z.object({
  asset_id: z.string().uuid(),
  asset_version: z.number().int().positive(),
  request_date: isoDate,
  reason: z.string().trim().min(1, "Informe o motivo da baixa.").max(2000),
  destination: z.string().trim().max(250).optional().default("")
});

export const disposalDecisionSchema = z.object({
  version: z.number().int().positive(),
  decision: z.enum(["approved", "rejected"]),
  decision_date: isoDate,
  disposal_date: isoDate.optional().or(z.literal("")),
  reference: z.string().trim().max(200).optional().default(""),
  notes: z.string().trim().max(2000).optional().default("")
});

export const disposalCancelSchema = z.object({
  version: z.number().int().positive(),
  reason: z.string().trim().min(3, "Informe o motivo do cancelamento.").max(1000)
});

/** Regras de datas da decisão (puras, testadas em unidade). */
export function validateDisposalDecision(input: z.infer<typeof disposalDecisionSchema>, requestDate: string, today: string) {
  if (input.decision_date < requestDate || input.decision_date > today) {
    throw new AppError(`Informe a data da decisão entre ${requestDate.split("-").reverse().join("/")} e hoje.`);
  }
  if (input.decision === "approved") {
    if (!input.disposal_date || input.disposal_date < input.decision_date || input.disposal_date > today) {
      throw new AppError("Informe a data da baixa, a partir da decisão e até hoje.");
    }
  }
  if (input.decision === "rejected" && !input.notes) throw new AppError("Informe o motivo da recusa.");
}

export async function listDisposals(filters: { status?: string; q?: string }) {
  const values: unknown[] = [];
  const where: string[] = [];
  if (filters.status) { values.push(filters.status); where.push(`d.status = $${values.length}`); }
  if (filters.q) {
    values.push(`%${filters.q.toLowerCase()}%`);
    where.push(`(lower(d.number) like $${values.length} or lower(d.asset_snapshot->>'tombamento') like $${values.length} or lower(d.asset_snapshot->>'description') like $${values.length} or lower(ru.full_name) like $${values.length})`);
  }
  const result = await query(
    `select d.id, d.number, d.asset_id, d.asset_snapshot, to_char(d.request_date,'YYYY-MM-DD') as request_date, d.reason, d.destination,
            d.status, d.requested_at, ru.full_name as requested_by_name,
            to_char(d.decision_date,'YYYY-MM-DD') as decision_date, to_char(d.disposal_date,'YYYY-MM-DD') as disposal_date,
            d.decision_reference, d.decision_notes, d.decided_at, du.full_name as decided_by_name, du.role_key as decided_by_role,
            d.cancel_reason, d.cancelled_at, cu.full_name as cancelled_by_name, d.version,
            (select jsonb_build_object('id', a.id, 'tombamento', a.tombamento, 'description', a.description, 'department_key', a.department_key,
                     'entry_date', to_char(a.entry_date,'YYYY-MM-DD'), 'disposal_date', coalesce(to_char(a.disposal_date,'YYYY-MM-DD'), ''),
                     'value_cents', a.value_cents::text, 'condition', a.condition, 'location', a.location, 'responsible', a.responsible)
               from app.patrimony_assets a where a.id = d.asset_id) as current_asset
       from app.patrimony_disposals d
       join app.users ru on ru.id = d.requested_by
       left join app.users du on du.id = d.decided_by
       left join app.users cu on cu.id = d.cancelled_by
      ${where.length ? `where ${where.join(" and ")}` : ""}
      order by d.requested_at desc limit 500`,
    values
  );
  return result.rows.map((row) => ({ ...row, snapshot_changed: row.status === "pending" && !sameSnapshot(row.asset_snapshot, row.current_asset ?? {}) }));
}

/** Bens que podem receber memorando: sem baixa, não arquivados e sem pedido pendente. */
export async function eligibleAssets() {
  const result = await query(
    `select a.id, a.tombamento, a.description, a.version, to_char(a.entry_date,'YYYY-MM-DD') as entry_date
       from app.patrimony_assets a
      where a.disposal_date is null and a.archived_at is null
        and not exists (select 1 from app.patrimony_disposals d where d.asset_id = a.id and d.status = 'pending')
      order by a.tombamento`
  );
  return result.rows;
}

export async function requestDisposal(actor: Actor, body: unknown) {
  const input = disposalRequestSchema.parse(body);
  const today = todayInSaoPaulo();
  return transaction(async (client) => {
    const asset = await loadAsset(client, input.asset_id, true);
    if (asset.archived_at || asset.disposal_date) throw new AppError("Este bem já foi baixado ou está arquivado.", 409, "ASSET_UNAVAILABLE");
    if (asset.version !== input.asset_version) {
      throw new AppError("O cadastro do bem mudou durante o preenchimento. Selecione o bem novamente e confira os dados.", 409, "VERSION_CONFLICT");
    }
    const pending = await client.query("select 1 from app.patrimony_disposals where asset_id = $1 and status = 'pending'", [asset.id]);
    if (pending.rowCount) throw new AppError("Este bem já possui uma solicitação pendente.", 409, "PENDING_EXISTS");
    if (input.request_date < String(asset.entry_date) || input.request_date > today) {
      throw new AppError(`Informe a data do memorando a partir de ${String(asset.entry_date).split("-").reverse().join("/")} e até hoje.`);
    }
    const year = input.request_date.slice(0, 4);
    await client.query("select pg_advisory_xact_lock(hashtext('patrimony_disposals:' || $1))", [year]);
    const max = await client.query<{ n: number }>(
      "select coalesce(max(split_part(number, '-', 4)::int), 0) as n from app.patrimony_disposals where number like $1",
      [`PAT-BAIXA-${year}-%`]
    );
    const number = `PAT-BAIXA-${year}-${String(max.rows[0].n + 1).padStart(4, "0")}`;
    const snapshot = assetSnapshot(asset);
    const inserted = await client.query<{ id: string }>(
      `insert into app.patrimony_disposals (number, asset_id, asset_snapshot, request_date, reason, destination, requested_by)
       values ($1,$2,$3,$4,$5,$6,$7) returning id`,
      [number, asset.id, snapshot, input.request_date, input.reason, input.destination, actor.id]
    );
    await appendAudit(actor, {
      category: "Inclusão", action: "Memorando de baixa encaminhado à Diretoria", module: MODULE, section: "Autorização de Baixa",
      entityType: "patrimonio-baixa", entityId: inserted.rows[0].id, details: `${number} — ${snapshot.tombamento}`, after: { number, asset: snapshot, reason: input.reason }
    }, client);
    return { id: inserted.rows[0].id, number };
  });
}

async function loadDisposal(client: PoolClient, id: string) {
  const result = await client.query<{ id: string; number: string; asset_id: string; asset_snapshot: Record<string, unknown>; request_date: string; status: string; version: number }>(
    "select id, number, asset_id, asset_snapshot, to_char(request_date,'YYYY-MM-DD') as request_date, status, version from app.patrimony_disposals where id = $1 for update",
    [id]
  );
  const row = result.rows[0];
  if (!row) throw new AppError("Memorando não encontrado.", 404, "NOT_FOUND");
  return row;
}

export async function decideDisposal(actor: Actor, id: string, body: unknown) {
  if (!(await canDecideDisposals(actor))) throw new AuthorizationError("Somente os perfis autorizados da Diretoria podem registrar a decisão.");
  const input = disposalDecisionSchema.parse(body);
  const today = todayInSaoPaulo();
  return transaction(async (client) => {
    const request = await loadDisposal(client, id);
    if (request.version !== input.version) throw new AppError("Este pedido já foi alterado. Feche e abra o memorando novamente.", 409, "VERSION_CONFLICT");
    if (request.status !== "pending") throw new AppError("Este pedido já possui decisão ou foi cancelado.", 409, "ALREADY_DECIDED");
    validateDisposalDecision(input, request.request_date, today);
    const asset = await loadAsset(client, request.asset_id, true);
    if (input.decision === "approved" && (asset.disposal_date || asset.archived_at || !sameSnapshot(assetSnapshot(asset), request.asset_snapshot))) {
      throw new AppError("O bem já foi baixado ou seu cadastro mudou após o memorando. O Patrimônio deve cancelar e encaminhar um novo pedido.", 409, "SNAPSHOT_CHANGED");
    }
    await client.query(
      `update app.patrimony_disposals set status = $2, decision_date = $3, disposal_date = $4, decision_reference = $5, decision_notes = $6,
              decided_by = $7, decided_at = now(), version = version + 1 where id = $1`,
      [id, input.decision, input.decision_date, input.decision === "approved" ? input.disposal_date : null, input.reference, input.notes, actor.id]
    );
    if (input.decision === "approved") {
      await client.query(
        "update app.patrimony_assets set disposal_date = $2, updated_by = $3, updated_at = now(), version = version + 1 where id = $1",
        [asset.id, input.disposal_date, actor.id]
      );
      await appendAudit(actor, {
        category: "Edição", action: "Alteração: Bem patrimonial", module: MODULE, section: "Bens",
        entityType: "patrimonio-bens", entityId: String(asset.id), details: `Baixa autorizada pelo memorando ${request.number}`,
        before: { disposal_date: null }, after: { disposal_date: input.disposal_date }
      }, client);
    }
    await appendAudit(actor, {
      category: "Edição",
      action: input.decision === "approved" ? "Diretoria autorizou e registrou baixa patrimonial" : "Diretoria recusou a baixa patrimonial",
      module: "Diretoria", section: "Autorizações de Baixa", entityType: "patrimonio-baixa", entityId: id,
      details: `${request.number} — ${request.asset_snapshot.tombamento}${input.reference ? ` · Ata: ${input.reference}` : ""}`,
      after: { status: input.decision, decision_date: input.decision_date, disposal_date: input.disposal_date || null, notes: input.notes }
    }, client);
  });
}

export async function cancelDisposal(actor: Actor, id: string, body: unknown) {
  const input = disposalCancelSchema.parse(body);
  return transaction(async (client) => {
    const request = await loadDisposal(client, id);
    if (request.version !== input.version) throw new AppError("Este pedido já foi alterado. Feche e abra o memorando novamente.", 409, "VERSION_CONFLICT");
    if (request.status !== "pending") throw new AppError("Somente pedidos pendentes podem ser cancelados.", 409, "ALREADY_DECIDED");
    await client.query(
      "update app.patrimony_disposals set status = 'cancelled', cancel_reason = $2, cancelled_by = $3, cancelled_at = now(), version = version + 1 where id = $1",
      [id, input.reason, actor.id]
    );
    await appendAudit(actor, {
      category: "Edição", action: "Cancelamento de memorando de baixa", module: MODULE, section: "Autorização de Baixa",
      entityType: "patrimonio-baixa", entityId: id, details: `${request.number} · Motivo: ${input.reason}`
    }, client);
  });
}

// ---------------------------------------------------------------- Escala de limpeza

export const CLEANING_FEE_CENTS = 5000;
export const CLEANING_STATUS = { scheduled: "Escalado", done: "Limpeza realizada", fee: "Optou pela taxa de serviço", cancelled: "Cancelado" } as const;
export const PAYMENT_METHODS = ["PIX", "Dinheiro", "Transferência", "Cartão"] as const;
type CleaningStatus = keyof typeof CLEANING_STATUS;

/** Primeiro domingo de março: fim do recesso de janeiro e fevereiro. */
export function recessEnd(year: number) {
  const d = new Date(Date.UTC(year, 2, 1));
  d.setUTCDate(1 + ((7 - d.getUTCDay()) % 7));
  return d.toISOString().slice(0, 10);
}

export function isSunday(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  return Number.isFinite(+d) && d.toISOString().slice(0, 10) === date && d.getUTCDay() === 0;
}

export function cleaningDateAllowed(date: string) {
  return isSunday(date) && date >= recessEnd(Number(date.slice(0, 4)));
}

/** Domingos permitidos entre dois meses (inclusive), no máximo 12 meses. */
export function cleaningSundays(startMonth: string, endMonth: string) {
  assertPeriod(startMonth, endMonth);
  const out: string[] = [];
  const d = new Date(`${startMonth}-01T12:00:00Z`);
  while (d.toISOString().slice(0, 7) <= endMonth) {
    const iso = d.toISOString().slice(0, 10);
    if (cleaningDateAllowed(iso)) out.push(iso);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const month = z.string().regex(/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/, "Mês inválido.");

export function assertPeriod(start: string, end: string) {
  month.parse(start);
  month.parse(end);
  const span = (Number(end.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + Number(end.slice(5)) - Number(start.slice(5));
  if (span < 0) throw new AppError("O mês final deve ser igual ou posterior ao inicial.");
  if (span > 11) throw new AppError("Escolha um período de até 12 meses.");
}

const paymentShape = {
  payment_status: z.enum(["pending", "paid"]).optional(),
  payment_date: isoDate.optional().or(z.literal("")),
  payment_method: z.enum(PAYMENT_METHODS).optional().or(z.literal("")),
  payment_reference: z.string().trim().max(150).optional().default("")
};

export const cleaningCreateSchema = z.object({
  clean_date: isoDate,
  worker_ids: z.array(z.string().uuid()).min(1, "Selecione ao menos um trabalhador.").max(500),
  status: z.enum(["scheduled", "done", "fee"]),
  notes: z.string().trim().max(1500).optional().default(""),
  keep_repeats: z.boolean().optional().default(false),
  ...paymentShape
});

export const cleaningUpdateSchema = z.object({
  version: z.number().int().positive(),
  clean_date: isoDate,
  worker_id: z.string().uuid(),
  status: z.enum(["scheduled", "done", "fee", "cancelled"]),
  notes: z.string().trim().max(1500).optional().default(""),
  reason: z.string().trim().max(1000).optional().default(""),
  keep_repeats: z.boolean().optional().default(false),
  ...paymentShape
});

export const cleaningGenerateSchema = z.object({ start: month, end: month, team_size: z.number().int().min(1).max(500) });

type Payment = { payment_status: "pending" | "paid" | null; payment_date: string | null; payment_method: string | null; payment_reference: string };

export function normalizePayment(status: CleaningStatus, input: { payment_status?: string; payment_date?: string; payment_method?: string; payment_reference?: string }, today: string): Payment {
  if (status !== "fee") return { payment_status: null, payment_date: null, payment_method: null, payment_reference: "" };
  const paid = input.payment_status === "paid";
  if (paid && (!input.payment_date || input.payment_date > today || !PAYMENT_METHODS.includes(input.payment_method as never))) {
    throw new AppError("Informe uma data de recebimento até hoje e a forma de pagamento.");
  }
  return paid
    ? { payment_status: "paid", payment_date: input.payment_date!, payment_method: input.payment_method!, payment_reference: input.payment_reference ?? "" }
    : { payment_status: "pending", payment_date: null, payment_method: null, payment_reference: "" };
}

type CleaningRow = {
  id: string; clean_date: string; worker_id: string; worker_snapshot: { id: string; name: string; departments: string[] };
  status: CleaningStatus; payment_status: "pending" | "paid" | null; payment_date: string | null; payment_method: string | null;
  payment_reference: string; notes: string; version: number;
};

/** Regras de edição de um registro existente (puras). */
export function validateCleaningEdit(base: CleaningRow, input: z.infer<typeof cleaningUpdateSchema>, payment: Payment, today: string) {
  const legacy = base.clean_date === input.clean_date && (input.status === "cancelled" || (base.status !== "scheduled" && input.status === base.status));
  if (!isSunday(input.clean_date)) throw new AppError("A limpeza acontece somente aos domingos. Selecione um domingo.");
  if (!cleaningDateAllowed(input.clean_date) && !legacy) {
    throw new AppError(`Recesso em janeiro e fevereiro. A escala começa em ${recessEnd(Number(input.clean_date.slice(0, 4))).split("-").reverse().join("/")}, primeiro domingo de março.`);
  }
  if (input.status === "done" && input.clean_date > today) throw new AppError("Uma limpeza futura ainda não pode ser marcada como realizada.");
  if (input.status === "cancelled" && !input.reason) throw new AppError("Informe o motivo do cancelamento.");
  if (base.payment_status === "paid") {
    if (input.clean_date !== base.clean_date || input.worker_id !== base.worker_id || input.status !== "fee") {
      throw new AppError("Corrija primeiro o recebimento para Pendente, informando o motivo, antes de alterar ou cancelar a escala.");
    }
    const changed = payment.payment_status !== "paid" || payment.payment_date !== base.payment_date
      || payment.payment_method !== base.payment_method || payment.payment_reference !== base.payment_reference;
    if (changed && !input.reason) throw new AppError("Informe o motivo da correção do recebimento.");
  }
}

async function activeWorkers(client: PoolClient, ids: string[] | null) {
  const result = await client.query<{ id: string; name: string; departments: string[] }>(
    `select w.id, w.full_name as name, coalesce(array_agg(d.department_key order by d.department_key) filter (where d.department_key is not null), '{}') as departments
       from app.workers w left join app.worker_departments d on d.worker_id = w.id
      where w.status = 'active' and ($1::uuid[] is null or w.id = any($1))
      group by w.id order by w.full_name`,
    [ids]
  );
  return result.rows;
}

/** Trabalhadores com mais de uma escala não cancelada no ano; `decided` quando a repetição foi mantida. */
export async function cleaningConflicts(executor: Pick<PoolClient, "query">, years: number[], only?: { year: number; workerIds: string[] }) {
  const result = await executor.query<{ year: number; worker_id: string; name: string; ids: string[]; dates: string[]; decided: boolean }>(
    `select g.year, g.worker_id, g.name, g.ids, g.dates,
            coalesce((select array(select unnest(c.roster_ids) order by 1) = g.ids from app.cleaning_conflict_decisions c
                       where c.year = g.year and c.worker_id = g.worker_id), false) as decided
       from (select extract(year from r.clean_date)::int as year, r.worker_id,
                    max(coalesce(w.full_name, r.worker_snapshot->>'name')) as name,
                    array_agg(r.id order by r.id) as ids,
                    array_agg(to_char(r.clean_date, 'YYYY-MM-DD') order by r.clean_date) as dates
               from app.cleaning_roster r left join app.workers w on w.id = r.worker_id
              where r.status <> 'cancelled' and extract(year from r.clean_date)::int = any($1)
              group by 1, 2 having count(*) > 1) g
      order by g.year, g.name`,
    [years]
  );
  return only ? result.rows.filter((g) => g.year === only.year && only.workerIds.includes(g.worker_id)) : result.rows;
}

async function settleConflicts(client: PoolClient, actor: Actor, year: number, workerIds: string[], keep: boolean) {
  const pending = (await cleaningConflicts(client, [year], { year, workerIds })).filter((g) => !g.decided);
  if (!pending.length) return 0;
  if (!keep) {
    throw new AppError(
      `Repetição no ano: ${pending.map((g) => `${g.name} (${g.dates.map((d) => d.split("-").reverse().join("/")).join(", ")})`).join("; ")}. Confirme para manter ou modifique a escala.`,
      409, "CLEANING_REPEAT"
    );
  }
  for (const group of pending) {
    await client.query(
      `insert into app.cleaning_conflict_decisions (year, worker_id, roster_ids, decided_by) values ($1,$2,$3,$4)
       on conflict (year, worker_id) do update set roster_ids = excluded.roster_ids, decided_by = excluded.decided_by, decided_at = now()`,
      [group.year, group.worker_id, group.ids, actor.id]
    );
    await appendAudit(actor, {
      category: "Edição", action: "Repetição na escala de limpeza mantida", module: MODULE, section: "Escala de Limpeza",
      entityType: "patrimonio-limpeza-conflito", entityId: group.worker_id, details: `${group.name} · ${group.dates.join(", ")}`
    }, client);
  }
  return pending.length;
}

function uniqueViolation(error: unknown): never {
  if ((error as { code?: string }).code === "23505") throw new AppError("Este trabalhador já está escalado neste domingo.", 409, "DUPLICATE");
  throw error;
}

export async function listCleaning(start: string, end: string) {
  assertPeriod(start, end);
  const rows = await query(
    `select r.id, to_char(r.clean_date,'YYYY-MM-DD') as clean_date, r.worker_id,
            case when r.status = 'scheduled' and w.id is not null
                 then jsonb_build_object('id', w.id, 'name', w.full_name, 'departments',
                        coalesce((select jsonb_agg(d.department_key order by d.department_key) from app.worker_departments d where d.worker_id = w.id), '[]'::jsonb))
                 else r.worker_snapshot end as worker_snapshot,
            coalesce(w.phone, '') as phone, r.status, r.fee_cents, r.payment_status, to_char(r.payment_date,'YYYY-MM-DD') as payment_date,
            r.payment_method, r.payment_reference, r.notes, r.cancel_reason, r.version, r.created_at, r.updated_at
       from app.cleaning_roster r left join app.workers w on w.id = r.worker_id and w.status = 'active'
      where r.clean_date >= $1::date and r.clean_date < ($2::date + interval '1 month')
      order by r.clean_date, worker_snapshot->>'name'`,
    [`${start}-01`, `${end}-01`]
  );
  const years = [...new Set([Number(start.slice(0, 4)), Number(end.slice(0, 4))])];
  const conflicts = await cleaningConflicts(dbPool(), years);
  return { rows: rows.rows, conflicts, sundays: cleaningSundays(start, end) };
}

export async function createCleaning(actor: Actor, body: unknown) {
  const input = cleaningCreateSchema.parse(body);
  const today = todayInSaoPaulo();
  if (!isSunday(input.clean_date)) throw new AppError("A limpeza acontece somente aos domingos. Selecione um domingo.");
  if (!cleaningDateAllowed(input.clean_date)) {
    throw new AppError(`Recesso em janeiro e fevereiro. A escala começa em ${recessEnd(Number(input.clean_date.slice(0, 4))).split("-").reverse().join("/")}, primeiro domingo de março.`);
  }
  if (input.status === "done" && input.clean_date > today) throw new AppError("Uma limpeza futura ainda não pode ser marcada como realizada.");
  const payment = normalizePayment(input.status, input, today);
  const ids = [...new Set(input.worker_ids)];
  return transaction(async (client) => {
    await client.query("select pg_advisory_xact_lock(hashtext('cleaning_roster'))");
    const workers = await activeWorkers(client, ids);
    if (workers.length !== ids.length) throw new AppError("Selecione somente trabalhadores ativos e aprovados pela Diretoria.");
    const created: string[] = [];
    for (const worker of workers) {
      const inserted = await client.query<{ id: string }>(
        `insert into app.cleaning_roster (clean_date, worker_id, worker_snapshot, status, fee_cents, payment_status, payment_date, payment_method,
                                          payment_reference, payment_recorded_by, payment_recorded_at, notes, created_by, updated_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13) returning id`,
        [input.clean_date, worker.id, worker, input.status, input.status === "fee" ? CLEANING_FEE_CENTS : 0, payment.payment_status, payment.payment_date,
          payment.payment_method, payment.payment_reference, payment.payment_status === "paid" ? actor.id : null,
          payment.payment_status === "paid" ? new Date() : null, input.notes, actor.id]
      ).catch(uniqueViolation);
      created.push(inserted.rows[0].id);
    }
    const kept = await settleConflicts(client, actor, Number(input.clean_date.slice(0, 4)), ids, input.keep_repeats);
    await appendAudit(actor, {
      category: "Inclusão", action: "Inclusão na escala de limpeza", module: MODULE, section: "Escala de Limpeza",
      entityType: "patrimonio-limpeza", entityId: created[0],
      details: `${input.clean_date.split("-").reverse().join("/")} — ${workers.map((w) => w.name).join("; ")} · ${CLEANING_STATUS[input.status]}${input.status === "fee" ? " · R$ 50,00 por trabalhador" : ""}`,
      metadata: { ids: created }
    }, client);
    return { ids: created, keptRepeats: kept };
  });
}

export async function updateCleaning(actor: Actor, id: string, body: unknown) {
  const input = cleaningUpdateSchema.parse(body);
  const today = todayInSaoPaulo();
  return transaction(async (client) => {
    const found = await client.query<CleaningRow>(
      `select id, to_char(clean_date,'YYYY-MM-DD') as clean_date, worker_id, worker_snapshot, status, payment_status,
              to_char(payment_date,'YYYY-MM-DD') as payment_date, payment_method, payment_reference, notes, version
         from app.cleaning_roster where id = $1 for update`,
      [id]
    );
    const base = found.rows[0];
    if (!base) throw new AppError("Registro não encontrado.", 404, "NOT_FOUND");
    if (base.version !== input.version) throw new AppError("Este registro mudou. Feche e abra novamente.", 409, "VERSION_CONFLICT");
    const payment = normalizePayment(input.status, input, today);
    validateCleaningEdit(base, input, payment, today);
    const historical = input.worker_id === base.worker_id && input.clean_date === base.clean_date;
    let snapshot = base.worker_snapshot;
    const [worker] = await activeWorkers(client, [input.worker_id]);
    if (!worker && !historical) throw new AppError("Selecione somente trabalhadores ativos e aprovados pela Diretoria.");
    // Registro já realizado mantém o retrato do cadastro daquela data.
    const preserve = historical && base.status !== "scheduled";
    if (worker && !preserve) snapshot = worker;
    const paymentUnchanged = base.payment_status === "paid" && payment.payment_status === "paid"
      && payment.payment_date === base.payment_date && payment.payment_method === base.payment_method && payment.payment_reference === base.payment_reference;
    await client.query(
      `update app.cleaning_roster set clean_date = $2, worker_id = $3, worker_snapshot = $4, status = $5, fee_cents = $6,
              payment_status = $7, payment_date = $8, payment_method = $9, payment_reference = $10,
              payment_recorded_by = case when $11 then payment_recorded_by when $7 = 'paid' then $14::uuid else null end,
              payment_recorded_at = case when $11 then payment_recorded_at when $7 = 'paid' then now() else null end,
              notes = $12, cancel_reason = $13, updated_by = $14, updated_at = now(), version = version + 1
        where id = $1`,
      [id, input.clean_date, input.worker_id, snapshot, input.status, input.status === "fee" ? CLEANING_FEE_CENTS : 0,
        payment.payment_status, payment.payment_date, payment.payment_method, payment.payment_reference, paymentUnchanged,
        input.notes, input.status === "cancelled" ? input.reason : "", actor.id]
    ).catch(uniqueViolation);
    if (input.status !== "cancelled") await settleConflicts(client, actor, Number(input.clean_date.slice(0, 4)), [input.worker_id], input.keep_repeats);
    const fields = (r: Record<string, unknown>) => ({
      clean_date: r.clean_date, worker: (r.worker_snapshot as { name?: string } | undefined)?.name, status: r.status,
      payment_status: r.payment_status, payment_date: r.payment_date, payment_method: r.payment_method, payment_reference: r.payment_reference, notes: r.notes
    });
    await appendAudit(actor, {
      category: input.status === "cancelled" ? "Exclusão" : "Edição",
      action: base.payment_status === "paid" && !paymentUnchanged ? "Correção de recebimento da taxa de limpeza" : "Atualização da escala de limpeza",
      module: MODULE, section: "Escala de Limpeza", entityType: "patrimonio-limpeza", entityId: id,
      details: `${input.clean_date.split("-").reverse().join("/")} — ${snapshot.name} · ${CLEANING_STATUS[input.status]}${input.reason ? ` · Motivo: ${input.reason}` : ""}`,
      before: fields(base), after: fields({ ...input, worker_snapshot: snapshot, ...payment })
    }, client);
  });
}

/** Geração automática: cada trabalhador ativo no máximo uma vez por ano; vagas faltantes são informadas. */
export async function generateCleaning(actor: Actor, body: unknown) {
  const input = cleaningGenerateSchema.parse(body);
  const days = cleaningSundays(input.start, input.end);
  if (!days.length) throw new AppError("Período de recesso: selecione um intervalo que inclua domingos de março a dezembro.");
  return transaction(async (client) => {
    await client.query("select pg_advisory_xact_lock(hashtext('cleaning_roster'))");
    const pool = await activeWorkers(client, null);
    if (!pool.length) throw new AppError("Não há trabalhadores ativos aprovados disponíveis para gerar a escala.");
    const existing = await client.query<{ clean_date: string; worker_id: string; status: string }>(
      `select to_char(clean_date,'YYYY-MM-DD') as clean_date, worker_id, status from app.cleaning_roster
        where extract(year from clean_date)::int = any($1)`,
      [[...new Set(days.map((d) => Number(d.slice(0, 4))))]]
    );
    const used = new Map<string, Set<string>>();
    const usedIn = (year: string) => {
      if (!used.has(year)) used.set(year, new Set(existing.rows.filter((r) => r.clean_date.startsWith(year) && r.status !== "cancelled").map((r) => r.worker_id)));
      return used.get(year)!;
    };
    let added = 0;
    let missing = 0;
    for (const day of days) {
      const onDay = existing.rows.filter((r) => r.clean_date === day);
      const excluded = new Set(onDay.map((r) => r.worker_id));
      const needed = Math.max(0, input.team_size - onDay.filter((r) => r.status !== "cancelled").length);
      const year = usedIn(day.slice(0, 4));
      for (let n = 0; n < needed; n += 1) {
        const worker = pool.find((w) => !year.has(w.id) && !excluded.has(w.id));
        if (!worker) { missing += needed - n; break; }
        await client.query(
          "insert into app.cleaning_roster (clean_date, worker_id, worker_snapshot, created_by, updated_by) values ($1,$2,$3,$4,$4)",
          [day, worker.id, worker, actor.id]
        );
        year.add(worker.id);
        excluded.add(worker.id);
        added += 1;
      }
    }
    if (added) {
      await appendAudit(actor, {
        category: "Inclusão", action: "Geração da escala de limpeza sem repetição anual", module: MODULE, section: "Escala de Limpeza",
        details: `${input.start} a ${input.end} · ${added} registro(s) incluído(s) · ${input.team_size} pessoa(s) por domingo · ${missing} vaga(s) pendente(s)`
      }, client);
    }
    const conflicts = (await cleaningConflicts(client, [...new Set(days.map((d) => Number(d.slice(0, 4))))])).filter((g) => !g.decided).length;
    return { added, missing, conflicts };
  });
}

/** Mantém repetições já existentes (botão "Manter" na conferência de conflitos). */
export async function keepCleaningConflict(actor: Actor, body: unknown) {
  const input = z.object({ year: z.number().int().min(1900).max(2199), worker_id: z.string().uuid() }).parse(body);
  return transaction((client) => settleConflicts(client, actor, input.year, [input.worker_id], true));
}

// ---------------------------------------------------------------- Relatório anual

export async function patrimonyReport(year: number) {
  const [assets, disposals, cleaning] = await Promise.all([
    query<{ department_key: string; total: number; active: number; value_cents: string; entries: number; disposed: number }>(
      `select department_key, count(*)::int as total,
              count(*) filter (where disposal_date is null)::int as active,
              coalesce(sum(value_cents) filter (where disposal_date is null), 0)::text as value_cents,
              count(*) filter (where extract(year from entry_date) = $1)::int as entries,
              count(*) filter (where extract(year from disposal_date) = $1)::int as disposed
         from app.patrimony_assets where archived_at is null group by 1 order by 1`,
      [year]
    ),
    query<{ status: string; total: number }>(
      "select status, count(*)::int as total from app.patrimony_disposals where extract(year from request_date) = $1 group by 1",
      [year]
    ),
    query<{ month: number; scheduled: number; done: number; fee: number; cancelled: number; fee_paid_cents: string; fee_pending_cents: string }>(
      `select extract(month from clean_date)::int as month,
              count(*) filter (where status = 'scheduled')::int as scheduled,
              count(*) filter (where status = 'done')::int as done,
              count(*) filter (where status = 'fee')::int as fee,
              count(*) filter (where status = 'cancelled')::int as cancelled,
              coalesce(sum(fee_cents) filter (where payment_status = 'paid'), 0)::text as fee_paid_cents,
              coalesce(sum(fee_cents) filter (where payment_status = 'pending'), 0)::text as fee_pending_cents
         from app.cleaning_roster where extract(year from clean_date) = $1 group by 1 order by 1`,
      [year]
    )
  ]);
  return { year, assets: assets.rows, disposals: disposals.rows, cleaning: cleaning.rows };
}
