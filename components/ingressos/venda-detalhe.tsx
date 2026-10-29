"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, ErrorBox, Qr, brl, openWhatsapp, useApi, useLoad, useShell, type Sale } from "@/components/ingressos/base";
import { QR_PREFIX, dueLabel, formatWhatsapp, manausDateTime, parseBRL, shortDate, todayManaus } from "@/lib/ingressos/regras";

type Detail = {
  sale: Sale;
  tickets: { id: string; number: number; code: string; token: string; delivered_at: string | null; delivered_by_name: string | null }[];
  payments: { id: string; amount_cents: number; method: "pix" | "dinheiro"; received_at: string; registered_by_name: string; custody_name: string | null; reversed_at: string | null; reverse_reason: string | null }[];
  can: { pay: boolean; reverse: boolean; cancel: boolean; undo: boolean; edit_due: boolean; edit_buyer: boolean; undo_delivery: boolean };
};

/** Detalhe da venda (RF-06): tickets, reenvio, baixa, vencimento, estorno e cancelamento. */
export function VendaDetalhe({ id }: { id: string }) {
  const { base, mode, reload: reloadCtx } = useShell();
  const api = useApi();
  const { data, error, reload } = useLoad<Detail>(`/api/ingressos/vendas/${id}`);
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState<string | null>(null);
  const [method, setMethod] = useState<"pix" | "dinheiro">("pix");
  const [due, setDue] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [reversing, setReversing] = useState<string | null>(null);
  const [buyer, setBuyer] = useState<{ name: string; whatsapp: string } | null>(null);

  if (error) return <ErrorBox text={error} />;
  if (!data) return <p className="ing-muted">Carregando…</p>;
  const { sale, tickets, payments, can } = data;
  const today = todayManaus();
  const back = mode === "seller" ? `${base}/minhas` : `${base}/caixa`;

  async function act(work: () => Promise<unknown>, done?: string) {
    setBusy(true);
    setMessage("");
    setOk("");
    try {
      await work();
      await reload();
      void reloadCtx();
      if (done) setOk(done);
    } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  }
  const post = (body: object) => api<{ wa_url?: string | null; message?: string }>(`/api/ingressos/vendas/${id}`, { method: "POST", body });

  return (
    <div className="ing-step">
      <Link className="ing-back" href={back}>← Voltar</Link>
      <div className="ing-card">
        <div className="ing-row" style={{ alignItems: "center" }}>
          <h2 style={{ fontSize: 22 }}>{sale.buyer_name}</h2>
          <span style={{ flex: "0 0 auto" }}><Badge status={sale.status} /></span>
        </div>
        <p className="ing-muted">{sale.buyer_whatsapp ? formatWhatsapp(sale.buyer_whatsapp) : "Sem WhatsApp"} · vendido por {sale.seller_name}</p>
        {sale.cancelled_at ? <div className="error">Venda cancelada{sale.cancel_reason ? `: ${sale.cancel_reason}` : ""}.</div> : null}
        {can.edit_buyer && !buyer ? <button type="button" className="ing-btn small" onClick={() => setBuyer({ name: sale.buyer_name, whatsapp: sale.buyer_whatsapp ? formatWhatsapp(sale.buyer_whatsapp) : "" })}>Corrigir comprador</button> : null}
        {buyer ? (
          <form className="ing-step" onSubmit={(e) => { e.preventDefault(); void act(async () => { await api(`/api/ingressos/compradores/${sale.buyer_id}`, { method: "PUT", body: buyer }); setBuyer(null); }, "Comprador corrigido."); }}>
            <label className="ing-field">Nome e sobrenome<input value={buyer.name} onChange={(e) => setBuyer({ ...buyer, name: e.target.value })} /></label>
            <label className="ing-field">WhatsApp<input inputMode="tel" value={buyer.whatsapp} onChange={(e) => setBuyer({ ...buyer, whatsapp: e.target.value })} /></label>
            <div className="ing-row"><button className="ing-btn primary small" disabled={busy}>Salvar</button><button type="button" className="ing-btn small" onClick={() => setBuyer(null)}>Cancelar</button></div>
          </form>
        ) : null}
      </div>

      {!sale.cancelled_at ? (
        <>
          {sale.buyer_whatsapp ? (
            <button type="button" className="ing-btn green" disabled={busy} onClick={() => act(async () => openWhatsapp((await post({ action: "reenviar" })).wa_url))}>
              Reenviar no WhatsApp
            </button>
          ) : null}
          <div className="ing-row">
            <button type="button" className="ing-btn small" disabled={busy} onClick={() => act(async () => {
              const r = await post({ action: "reenviar" });
              await navigator.clipboard.writeText(r.message ?? "");
            }, "Mensagem copiada.")}>Copiar mensagem</button>
            {can.undo ? <button type="button" className="ing-btn small danger" disabled={busy} onClick={() => act(() => post({ action: "desfazer" }), "Venda desfeita.")}>Desfazer venda</button> : null}
          </div>
        </>
      ) : null}

      <div className="ing-tickets">
        {tickets.map((t) => (
          <div key={t.id} className="ing-ticket">
            <small className="ing-muted">Ticket {t.number} de {sale.quantity}</small>
            <Qr text={`${QR_PREFIX}${t.token}`} size={120} alt={`QR do ticket ${t.code}`} />
            <span className="code">{t.code}</span>
            {t.delivered_at
              ? <small>Entregue {manausDateTime(t.delivered_at).time}{t.delivered_by_name ? ` · ${t.delivered_by_name}` : ""}</small>
              : <small className="ing-muted">A retirar</small>}
            {t.delivered_at && can.undo_delivery ? (
              <button type="button" className="ing-btn small danger" disabled={busy} onClick={() => act(() => api(`/api/ingressos/tickets/${t.id}`, { method: "DELETE" }), "Entrega desfeita.")}>Desfazer entrega</button>
            ) : null}
          </div>
        ))}
      </div>

      <div className="ing-card">
        <div className="ing-money-line"><span>Total ({sale.quantity} × {brl(sale.unit_price_cents)})</span><b>{brl(sale.total_cents)}</b></div>
        <div className="ing-money-line"><span>Recebido</span><b>{brl(sale.paid_cents)}</b></div>
        <div className="ing-money-line"><span>Saldo</span><b>{brl(sale.balance_cents)}</b></div>
        {sale.due_date && sale.balance_cents > 0 ? <div className="ing-money-line"><span>Vencimento</span><b>{shortDate(sale.due_date, true)} · {dueLabel(sale.due_date, today)}</b></div> : null}
        {can.edit_due ? (
          due === null
            ? <button type="button" className="ing-btn small" onClick={() => setDue(sale.due_date ?? today)}>{sale.due_date ? "Mudar vencimento" : "Definir vencimento"}</button>
            : (
              <form className="ing-row" onSubmit={(e) => { e.preventDefault(); void act(async () => { await post({ action: "vencimento", due_date: due }); setDue(null); }, "Vencimento alterado."); }}>
                <input type="date" className="ing-input" value={due} min={today} onChange={(e) => setDue(e.target.value)} aria-label="Novo vencimento" />
                <button className="ing-btn primary small" disabled={busy}>Salvar</button>
              </form>
            )
        ) : null}
        {sale.balance_cents > 0 && sale.buyer_whatsapp && can.pay ? (
          <button type="button" className="ing-btn small" disabled={busy} onClick={() => act(async () => openWhatsapp((await post({ action: "cobrar" })).wa_url))}>Cobrar no WhatsApp</button>
        ) : null}
      </div>

      {can.pay ? (
        <form className="ing-card" onSubmit={(e) => {
          e.preventDefault();
          const cents = parseBRL(amount ?? (sale.balance_cents / 100).toFixed(2).replace(".", ","));
          if (!cents) { setMessage("Informe o valor recebido."); return; }
          void act(async () => { await post({ action: "pagamento", amount_cents: cents, method }); setAmount(null); }, "Baixa registrada.");
        }}>
          <h3>Dar baixa</h3>
          <label className="ing-field">Valor recebido
            <input inputMode="decimal" value={amount ?? (sale.balance_cents / 100).toFixed(2).replace(".", ",")} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <div className="ing-chips" role="group" aria-label="Forma de pagamento">
            <button type="button" aria-pressed={method === "pix"} onClick={() => setMethod("pix")}>Pix</button>
            <button type="button" aria-pressed={method === "dinheiro"} onClick={() => setMethod("dinheiro")}>Dinheiro</button>
          </div>
          <button className="ing-btn primary" disabled={busy}>Dar baixa</button>
        </form>
      ) : null}

      <ErrorBox text={message} />
      {ok ? <div className="success" role="status">{ok}</div> : null}

      {payments.length ? (
        <div className="ing-card">
          <h3>Pagamentos</h3>
          {payments.map((p) => (
            <div key={p.id} className="ing-step" style={{ gap: 6, opacity: p.reversed_at ? 0.6 : 1 }}>
              <div className="ing-money-line">
                <span>{manausDateTime(p.received_at).date} {manausDateTime(p.received_at).time} · {p.method === "pix" ? "Pix" : "Dinheiro"}{p.custody_name ? ` · com ${p.custody_name}` : ""}</span>
                <b style={p.reversed_at ? { textDecoration: "line-through" } : undefined}>{brl(p.amount_cents)}</b>
              </div>
              <small className="ing-muted">por {p.registered_by_name}{p.reversed_at ? ` · estornado: ${p.reverse_reason}` : ""}</small>
              {can.reverse && !p.reversed_at ? (
                reversing === p.id ? (
                  <form className="ing-confirm" onSubmit={(e) => { e.preventDefault(); void act(async () => { await api(`/api/ingressos/pagamentos/${p.id}`, { method: "POST", body: { reason } }); setReversing(null); setReason(""); }, "Pagamento estornado."); }}>
                    <label className="ing-field">Motivo do estorno<input value={reason} onChange={(e) => setReason(e.target.value)} /></label>
                    <div className="ing-row"><button className="ing-btn danger small" disabled={busy}>Confirmar estorno</button><button type="button" className="ing-btn small" onClick={() => setReversing(null)}>Voltar</button></div>
                  </form>
                ) : <button type="button" className="ing-btn small" onClick={() => { setReversing(p.id); setReason(""); }}>Estornar</button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {can.cancel ? (
        cancelling ? (
          <form className="ing-confirm" onSubmit={(e) => { e.preventDefault(); void act(async () => { await post({ action: "cancelar", reason }); setCancelling(false); }, "Venda cancelada."); }}>
            <b>Cancelar esta venda? Os tickets deixam de valer.</b>
            <label className="ing-field">Motivo<input value={reason} onChange={(e) => setReason(e.target.value)} /></label>
            <div className="ing-row"><button className="ing-btn danger" disabled={busy}>Sim, cancelar venda</button><button type="button" className="ing-btn" onClick={() => setCancelling(false)}>Não</button></div>
          </form>
        ) : <button type="button" className="ing-btn danger" onClick={() => { setCancelling(true); setReason(""); }}>Cancelar venda</button>
      ) : null}
    </div>
  );
}
