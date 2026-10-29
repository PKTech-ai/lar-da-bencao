"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Bar, ErrorBox, brl, openWhatsapp, useApi, useLoad, useShell, type EventInfo, type Sale } from "@/components/ingressos/base";
import { dueLabel, shortDate, todayManaus } from "@/lib/ingressos/regras";

type Cashbox = {
  event: EventInfo | null;
  events: { id: string; name: string; event_date: string; status: string }[];
  totals?: { sold: number; purchases: number; delivered: number; total_cents: number; received_cents: number; pix_cents: number; cash_cents: number; in_hands_cents: number; receivable_cents: number; overdue: number };
  receivable?: Sale[];
  sales?: Sale[];
};

function SaleLine({ sale, href, onCharge, busy }: { sale: Sale; href: string; onCharge?: () => void; busy?: boolean }) {
  return (
    <div className="ing-item" style={{ cursor: "default" }}>
      <Link href={href} className="grow" style={{ textDecoration: "none", color: "inherit" }}>
        <b>{sale.buyer_name}</b>
        <small>
          {sale.quantity} {sale.quantity === 1 ? "ingresso" : "ingressos"}
          {sale.balance_cents > 0 && sale.due_date ? ` · ${dueLabel(sale.due_date, todayManaus())}` : ""}
          {sale.balance_cents > 0 ? ` · saldo ${brl(sale.balance_cents)}` : ` · ${sale.delivered} de ${sale.quantity} entregues`}
          {sale.access_ended ? " · acesso encerrado" : ""}
        </small>
      </Link>
      {onCharge && sale.buyer_whatsapp ? <button type="button" className="ing-btn small" disabled={busy} onClick={onCharge}>Cobrar</button> : <Badge status={sale.status} />}
    </div>
  );
}

function useCharge() {
  const api = useApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const charge = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      openWhatsapp((await api<{ wa_url: string }>(`/api/ingressos/vendas/${id}`, { method: "POST", body: { action: "cobrar" } })).wa_url);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return { charge, busy, error };
}

/** Caixa do evento (RF-09). */
export function Caixa() {
  const { base, ctx } = useShell();
  const [eventId, setEventId] = useState("");
  const [q, setQ] = useState("");
  const { data, error } = useLoad<Cashbox>(`/api/ingressos/caixa${eventId ? `?evento=${eventId}` : ""}`);
  const { charge, busy, error: chargeError } = useCharge();
  if (error) return <ErrorBox text={error} />;
  if (!data) return <p className="ing-muted">Carregando…</p>;
  const t = data.totals;
  const term = q.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const sales = (data.sales ?? []).filter((s) => !term || s.buyer_name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(term));

  return (
    <div className="ing-step">
      {data.events.length > 1 ? (
        <label className="ing-field">Evento
          <select value={eventId || data.event?.id || ""} onChange={(e) => setEventId(e.target.value)}>
            {data.events.map((e) => <option key={e.id} value={e.id}>{e.name} · {shortDate(e.event_date, true)}{e.status === "active" ? " (ativo)" : ""}</option>)}
          </select>
        </label>
      ) : null}
      {!data.event || !t ? <p className="ing-empty">Nenhum evento ativo.</p> : (
        <>
          <div className="ing-kpis">
            <div className="ing-kpi"><span>Vendidos</span><b>{t.sold}</b><small>{t.purchases} compras</small></div>
            <div className="ing-kpi"><span>Entregues</span><b>{t.delivered} / {t.sold}</b><Bar value={t.delivered} max={t.sold} /></div>
            <div className="ing-kpi"><span>Recebido</span><b>{brl(t.received_cents)}</b><small>Pix {brl(t.pix_cents)} · Dinheiro {brl(t.cash_cents)}</small></div>
            <div className="ing-kpi"><span>A receber</span><b>{brl(t.receivable_cents)}</b><small>{t.overdue ? `${t.overdue} vencida${t.overdue > 1 ? "s" : ""}` : "nenhuma vencida"}</small></div>
          </div>
          {t.in_hands_cents ? <div className="notice">Em mãos de trabalhadores: <b>{brl(t.in_hands_cents)}</b> (aguardando acerto).</div> : null}
          <ErrorBox text={chargeError} />
          <h3>A receber</h3>
          <div className="ing-list">
            {data.receivable?.length ? data.receivable.map((s) => (
              <SaleLine key={s.id} sale={s} href={`${base}/venda/${s.id}`} busy={busy} onCharge={ctx?.can["pagamento.registrar"] ? () => charge(s.id) : undefined} />
            )) : <p className="ing-muted">Nada a receber.</p>}
          </div>
          <h3>Vendas</h3>
          <input className="ing-input" placeholder="Procurar pelo nome" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Procurar venda pelo nome" />
          <div className="ing-list">
            {sales.map((s) => <SaleLine key={s.id} sale={s} href={`${base}/venda/${s.id}`} />)}
            {!sales.length ? <p className="ing-muted">Nenhuma venda.</p> : null}
          </div>
          {ctx?.can["caixa.exportar"] ? (
            <div className="ing-row">
              <a className="ing-btn" href={`/api/ingressos/caixa/exportar?evento=${data.event.id}&formato=xlsx`}>Exportar planilha</a>
              <a className="ing-btn" href={`${base}/caixa/imprimir?evento=${data.event.id}`} target="_blank" rel="noopener">Exportar PDF</a>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

type Mine = { event: EventInfo | null; sales: Sale[]; sold: number; goal: number | null; totals: { pix_cents: number; cash_cents: number; receivable_cents: number } };

/** Minhas vendas (RF-15). */
export function MinhasVendas() {
  const { base, ctx } = useShell();
  const { data, error } = useLoad<Mine>("/api/ingressos/vendas");
  const { charge, busy, error: chargeError } = useCharge();
  if (error) return <ErrorBox text={error} />;
  if (!data || !ctx) return <p className="ing-muted">Carregando…</p>;
  const missing = data.goal ? Math.max(0, data.goal - data.sold) : 0;
  return (
    <div className="ing-step">
      <div className="ing-hello"><span>Olá, <b>{ctx.name.split(" ")[0]}</b></span></div>
      {data.goal ? (
        <div className="ing-card">
          <p style={{ fontSize: 20 }}>Sua meta: <b>{data.sold} de {data.goal}</b></p>
          <Bar value={data.sold} max={data.goal} />
          <p className="ing-muted">{missing ? `Faltam ${missing}` : "Meta batida! Obrigado."}</p>
        </div>
      ) : <p>Você vendeu <b>{data.sold}</b> {data.sold === 1 ? "ingresso" : "ingressos"}.</p>}
      <div className="ing-kpis" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        <div className="ing-kpi"><span>Pix na conta da Casa</span><b style={{ fontSize: 18 }}>{brl(data.totals.pix_cents)}</b></div>
        <div className="ing-kpi"><span>Dinheiro comigo</span><b style={{ fontSize: 18 }}>{brl(data.totals.cash_cents)}</b></div>
        <div className="ing-kpi"><span>A receber</span><b style={{ fontSize: 18 }}>{brl(data.totals.receivable_cents)}</b></div>
      </div>
      <ErrorBox text={chargeError} />
      <div className="ing-list">
        {data.sales.map((s) => (
          <SaleLine key={s.id} sale={s} href={`${base}/venda/${s.id}`} busy={busy}
            onCharge={!s.cancelled_at && s.balance_cents > 0 ? () => charge(s.id) : undefined} />
        ))}
        {!data.sales.length ? <p className="ing-muted">Nenhuma venda ainda.</p> : null}
      </div>
      <Link className="ing-btn primary" href={base}>Vender ingresso</Link>
    </div>
  );
}
