import { z } from "zod";
import { appendAudit } from "@/lib/audit";
import { query, transaction } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { MODULE, SECTION, assertCan, author, type Operator } from "@/lib/ingressos/acesso";
import { activeEvent } from "@/lib/ingressos/dados";
import { CODE_ALPHABET, balanceCents, normalizeTypedCode, paymentStatus, ticketTokenFromQr, todayManaus } from "@/lib/ingressos/regras";

/** Tela Validar (RF-08): consulta por código, QR ou nome e entrega atômica. */

export type TicketPanel =
  | { state: "nao_encontrado" }
  | { state: "outro_evento"; event_name: string }
  | { state: "cancelado"; code: string; buyer_name: string }
  | {
      state: "valido" | "pendente" | "utilizado";
      ticket_id: string; sale_id: string; code: string; number: number; quantity: number; buyer_name: string;
      balance_cents: number; due_date: string | null; overdue: boolean;
      delivered_at: string | null; delivered_by_name: string | null; remaining: number;
    };

type TicketRow = {
  id: string; sale_id: string; event_id: string; event_name: string; event_status: string; code: string; number: number;
  delivered_at: string | null; delivered_by_name: string | null; quantity: number; buyer_name: string; total_cents: number;
  paid_cents: number; due_date: string | null; cancelled_at: string | null; remaining: number;
};

const TICKET_SELECT = `
  select t.id, t.sale_id, t.event_id, e.name as event_name, e.status as event_status, t.code, t.number, t.delivered_at,
         u.full_name as delivered_by_name, v.quantity, b.name as buyer_name, v.total_cents,
         coalesce((select sum(p.amount_cents) from app.ticket_payments p where p.sale_id = v.id and p.reversed_at is null), 0)::int as paid_cents,
         to_char(v.due_date, 'YYYY-MM-DD') as due_date, v.cancelled_at,
         (select count(*) from app.ticket_tickets o where o.sale_id = v.id and o.delivered_at is null)::int as remaining
    from app.ticket_tickets t
    join app.ticket_sales v on v.id = t.sale_id
    join app.ticket_buyers b on b.id = v.buyer_id
    join app.ticket_events e on e.id = t.event_id
    left join app.users u on u.id = t.delivered_by`;

export function panelFor(row: TicketRow | undefined, activeId: string): TicketPanel {
  if (!row) return { state: "nao_encontrado" };
  if (row.event_id !== activeId) return { state: "outro_evento", event_name: row.event_name };
  if (row.cancelled_at) return { state: "cancelado", code: row.code, buyer_name: row.buyer_name };
  const today = todayManaus();
  const balance = balanceCents(row.total_cents, row.paid_cents);
  const status = paymentStatus({ totalCents: row.total_cents, paidCents: row.paid_cents, dueDate: row.due_date, today });
  return {
    state: row.delivered_at ? "utilizado" : balance > 0 ? "pendente" : "valido",
    ticket_id: row.id, sale_id: row.sale_id, code: row.code, number: row.number, quantity: row.quantity, buyer_name: row.buyer_name,
    balance_cents: balance, due_date: row.due_date, overdue: status === "vencido",
    delivered_at: row.delivered_at, delivered_by_name: row.delivered_by_name, remaining: row.remaining
  };
}

async function requireActive() {
  const event = await activeEvent();
  if (!event) throw new AppError("Nenhum evento ativo. Peça à coordenação para criar um.", 409, "NO_ACTIVE_EVENT");
  return event;
}

export async function deliveryCounter(eventId: string) {
  const result = await query<{ delivered: number; sold: number }>(
    `select count(*) filter (where t.delivered_at is not null)::int as delivered, count(*)::int as sold
       from app.ticket_tickets t join app.ticket_sales v on v.id = t.sale_id
      where t.event_id = $1 and v.cancelled_at is null`, [eventId]);
  return result.rows[0];
}

/** Código de 4 caracteres, conteúdo do QR (TKT:token) ou nome (2+ letras). */
export async function lookup(op: Operator, raw: string) {
  assertCan(op, "ticket.validar");
  const event = await requireActive();
  const text = raw.trim().slice(0, 120);
  const counter = await deliveryCounter(event.id);
  const token = ticketTokenFromQr(text);
  if (token) {
    const found = await query<TicketRow>(`${TICKET_SELECT} where t.token = $1`, [token]);
    return { kind: "ticket" as const, panel: panelFor(found.rows[0], event.id), counter };
  }
  const code = normalizeTypedCode(text);
  const onlyLetters = /^[\p{L} ]+$/u.test(text);
  if (code.length === 4 && [...code].every((c) => CODE_ALPHABET.includes(c))) {
    const found = await query<TicketRow>(`${TICKET_SELECT} where t.event_id = $1 and t.code = $2`, [event.id, code]);
    // "MARK" pode ser código ou nome: sem ticket com esse código, procura pelo nome.
    if (found.rows[0] || !onlyLetters) return { kind: "ticket" as const, panel: panelFor(found.rows[0], event.id), counter };
  } else if (code.length === 4 && !onlyLetters) {
    return { kind: "ticket" as const, panel: panelFor(undefined, event.id), counter };
  }
  if (text.length < 2) return { kind: "empty" as const, counter };
  const like = `%${text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}%`;
  const sales = await query<{ sale_id: string; buyer_name: string; quantity: number; cancelled: boolean; tickets: { id: string; code: string; number: number; delivered_at: string | null }[] }>(
    `select v.id as sale_id, b.name as buyer_name, v.quantity, v.cancelled_at is not null as cancelled,
            (select jsonb_agg(jsonb_build_object('id', t.id, 'code', t.code, 'number', t.number, 'delivered_at', t.delivered_at) order by t.number)
               from app.ticket_tickets t where t.sale_id = v.id) as tickets
       from app.ticket_sales v join app.ticket_buyers b on b.id = v.buyer_id
      where v.event_id = $1 and v.cancelled_at is null
        and translate(lower(b.name), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') like $2
      order by b.name limit 30`,
    [event.id, like]
  );
  return { kind: "names" as const, sales: sales.rows, counter };
}

const ticketId = z.string().uuid();

export async function deliver(op: Operator, id: string) {
  assertCan(op, "ticket.validar");
  if (!ticketId.safeParse(id).success) throw new AppError("Ticket não encontrado.", 404, "NOT_FOUND");
  const event = await requireActive();
  const userId = op.kind === "user" ? op.actor.id : null;
  return transaction(async (client) => {
    // Entrega atômica: só uma requisição consegue marcar o ticket (RF-08).
    const updated = await client.query<{ id: string }>(
      `update app.ticket_tickets t set delivered_at = now(), delivered_by = $2
        where t.id = $1 and t.delivered_at is null and t.event_id = $3
          and exists (select 1 from app.ticket_sales v where v.id = t.sale_id and v.cancelled_at is null)
        returning t.id`,
      [id, userId, event.id]
    );
    const found = await client.query<TicketRow>(`${TICKET_SELECT} where t.id = $1`, [id]);
    const panel = panelFor(found.rows[0], event.id);
    if (!updated.rowCount) return { delivered: false, panel };
    await appendAudit(author(op), {
      category: "Edição", action: "Entrega de refeição (ticket)", module: MODULE, section: SECTION, entityType: "ticket", entityId: id,
      details: panel.state === "utilizado" ? `${panel.code} · ${panel.buyer_name} · ticket ${panel.number} de ${panel.quantity}` : undefined
    }, client);
    const next = await client.query<{ id: string }>(
      "select id from app.ticket_tickets where sale_id = (select sale_id from app.ticket_tickets where id = $1) and delivered_at is null order by number limit 1", [id]);
    return { delivered: true, panel, next_ticket_id: next.rows[0]?.id ?? null };
  });
}

export async function undoDelivery(op: Operator, id: string) {
  assertCan(op, "ticket.desfazer_entrega");
  if (!ticketId.safeParse(id).success) throw new AppError("Ticket não encontrado.", 404, "NOT_FOUND");
  return transaction(async (client) => {
    const updated = await client.query<{ code: string; delivered_at: string }>(
      `update app.ticket_tickets t set delivered_at = null, delivered_by = null
         from (select id, delivered_at from app.ticket_tickets where id = $1 for update) old
        where t.id = old.id and old.delivered_at is not null returning t.code, old.delivered_at`, [id]);
    if (!updated.rows[0]) throw new AppError("Este ticket não está entregue.", 409, "NOT_DELIVERED");
    await appendAudit(author(op), {
      category: "Edição", action: "Entrega de refeição desfeita", module: MODULE, section: SECTION, entityType: "ticket", entityId: id,
      details: `${updated.rows[0].code} · entregue em ${updated.rows[0].delivered_at}`
    }, client);
    return { ok: true };
  });
}
