import { z } from "zod";
import { appendAudit } from "@/lib/audit";
import { query, transaction } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { MODULE, SECTION, assertCan, author, newToken, sha256hex, type Operator } from "@/lib/ingressos/acesso";
import { TODAY_SQL, appUrl, loadEvent } from "@/lib/ingressos/dados";
import {
  DEFAULT_ACCESS_DAYS, WHATSAPP_ERROR, accessState, addDays, daysBetween, formatBRL, inviteMessage, normalizeWhatsapp,
  reminderMessage, todayManaus, waLink
} from "@/lib/ingressos/regras";
import { formatPersonName } from "@/lib/person-name";
import { sellerEventSummary } from "@/lib/ingressos/vendas";

/** Metas, acessos dos trabalhadores, painel e acerto (RF-11 a RF-14). Só Coordenação. */

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data.");

async function requireEvent(eventId: string) {
  if (!uuid.safeParse(eventId).success) throw new AppError("Evento não encontrado.", 404, "NOT_FOUND");
  const event = await loadEvent(eventId);
  if (!event) throw new AppError("Evento não encontrado.", 404, "NOT_FOUND");
  return event;
}

type AccessRow = { id: string; valid_until: string; first_access_at: string | null; revoked_at: string | null; revoke_reason: string | null; last_access_at: string | null };

export async function goalsPanel(op: Operator, eventId: string) {
  assertCan(op, "meta.gerenciar");
  const event = await requireEvent(eventId);
  const today = todayManaus();
  const rows = await query<{
    seller_id: string; name: string; whatsapp: string | null; worker_id: string | null; is_user: boolean; goal: number | null;
    sold: number; pix_cents: number; custody_cents: number; settled_cents: number; receivable_cents: number; access: AccessRow | null;
  }>(
    `with sellers as (
       select seller_id from app.ticket_goals where event_id = $1
       union select seller_id from app.ticket_sales where event_id = $1 and cancelled_at is null
     ), sales as (
       select v.seller_id, v.id, v.quantity, v.total_cents,
              coalesce((select sum(p.amount_cents) from app.ticket_payments p where p.sale_id = v.id and p.reversed_at is null), 0) as paid
         from app.ticket_sales v where v.event_id = $1 and v.cancelled_at is null
     )
     select s.id as seller_id, s.name, s.whatsapp, s.worker_id, s.user_id is not null as is_user, g.goal,
            coalesce((select sum(quantity) from sales x where x.seller_id = s.id), 0)::int as sold,
            coalesce((select sum(p.amount_cents) from app.ticket_payments p join sales x on x.id = p.sale_id
                       where x.seller_id = s.id and p.method = 'pix' and p.reversed_at is null), 0)::int as pix_cents,
            coalesce((select sum(p.amount_cents) from app.ticket_payments p join sales x on x.id = p.sale_id
                       where p.custody_seller_id = s.id and p.reversed_at is null), 0)::int as custody_cents,
            coalesce((select sum(amount_cents) from app.ticket_settlements t where t.event_id = $1 and t.seller_id = s.id), 0)::int as settled_cents,
            coalesce((select sum(greatest(0, total_cents - paid)) from sales x where x.seller_id = s.id), 0)::int as receivable_cents,
            (select to_jsonb(a) from (select id, to_char(valid_until, 'YYYY-MM-DD') as valid_until, first_access_at, revoked_at, revoke_reason, last_access_at
                                        from app.ticket_access where event_id = $1 and seller_id = s.id
                                       order by (revoked_at is null) desc, sent_at desc limit 1) a) as access
       from sellers x join app.ticket_sellers s on s.id = x.seller_id
       left join app.ticket_goals g on g.event_id = $1 and g.seller_id = s.id`,
    [eventId]
  );
  const sellers = rows.rows.map((r) => {
    const inHands = Math.max(0, r.custody_cents - r.settled_cents);
    return {
      seller_id: r.seller_id, name: r.name, whatsapp: r.whatsapp, worker_id: r.worker_id, is_user: r.is_user, goal: r.goal, sold: r.sold,
      percent: r.goal ? Math.round((r.sold / r.goal) * 100) : null, reached: r.goal ? r.sold >= r.goal : false,
      pix_cents: r.pix_cents, in_hands_cents: inHands, receivable_cents: r.receivable_cents,
      access: r.access, access_state: accessState(r.access, today), removed: r.goal === null
    };
  }).sort((a, b) => Number(b.reached) - Number(a.reached) || (b.percent ?? -1) - (a.percent ?? -1) || a.name.localeCompare(b.name));
  const distributed = sellers.reduce((sum, s) => sum + (s.goal ?? 0), 0);
  const sold = sellers.reduce((sum, s) => sum + s.sold, 0);
  return {
    event,
    days_to_event: daysBetween(today, event.event_date),
    distributed,
    sold_total: (await query<{ n: number }>("select coalesce(sum(quantity),0)::int as n from app.ticket_sales where event_id=$1 and cancelled_at is null", [eventId])).rows[0].n,
    sellers_sold: sold,
    pix_cents: sellers.reduce((sum, s) => sum + s.pix_cents, 0),
    in_hands_cents: sellers.reduce((sum, s) => sum + s.in_hands_cents, 0),
    receivable_cents: sellers.reduce((sum, s) => sum + s.receivable_cents, 0),
    sellers
  };
}

/** Busca no cadastro de trabalhadores ativos da Casa (para "Adicionar trabalhador"). */
export async function searchWorkers(op: Operator, q: string) {
  assertCan(op, "meta.gerenciar");
  const text = q.trim().slice(0, 80);
  if (text.length < 2) return [];
  const result = await query<{ id: string; full_name: string; phone: string | null }>(
    `select id, full_name, phone from app.workers where status = 'active' and lower(full_name) like $1 order by full_name limit 15`,
    [`%${text.toLowerCase()}%`]
  );
  return result.rows;
}

const addSchema = z.object({
  worker_id: z.string().uuid().optional(),
  name: z.string().max(160).optional(),
  whatsapp: z.string().max(40).optional(),
  goal: z.number().int().min(1, "Meta mínima: 1.").max(999, "Meta máxima: 999.").default(10)
});

export async function addSeller(op: Operator, eventId: string, body: unknown) {
  assertCan(op, "meta.gerenciar");
  await requireEvent(eventId);
  const input = addSchema.parse(body);
  const actorId = op.kind === "user" ? op.actor.id : null;
  return transaction(async (client) => {
    let sellerId: string;
    if (input.worker_id) {
      const worker = await client.query<{ full_name: string; phone: string | null }>("select full_name, phone from app.workers where id = $1 and status = 'active'", [input.worker_id]);
      if (!worker.rows[0]) throw new AppError("Trabalhador não encontrado.", 404, "NOT_FOUND");
      const phone = input.whatsapp?.trim() ? normalizeWhatsapp(input.whatsapp) : normalizeWhatsapp(worker.rows[0].phone ?? "");
      if (input.whatsapp?.trim() && !phone) throw new AppError(WHATSAPP_ERROR);
      const upsert = await client.query<{ id: string }>(
        `insert into app.ticket_sellers (name, whatsapp, worker_id, created_by) values ($1,$2,$3,$4)
         on conflict (worker_id) where worker_id is not null do update set whatsapp = coalesce(excluded.whatsapp, app.ticket_sellers.whatsapp)
         returning id`,
        [formatPersonName(worker.rows[0].full_name).slice(0, 120), phone, input.worker_id, actorId]
      );
      sellerId = upsert.rows[0].id;
    } else {
      const name = formatPersonName(input.name ?? "");
      if (name.split(" ").length < 2) throw new AppError("Escreva o nome e o sobrenome do trabalhador.");
      const phone = normalizeWhatsapp(input.whatsapp ?? "");
      if (!phone) throw new AppError(WHATSAPP_ERROR);
      const existing = await client.query<{ id: string }>("select id from app.ticket_sellers where whatsapp = $1 order by created_at limit 1", [phone]);
      sellerId = existing.rows[0]?.id ?? (await client.query<{ id: string }>(
        "insert into app.ticket_sellers (name, whatsapp, created_by) values ($1,$2,$3) returning id", [name.slice(0, 120), phone, actorId])).rows[0].id;
    }
    await client.query(
      `insert into app.ticket_goals (event_id, seller_id, goal, updated_by) values ($1,$2,$3,$4)
       on conflict (event_id, seller_id) do nothing`, [eventId, sellerId, input.goal, actorId]);
    await appendAudit(author(op), {
      category: "Inclusão", action: "Trabalhador incluído nas metas de ingressos", module: MODULE, section: SECTION,
      entityType: "ticket_goal", entityId: sellerId, details: `meta ${input.goal}`
    }, client);
    return { seller_id: sellerId };
  });
}

const goalsSchema = z.object({
  goal_tickets: z.number().int().min(1).max(100000).nullable().optional(),
  goals: z.array(z.object({ seller_id: z.string().uuid(), goal: z.number().int().min(1, "Meta mínima: 1.").max(999, "Meta máxima: 999.") })).max(500).default([])
});

export async function saveGoals(op: Operator, eventId: string, body: unknown) {
  assertCan(op, "meta.gerenciar");
  await requireEvent(eventId);
  const input = goalsSchema.parse(body);
  const actorId = op.kind === "user" ? op.actor.id : null;
  return transaction(async (client) => {
    if (input.goal_tickets !== undefined) {
      await client.query("update app.ticket_events set goal_tickets = $2, updated_at = now(), updated_by = $3, version = version + 1 where id = $1",
        [eventId, input.goal_tickets, actorId]);
    }
    for (const item of input.goals) {
      await client.query(
        `insert into app.ticket_goals (event_id, seller_id, goal, updated_by, updated_at) values ($1,$2,$3,$4, now())
         on conflict (event_id, seller_id) do update set goal = excluded.goal, updated_by = excluded.updated_by, updated_at = now()`,
        [eventId, item.seller_id, item.goal, actorId]);
    }
    await appendAudit(author(op), {
      category: "Edição", action: "Metas de ingressos alteradas", module: MODULE, section: SECTION, entityType: "ticket_event", entityId: eventId,
      after: input
    }, client);
    return { ok: true };
  });
}

/** Remover da lista: as vendas continuam no nome dele; o acesso é bloqueado. */
export async function removeSeller(op: Operator, eventId: string, sellerId: string) {
  assertCan(op, "meta.gerenciar");
  if (!uuid.safeParse(sellerId).success) throw new AppError("Trabalhador não encontrado.", 404, "NOT_FOUND");
  const actorId = op.kind === "user" ? op.actor.id : null;
  return transaction(async (client) => {
    await client.query("delete from app.ticket_goals where event_id = $1 and seller_id = $2", [eventId, sellerId]);
    await client.query(
      "update app.ticket_access set revoked_at = now(), revoked_by = $3, revoke_reason = 'removido' where event_id = $1 and seller_id = $2 and revoked_at is null",
      [eventId, sellerId, actorId]);
    await appendAudit(author(op), {
      category: "Exclusão", action: "Trabalhador retirado das metas de ingressos", module: MODULE, section: SECTION, entityType: "ticket_goal", entityId: sellerId
    }, client);
    return { ok: true };
  });
}

// ---------- acesso temporário (RF-12) ----------

const sendSchema = z.object({ valid_until: date.optional() });

/** Enviar (primeira vez) ou Reenviar (novo token: invalida o link, o PIN e o aparelho anteriores). */
export async function sendAccess(op: Operator, eventId: string, sellerId: string, body: unknown) {
  assertCan(op, "acesso.gerenciar");
  if (op.kind !== "user") throw new AppError("Operação da coordenação.", 403, "FORBIDDEN");
  const event = await requireEvent(eventId);
  const today = todayManaus();
  const input = sendSchema.parse(body ?? {});
  const validUntil = input.valid_until ?? addDays(today, DEFAULT_ACCESS_DAYS);
  if (validUntil < today) throw new AppError("Escolha uma data a partir de hoje.");
  return transaction(async (client) => {
    const seller = await client.query<{ name: string; whatsapp: string | null; goal: number | null }>(
      `select s.name, s.whatsapp, g.goal from app.ticket_sellers s
         left join app.ticket_goals g on g.event_id = $2 and g.seller_id = s.id where s.id = $1`, [sellerId, eventId]);
    const row = seller.rows[0];
    if (!row) throw new AppError("Trabalhador não encontrado.", 404, "NOT_FOUND");
    if (!row.whatsapp) throw new AppError("Cadastre o WhatsApp do trabalhador para enviar o acesso.");
    const previous = await client.query<{ id: string }>(
      `update app.ticket_access set revoked_at = now(), revoked_by = $3, revoke_reason = 'reenviado'
        where event_id = $1 and seller_id = $2 and revoked_at is null returning id`, [eventId, sellerId, op.actor.id]);
    const token = newToken(32);
    const access = await client.query<{ id: string }>(
      `insert into app.ticket_access (event_id, seller_id, token_hash, valid_until, created_by) values ($1,$2,$3,$4,$5) returning id`,
      [eventId, sellerId, sha256hex(token), validUntil, op.actor.id]);
    const link = appUrl(`/ingressos/acesso/${token}`);
    const message = inviteMessage({ sellerName: row.name, eventName: event.name, organizerName: event.organizer_name, goal: row.goal, link, validUntil });
    await appendAudit(author(op), {
      category: "Segurança", action: previous.rowCount ? "Acesso de vendedor reenviado" : "Acesso de vendedor enviado",
      module: MODULE, section: SECTION, entityType: "ticket_access", entityId: access.rows[0].id, details: `${row.name} · válido até ${validUntil}`
    }, client);
    return { link, message, wa_url: waLink(row.whatsapp, message), valid_until: validUntil };
  });
}

export async function extendAccess(op: Operator, eventId: string, sellerId: string, body: unknown) {
  assertCan(op, "acesso.gerenciar");
  const { valid_until } = z.object({ valid_until: date }).parse(body);
  if (valid_until < todayManaus()) throw new AppError("Escolha uma data a partir de hoje.");
  return transaction(async (client) => {
    const updated = await client.query<{ id: string }>(
      "update app.ticket_access set valid_until = $3, expired_logged_at = null where event_id = $1 and seller_id = $2 and revoked_at is null returning id",
      [eventId, sellerId, valid_until]);
    if (!updated.rows[0]) throw new AppError("Este trabalhador não tem acesso para prorrogar. Use Enviar acesso.", 404, "NOT_FOUND");
    await appendAudit(author(op), {
      category: "Segurança", action: "Acesso de vendedor prorrogado", module: MODULE, section: SECTION, entityType: "ticket_access",
      entityId: updated.rows[0].id, details: `válido até ${valid_until}`
    }, client);
    return { ok: true };
  });
}

export async function blockAccess(op: Operator, eventId: string, sellerId: string) {
  assertCan(op, "acesso.gerenciar");
  return transaction(async (client) => {
    const updated = await client.query<{ id: string }>(
      `update app.ticket_access set revoked_at = now(), revoked_by = $3, revoke_reason = 'bloqueado'
        where event_id = $1 and seller_id = $2 and revoked_at is null returning id`,
      [eventId, sellerId, op.kind === "user" ? op.actor.id : null]);
    if (!updated.rows[0]) throw new AppError("Este trabalhador não tem acesso ativo.", 404, "NOT_FOUND");
    await client.query("update app.ticket_seller_sessions set revoked_at = now() where access_id = $1 and revoked_at is null", [updated.rows[0].id]);
    await appendAudit(author(op), {
      category: "Segurança", action: "Acesso de vendedor bloqueado", module: MODULE, section: SECTION, entityType: "ticket_access", entityId: updated.rows[0].id
    }, client);
    return { ok: true };
  });
}

export async function remindSeller(op: Operator, eventId: string, sellerId: string) {
  assertCan(op, "meta.gerenciar");
  const event = await requireEvent(eventId);
  const summary = await sellerEventSummary(eventId, sellerId);
  const seller = await query<{ name: string; whatsapp: string | null }>("select name, whatsapp from app.ticket_sellers where id = $1", [sellerId]);
  const row = seller.rows[0];
  if (!row?.whatsapp) throw new AppError("Trabalhador sem WhatsApp cadastrado.");
  const message = reminderMessage({ sellerName: row.name, eventName: event.name, sold: summary.sold, goal: summary.goal ?? 0 });
  return { message, wa_url: waLink(row.whatsapp, message) };
}

// ---------- acerto (RF-13) ----------

export async function sellerDetail(op: Operator, eventId: string, sellerId: string) {
  assertCan(op, "meta.gerenciar");
  if (!uuid.safeParse(sellerId).success) throw new AppError("Trabalhador não encontrado.", 404, "NOT_FOUND");
  const event = await requireEvent(eventId);
  const [seller, summary, settlements, access] = await Promise.all([
    query<{ id: string; name: string; whatsapp: string | null }>("select id, name, whatsapp from app.ticket_sellers where id = $1", [sellerId]),
    sellerEventSummary(eventId, sellerId),
    query<{ id: string; amount_cents: number; received_at: string; received_by_name: string; note: string }>(
      `select t.id, t.amount_cents, t.received_at, u.full_name as received_by_name, t.note from app.ticket_settlements t
         join app.users u on u.id = t.received_by where t.event_id = $1 and t.seller_id = $2 order by t.received_at desc`, [eventId, sellerId]),
    query<AccessRow>(
      `select id, to_char(valid_until, 'YYYY-MM-DD') as valid_until, first_access_at, revoked_at, revoke_reason, last_access_at
         from app.ticket_access where event_id = $1 and seller_id = $2 order by (revoked_at is null) desc, sent_at desc limit 1`, [eventId, sellerId])
  ]);
  if (!seller.rows[0]) throw new AppError("Trabalhador não encontrado.", 404, "NOT_FOUND");
  const current = access.rows[0] ?? null;
  return {
    event, seller: seller.rows[0], ...summary, settlements: settlements.rows,
    access: current, access_state: accessState(current, todayManaus())
  };
}

const settleSchema = z.object({ amount_cents: z.number().int().positive("Informe o valor entregue."), note: z.string().trim().max(200).optional().default("") });

export async function registerSettlement(op: Operator, eventId: string, sellerId: string, body: unknown) {
  assertCan(op, "acerto.registrar");
  if (op.kind !== "user") throw new AppError("Operação da coordenação.", 403, "FORBIDDEN");
  const input = settleSchema.parse(body);
  return transaction(async (client) => {
    await client.query("select pg_advisory_xact_lock(hashtext('ticket_settlement:' || $1 || ':' || $2))", [eventId, sellerId]);
    const summary = await sellerEventSummary(eventId, sellerId, client);
    if (input.amount_cents > summary.totals.cash_cents) {
      throw new AppError(`O valor é maior que o dinheiro em mãos (${formatBRL(summary.totals.cash_cents)}).`);
    }
    const inserted = await client.query<{ id: string }>(
      "insert into app.ticket_settlements (event_id, seller_id, amount_cents, received_by, note) values ($1,$2,$3,$4,$5) returning id",
      [eventId, sellerId, input.amount_cents, op.actor.id, input.note]);
    await appendAudit(author(op), {
      category: "Inclusão", action: "Acerto de dinheiro de ingressos", module: MODULE, section: SECTION, entityType: "ticket_settlement",
      entityId: inserted.rows[0].id, details: formatBRL(input.amount_cents)
    }, client);
    return { ok: true, in_hands_cents: summary.totals.cash_cents - input.amount_cents };
  });
}

/** Rotina diária: registra no histórico os acessos que venceram (a checagem a cada requisição já os bloqueia). */
export async function logExpiredAccesses() {
  return transaction(async (client) => {
    const expired = await client.query<{ id: string; name: string }>(
      `update app.ticket_access a set expired_logged_at = now() from app.ticket_sellers s
        where s.id = a.seller_id and a.revoked_at is null and a.expired_logged_at is null and a.valid_until < ${TODAY_SQL}
        returning a.id, s.name`);
    await client.query(
      `update app.ticket_seller_sessions ss set revoked_at = now() from app.ticket_access a
        where a.id = ss.access_id and ss.revoked_at is null and (a.valid_until < ${TODAY_SQL} or a.revoked_at is not null)`);
    await client.query("delete from app.ticket_rate_hits where created_at < now() - interval '1 day'");
    for (const row of expired.rows) {
      await appendAudit(null, {
        category: "Segurança", action: "Acesso de vendedor expirado", module: MODULE, section: SECTION, entityType: "ticket_access", entityId: row.id, details: row.name
      }, client);
    }
    return expired.rowCount ?? 0;
  });
}
