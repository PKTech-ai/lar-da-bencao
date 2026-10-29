import type { PoolClient } from "pg";
import { query } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import type { Operator } from "@/lib/ingressos/acesso";
import {
  balanceCents, paymentStatus, todayManaus,
  type EventForMessage, type EventKind, type EventStatus, type PaymentStatus, type PixKeyType
} from "@/lib/ingressos/regras";

/** Consultas comuns do módulo de Ingressos. "Hoje" no SQL = Manaus. */
export const TODAY_SQL = "(now() at time zone 'America/Manaus')::date";

type Executor = Pick<PoolClient, "query">;
export const db = (client?: Executor): Executor => client ?? { query: query as unknown as Executor["query"] };

export type EventRow = {
  id: string; organizer_id: string; organizer_name: string; organizer_cnpj: string; organizer_whatsapp: string | null;
  has_logo: boolean; logo_version: string | null;
  kind: EventKind; name: string; purpose: string; event_date: string; event_time: string; place: string;
  price_cents: number; pix_key_type: PixKeyType; pix_key: string; pix_receiver: string; pix_city: string;
  reservations_whatsapp: string | null; goal_tickets: number | null; status: EventStatus; version: number;
};

export const EVENT_SELECT = `
  select e.id, e.organizer_id, o.name as organizer_name, o.cnpj as organizer_cnpj, o.whatsapp as organizer_whatsapp,
         o.logo is not null as has_logo, extract(epoch from o.logo_updated_at)::bigint::text as logo_version,
         e.kind, e.name, e.purpose, to_char(e.event_date, 'YYYY-MM-DD') as event_date, e.event_time, e.place,
         e.price_cents, e.pix_key_type, e.pix_key, e.pix_receiver, e.pix_city, e.reservations_whatsapp, e.goal_tickets,
         e.status, e.version
    from app.ticket_events e join app.ticket_organizers o on o.id = e.organizer_id`;

export async function loadEvent(id: string, client?: Executor) {
  const result = await db(client).query<EventRow>(`${EVENT_SELECT} where e.id = $1`, [id]);
  return result.rows[0] ?? null;
}

export async function activeEvent(client?: Executor) {
  const result = await db(client).query<EventRow>(`${EVENT_SELECT} where e.status = 'active'`);
  return result.rows[0] ?? null;
}

/** Evento em que o operador trabalha: o ativo (usuários) ou o do convite (trabalhador). */
export async function operatorEvent(op: Operator, client?: Executor) {
  return op.kind === "seller" ? loadEvent(op.eventId, client) : activeEvent(client);
}

export const messageEvent = (event: EventRow): EventForMessage => ({
  name: event.name, kind: event.kind, event_date: event.event_date, event_time: event.event_time, purpose: event.purpose,
  organizer_name: event.organizer_name, pix_key_type: event.pix_key_type, pix_key: event.pix_key
});

export const logoUrl = (event: Pick<EventRow, "organizer_id" | "has_logo" | "logo_version">) =>
  event.has_logo ? `/api/ingressos/logo/${event.organizer_id}?v=${event.logo_version ?? "0"}` : "/marca-lar-da-bencao.png";

export const appUrl = (path: string) => new URL(path, serverEnv().APP_URL).toString();

// ---------- vendas ----------

export type SaleRow = {
  id: string; event_id: string; buyer_id: string; buyer_name: string; buyer_whatsapp: string | null;
  seller_id: string; seller_name: string; quantity: number; unit_price_cents: number; total_cents: number;
  due_date: string | null; created_at: string; cancelled_at: string | null; cancel_reason: string | null; undone: boolean;
  paid_cents: number; delivered: number; undo_seconds_left: number;
};

export const SALE_SELECT = `
  select v.id, v.event_id, v.buyer_id, b.name as buyer_name, b.whatsapp as buyer_whatsapp, v.seller_id, sl.name as seller_name,
         v.quantity, v.unit_price_cents, v.total_cents, to_char(v.due_date, 'YYYY-MM-DD') as due_date, v.created_at,
         v.cancelled_at, v.cancel_reason, v.undone,
         coalesce((select sum(p.amount_cents) from app.ticket_payments p where p.sale_id = v.id and p.reversed_at is null), 0)::int as paid_cents,
         (select count(*) from app.ticket_tickets t where t.sale_id = v.id and t.delivered_at is not null)::int as delivered,
         greatest(0, 120 - extract(epoch from now() - v.created_at))::int as undo_seconds_left
    from app.ticket_sales v
    join app.ticket_buyers b on b.id = v.buyer_id
    join app.ticket_sellers sl on sl.id = v.seller_id`;

export type SaleView = SaleRow & { balance_cents: number; status: PaymentStatus | "cancelada" };

export function saleView(row: SaleRow, today = todayManaus()): SaleView {
  const balance = row.cancelled_at ? 0 : balanceCents(row.total_cents, row.paid_cents);
  return {
    ...row,
    balance_cents: balance,
    status: row.cancelled_at ? "cancelada" : paymentStatus({ totalCents: row.total_cents, paidCents: row.paid_cents, dueDate: row.due_date, today })
  };
}

/** Venda dentro do alcance do operador: trabalhador só vê as próprias, no evento do convite. */
export async function loadSaleFor(op: Operator, saleId: string, client?: Executor, lock = false) {
  if (!/^[0-9a-f-]{36}$/i.test(saleId)) throw new AppError("Venda não encontrada.", 404, "NOT_FOUND");
  if (lock) await db(client).query("select id from app.ticket_sales where id = $1 for update", [saleId]);
  const result = await db(client).query<SaleRow>(`${SALE_SELECT} where v.id = $1`, [saleId]);
  const row = result.rows[0];
  if (!row || (op.kind === "seller" && (row.seller_id !== op.sellerId || row.event_id !== op.eventId))) {
    throw new AppError("Venda não encontrada.", 404, "NOT_FOUND");
  }
  return saleView(row);
}
