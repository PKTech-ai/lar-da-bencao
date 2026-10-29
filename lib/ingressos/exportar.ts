import { z } from "zod";
import { query } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { assertCan, type Operator } from "@/lib/ingressos/acesso";
import { cashboxData } from "@/lib/ingressos/caixa";
import { loadEvent } from "@/lib/ingressos/dados";
import { PAYMENT_STATUS_LABEL, formatCnpj, formatWhatsapp, manausDateTime, shortDate } from "@/lib/ingressos/regras";
import { buildXlsx, type Cell, type Sheet } from "@/lib/ingressos/xlsx";

/** Planilha do caixa (RF-09): Resumo, Trabalhadores, Vendas (com canceladas à parte), Recebimentos, Tickets e Acertos. */
export async function exportCashbox(op: Operator, eventId: string) {
  assertCan(op, "caixa.exportar");
  if (!z.string().uuid().safeParse(eventId).success) throw new AppError("Evento não encontrado.", 404, "NOT_FOUND");
  const event = await loadEvent(eventId);
  if (!event) throw new AppError("Evento não encontrado.", 404, "NOT_FOUND");
  const data = await cashboxData(eventId);
  const t = data.totals;
  const [sellers, payments, tickets, settlements] = await Promise.all([
    query<{ name: string; goal: number | null; sold: number; pix_cents: number; cash_cents: number; settled_cents: number; receivable_cents: number }>(
      `with s as (select seller_id from app.ticket_goals where event_id = $1 union select seller_id from app.ticket_sales where event_id = $1),
            v as (select v.*, coalesce((select sum(amount_cents) from app.ticket_payments p where p.sale_id = v.id and p.reversed_at is null), 0) as paid
                    from app.ticket_sales v where v.event_id = $1 and v.cancelled_at is null)
       select sl.name, g.goal,
              coalesce((select sum(quantity) from v where v.seller_id = sl.id), 0)::int as sold,
              coalesce((select sum(p.amount_cents) from app.ticket_payments p join v on v.id = p.sale_id
                         where v.seller_id = sl.id and p.method = 'pix' and p.reversed_at is null), 0)::int as pix_cents,
              coalesce((select sum(p.amount_cents) from app.ticket_payments p join v on v.id = p.sale_id
                         where p.custody_seller_id = sl.id and p.reversed_at is null), 0)::int as cash_cents,
              coalesce((select sum(amount_cents) from app.ticket_settlements a where a.event_id = $1 and a.seller_id = sl.id), 0)::int as settled_cents,
              coalesce((select sum(greatest(0, total_cents - paid)) from v where v.seller_id = sl.id), 0)::int as receivable_cents
         from s join app.ticket_sellers sl on sl.id = s.seller_id left join app.ticket_goals g on g.event_id = $1 and g.seller_id = sl.id
        order by sl.name`, [eventId]),
    query<{ received_at: string; buyer_name: string; amount_cents: number; method: string; registered_by: string; reversed: boolean; cancelled: boolean }>(
      `select p.received_at, b.name as buyer_name, p.amount_cents, p.method, coalesce(u.full_name, s.name || ' (trabalhador)') as registered_by,
              p.reversed_at is not null as reversed, v.cancelled_at is not null as cancelled
         from app.ticket_payments p join app.ticket_sales v on v.id = p.sale_id join app.ticket_buyers b on b.id = v.buyer_id
         left join app.users u on u.id = p.registered_by_user left join app.ticket_sellers s on s.id = p.registered_by_seller
        where v.event_id = $1 order by p.received_at`, [eventId]),
    query<{ code: string; buyer_name: string; number: number; quantity: number; delivered_at: string | null; delivered_by: string | null; cancelled: boolean }>(
      `select t.code, b.name as buyer_name, t.number, v.quantity, t.delivered_at, u.full_name as delivered_by, v.cancelled_at is not null as cancelled
         from app.ticket_tickets t join app.ticket_sales v on v.id = t.sale_id join app.ticket_buyers b on b.id = v.buyer_id
         left join app.users u on u.id = t.delivered_by where t.event_id = $1 order by b.name, t.number`, [eventId]),
    query<{ name: string; amount_cents: number; received_at: string; received_by: string; note: string }>(
      `select s.name, a.amount_cents, a.received_at, u.full_name as received_by, a.note from app.ticket_settlements a
         join app.ticket_sellers s on s.id = a.seller_id join app.users u on u.id = a.received_by where a.event_id = $1 order by a.received_at`, [eventId])
  ]);

  const when = (value: string | null) => (value ? `${manausDateTime(value).fullDate} ${manausDateTime(value).time}` : "");
  const now = manausDateTime(new Date());
  type SaleItem = (typeof data.sales)[number];
  const saleRow = (s: SaleItem): Cell[] => [
    s.buyer_name, s.buyer_whatsapp ? formatWhatsapp(s.buyer_whatsapp) : "", s.quantity, { money: s.unit_price_cents }, { money: s.total_cents },
    { money: s.paid_cents }, { money: s.balance_cents }, s.due_date ? shortDate(s.due_date, true) : "",
    s.status === "cancelada" ? "Cancelada" : PAYMENT_STATUS_LABEL[s.status], s.seller_name, when(s.created_at)
  ];
  const head = (labels: string[]): Cell[] => labels.map((h) => ({ bold: h }));
  const saleHead = head(["Comprador", "WhatsApp", "Quantidade", "Valor unitário", "Total", "Recebido", "Saldo", "Vencimento", "Situação", "Vendido por", "Data da venda"]);
  const cancelled = data.sales.filter((s) => s.cancelled_at);
  const overdue = data.receivable.filter((s) => s.status === "vencido").reduce((sum, s) => sum + s.balance_cents, 0);

  const sheets: Sheet[] = [
    { name: "Resumo", rows: [
      [{ bold: "Evento" }, event.name], [{ bold: "Organizador" }, event.organizer_name], [{ bold: "CNPJ" }, formatCnpj(event.organizer_cnpj)],
      [{ bold: "Finalidade" }, event.purpose], [{ bold: "Data" }, shortDate(event.event_date, true)], [{ bold: "Valor do ticket" }, { money: event.price_cents }],
      [{ bold: "Posição em" }, `${now.fullDate} ${now.time}`], [{ bold: "Vendidos" }, t.sold], [{ bold: "Valor total" }, { money: t.total_cents }],
      [{ bold: "Recebido" }, { money: t.received_cents }], [{ bold: "Recebido em Pix" }, { money: t.pix_cents }], [{ bold: "Recebido em dinheiro" }, { money: t.cash_cents }],
      [{ bold: "Dinheiro em mãos de trabalhadores" }, { money: t.in_hands_cents }], [{ bold: "A receber" }, { money: t.receivable_cents }],
      [{ bold: "Vencido" }, { money: overdue }], [{ bold: "Entregues" }, t.delivered]
    ] },
    { name: "Trabalhadores", rows: [
      head(["Nome", "Meta", "Vendidos", "% da meta", "Pix", "Dinheiro recebido", "Dinheiro acertado", "Em mãos", "A receber"]),
      ...sellers.rows.map((s): Cell[] => [s.name, s.goal, s.sold, s.goal ? Math.round((s.sold / s.goal) * 100) : null, { money: s.pix_cents },
        { money: s.cash_cents }, { money: s.settled_cents }, { money: Math.max(0, s.cash_cents - s.settled_cents) }, { money: s.receivable_cents }])
    ] },
    { name: "Vendas", rows: [
      saleHead, ...data.sales.filter((s) => !s.cancelled_at).map(saleRow),
      ...(cancelled.length ? [[], [{ bold: "Vendas canceladas (fora dos totais)" }], [...saleHead, { bold: "Motivo" }], ...cancelled.map((s) => [...saleRow(s), s.cancel_reason ?? ""])] : [])
    ] },
    { name: "Recebimentos", rows: [
      head(["Data", "Comprador", "Valor", "Forma", "Registrado por", "Estornado"]),
      ...payments.rows.map((p): Cell[] => [when(p.received_at), p.buyer_name, { money: p.amount_cents }, p.method === "pix" ? "Pix" : "Dinheiro", p.registered_by,
        p.reversed ? "sim" : p.cancelled ? "venda cancelada" : "não"])
    ] },
    { name: "Tickets", rows: [
      head(["Código", "Comprador", "Número", "Entregue em", "Entregue por"]),
      ...tickets.rows.filter((r) => !r.cancelled).map((r): Cell[] => [r.code, r.buyer_name, `${r.number} de ${r.quantity}`, when(r.delivered_at), r.delivered_by ?? ""])
    ] },
    { name: "Acertos", rows: [
      head(["Trabalhador", "Valor", "Recebido em", "Recebido por", "Observação"]),
      ...settlements.rows.map((a): Cell[] => [a.name, { money: a.amount_cents }, when(a.received_at), a.received_by, a.note])
    ] }
  ];
  const slug = event.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").toLowerCase();
  return { buffer: buildXlsx(sheets), filename: `caixa-${slug}-${event.event_date}.xlsx`, event };
}
