import { z } from "zod";
import { query } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { assertCan, type Operator } from "@/lib/ingressos/acesso";
import { SALE_SELECT, TODAY_SQL, activeEvent, loadEvent, saleView, type SaleRow } from "@/lib/ingressos/dados";
import { todayManaus } from "@/lib/ingressos/regras";

/** Caixa do evento (RF-09): indicadores, a receber e vendas. Pagamentos de vendas canceladas saem dos totais. */
export async function cashbox(op: Operator, eventId?: string | null) {
  assertCan(op, "caixa.ver");
  if (eventId && !z.string().uuid().safeParse(eventId).success) throw new AppError("Evento não encontrado.", 404, "NOT_FOUND");
  const event = eventId ? await loadEvent(eventId) : await activeEvent();
  const events = await query<{ id: string; name: string; event_date: string; status: string }>(
    "select id, name, to_char(event_date, 'YYYY-MM-DD') as event_date, status from app.ticket_events order by event_date desc limit 50");
  if (!event) return { event: null, events: events.rows };
  return { event, events: events.rows, ...(await cashboxData(event.id)) };
}

export async function cashboxData(eventId: string) {
  const today = todayManaus();
  const [salesResult, money, ended] = await Promise.all([
    query<SaleRow>(`${SALE_SELECT} where v.event_id = $1 order by v.created_at desc`, [eventId]),
    query<{ pix_cents: number; cash_cents: number; custody_cents: number; settled_cents: number }>(
      `select coalesce(sum(p.amount_cents) filter (where p.method = 'pix'), 0)::int as pix_cents,
              coalesce(sum(p.amount_cents) filter (where p.method = 'dinheiro'), 0)::int as cash_cents,
              coalesce(sum(p.amount_cents) filter (where p.custody_seller_id is not null), 0)::int as custody_cents,
              (select coalesce(sum(amount_cents), 0) from app.ticket_settlements where event_id = $1)::int as settled_cents
         from app.ticket_payments p join app.ticket_sales v on v.id = p.sale_id
        where v.event_id = $1 and v.cancelled_at is null and p.reversed_at is null`, [eventId]),
    // Vendedores sem acesso vigente neste evento (expirado ou bloqueado): marca "acesso encerrado" no A receber.
    query<{ seller_id: string }>(
      `select a.seller_id from app.ticket_access a where a.event_id = $1 group by a.seller_id
       having not bool_or(a.revoked_at is null and a.valid_until >= ${TODAY_SQL})`, [eventId])
  ]);
  const endedSellers = new Set(ended.rows.map((r) => r.seller_id));
  const sales = salesResult.rows.map((row) => ({ ...saleView(row, today), access_ended: endedSellers.has(row.seller_id) }));
  const active = sales.filter((s) => !s.cancelled_at);
  const receivable = active.filter((s) => s.balance_cents > 0)
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || a.buyer_name.localeCompare(b.buyer_name));
  const m = money.rows[0];
  const sold = active.reduce((sum, s) => sum + s.quantity, 0);
  return {
    totals: {
      sold,
      purchases: active.length,
      delivered: active.reduce((sum, s) => sum + s.delivered, 0),
      total_cents: active.reduce((sum, s) => sum + s.total_cents, 0),
      received_cents: m.pix_cents + m.cash_cents,
      pix_cents: m.pix_cents,
      cash_cents: m.cash_cents,
      in_hands_cents: Math.max(0, m.custody_cents - m.settled_cents),
      receivable_cents: receivable.reduce((sum, s) => sum + s.balance_cents, 0),
      overdue: receivable.filter((s) => s.status === "vencido").length
    },
    receivable,
    sales
  };
}
