/* eslint-disable @next/next/no-img-element -- logo do organizador na impressão */
import { notFound } from "next/navigation";
import type { Actor } from "@/lib/auth";
import { AutoPrint } from "@/components/auto-print";
import { PrintButton } from "@/components/print-button";
import { appendAudit } from "@/lib/audit";
import { cashboxData } from "@/lib/ingressos/caixa";
import { MODULE, SECTION } from "@/lib/ingressos/acesso";
import { activeEvent, loadEvent, logoUrl } from "@/lib/ingressos/dados";
import { PAYMENT_STATUS_LABEL, formatBRL, formatCnpj, manausDateTime, shortDate } from "@/lib/ingressos/regras";

/** Caixa do evento para imprimir ou salvar em PDF (A4), com espaço para as assinaturas (RF-09). */
export async function CaixaImpressao({ actor, eventId }: { actor: Actor; eventId: string | null }) {
  const event = eventId && /^[0-9a-f-]{36}$/i.test(eventId) ? await loadEvent(eventId) : await activeEvent();
  if (!event) notFound();
  const data = await cashboxData(event.id);
  const now = manausDateTime(new Date());
  await appendAudit(actor, { category: "Impressão", action: "Caixa do evento (PDF)", module: MODULE, section: SECTION, entityType: "ticket_event", entityId: event.id, details: event.name });
  const t = data.totals;
  const active = data.sales.filter((s) => !s.cancelled_at);
  const cancelled = data.sales.filter((s) => s.cancelled_at);
  const cell = { border: "1px solid #c9d6dd", padding: "4px 6px", fontSize: 11 } as const;

  return (
    <article style={{ maxWidth: 800, margin: "0 auto", background: "#fff", color: "#1d2b33", padding: 24, fontFamily: "Arial, sans-serif" }}>
      <style>{"@page { size: A4; margin: 14mm; } @media print { body { background: #fff; } }"}</style>
      <AutoPrint />
      <div className="no-print" style={{ marginBottom: 12 }}><PrintButton label="⎙ Imprimir / salvar em PDF" /></div>
      <header style={{ display: "flex", gap: 16, alignItems: "center", borderBottom: "2px solid #203e50", paddingBottom: 12 }}>
        <img src={logoUrl(event)} alt="" width={64} height={64} style={{ objectFit: "contain" }} />
        <div>
          <strong style={{ fontSize: 18 }}>{event.organizer_name}</strong><br />
          <span style={{ fontSize: 12 }}>CNPJ {formatCnpj(event.organizer_cnpj)}</span>
        </div>
      </header>
      <h1 style={{ fontSize: 20, margin: "14px 0 4px" }}>Caixa do evento — {event.name}</h1>
      <p style={{ fontSize: 12, margin: 0 }}>{shortDate(event.event_date, true)}{event.event_time ? ` às ${event.event_time}` : ""}{event.place ? ` · ${event.place}` : ""} · ticket {formatBRL(event.price_cents)}</p>
      <p style={{ fontSize: 12, margin: "2px 0 12px" }}>Finalidade: {event.purpose}</p>

      <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 14 }}>
        <tbody>
          {[
            ["Ingressos vendidos", `${t.sold} (${t.purchases} compras)`], ["Valor total", formatBRL(t.total_cents)],
            ["Recebido", `${formatBRL(t.received_cents)} (Pix ${formatBRL(t.pix_cents)} · Dinheiro ${formatBRL(t.cash_cents)})`],
            ["Dinheiro em mãos de trabalhadores", formatBRL(t.in_hands_cents)], ["A receber", `${formatBRL(t.receivable_cents)} (${t.overdue} vencida(s))`],
            ["Refeições entregues", `${t.delivered} de ${t.sold}`]
          ].map(([k, v]) => <tr key={k}><th style={{ ...cell, textAlign: "left", width: "40%" }}>{k}</th><td style={cell}>{v}</td></tr>)}
        </tbody>
      </table>

      <h2 style={{ fontSize: 15 }}>Vendas</h2>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead><tr>{["Comprador", "Qtd.", "Total", "Recebido", "Saldo", "Vencimento", "Situação", "Vendido por"].map((h) => <th key={h} style={{ ...cell, textAlign: "left", background: "#eef3f6" }}>{h}</th>)}</tr></thead>
        <tbody>
          {active.map((s) => (
            <tr key={s.id}>
              <td style={cell}>{s.buyer_name}</td><td style={cell}>{s.quantity}</td><td style={cell}>{formatBRL(s.total_cents)}</td>
              <td style={cell}>{formatBRL(s.paid_cents)}</td><td style={cell}>{formatBRL(s.balance_cents)}</td>
              <td style={cell}>{s.due_date && s.balance_cents ? shortDate(s.due_date, true) : "—"}</td>
              <td style={cell}>{s.status === "cancelada" ? "Cancelada" : PAYMENT_STATUS_LABEL[s.status]}</td><td style={cell}>{s.seller_name}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {cancelled.length ? (
        <>
          <h2 style={{ fontSize: 15 }}>Vendas canceladas (fora dos totais)</h2>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <tbody>{cancelled.map((s) => <tr key={s.id}><td style={cell}>{s.buyer_name}</td><td style={cell}>{s.quantity}</td><td style={cell}>{formatBRL(s.total_cents)}</td><td style={cell}>{s.cancel_reason}</td></tr>)}</tbody>
          </table>
        </>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginTop: 56 }}>
        <div style={{ borderTop: "1px solid #1d2b33", paddingTop: 6, textAlign: "center", fontSize: 12 }}>Responsável pelo evento</div>
        <div style={{ borderTop: "1px solid #1d2b33", paddingTop: 6, textAlign: "center", fontSize: 12 }}>Tesouraria</div>
      </div>
      <footer style={{ marginTop: 24, fontSize: 11, color: "#617683" }}>Posição em {now.fullDate} {now.time}</footer>
    </article>
  );
}
