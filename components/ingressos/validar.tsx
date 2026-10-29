"use client";

import { useEffect, useRef, useState } from "react";
import { ErrorBox, NoEvent, brl, useApi, useShell, vibrate } from "@/components/ingressos/base";
import { QrScanner } from "@/components/ingressos/qr-scanner";
import { manausDateTime, shortDate } from "@/lib/ingressos/regras";

type Panel =
  | { state: "nao_encontrado" }
  | { state: "outro_evento"; event_name: string }
  | { state: "cancelado"; code: string; buyer_name: string }
  | { state: "valido" | "pendente" | "utilizado"; ticket_id: string; sale_id: string; code: string; number: number; quantity: number; buyer_name: string;
      balance_cents: number; due_date: string | null; overdue: boolean; delivered_at: string | null; delivered_by_name: string | null; remaining: number };
type NameSale = { sale_id: string; buyer_name: string; quantity: number; tickets: { id: string; code: string; number: number; delivered_at: string | null }[] };
type Lookup =
  | { kind: "ticket"; panel: Panel; counter: Counter }
  | { kind: "names"; sales: NameSale[]; counter: Counter }
  | { kind: "empty"; counter: Counter };
type Counter = { delivered: number; sold: number };
type Delivered = { delivered: boolean; panel: Panel; next_ticket_id?: string | null };

/** Tela Validar (RF-08): código, QR ou nome → painel colorido → Entregar refeição. */
export function Validar() {
  const { ctx } = useShell();
  const api = useApi();
  const [text, setText] = useState("");
  const [result, setResult] = useState<Lookup | null>(null);
  const [delivered, setDelivered] = useState<{ panel: Panel; nextId: string | null } | null>(null);
  const [counter, setCounter] = useState<Counter | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (!ctx?.event || ctx.event.status !== "active") return;
    void api<Lookup>("/api/ingressos/validar?q=").then((r) => setCounter(r.counter)).catch(() => undefined);
  }, [api, ctx?.event]);

  async function search(value: string) {
    const id = ++seq.current;
    setDelivered(null);
    setError("");
    const clean = value.trim();
    if (clean.length < 2) { setResult(null); return; }
    try {
      const r = await api<Lookup>(`/api/ingressos/validar?q=${encodeURIComponent(clean)}`);
      if (id !== seq.current) return;
      setResult(r);
      setCounter(r.counter);
    } catch (e) { if (id === seq.current) setError((e as Error).message); }
  }

  function onType(value: string) {
    setText(value);
    const compact = value.replace(/[^A-Za-z0-9]/g, "");
    // Código completo (4 caracteres) ou nome com 2+ letras.
    if (compact.length === 4 || value.trim().length >= 2) void search(value);
    else { setResult(null); setDelivered(null); }
  }

  async function deliver(ticketId: string) {
    setBusy(true);
    setError("");
    try {
      const r = await api<Delivered>(`/api/ingressos/tickets/${ticketId}`, { method: "POST" });
      if (r.delivered) {
        vibrate();
        setDelivered({ panel: r.panel, nextId: r.next_ticket_id ?? null });
        setCounter((c) => (c ? { ...c, delivered: c.delivered + 1 } : c));
      } else {
        setResult({ kind: "ticket", panel: r.panel, counter: counter ?? { delivered: 0, sold: 0 } });
      }
    } catch (e) {
      // Sem confirmação do servidor nunca marca entrega.
      setError((e as { code?: string }).code === "OFFLINE" ? "Sem conexão. Tente de novo." : (e as Error).message);
    } finally { setBusy(false); }
  }

  function next() {
    setText("");
    setResult(null);
    setDelivered(null);
    setError("");
    input.current?.focus();
  }

  async function undo(ticketId: string) {
    setBusy(true);
    try {
      await api(`/api/ingressos/tickets/${ticketId}`, { method: "DELETE" });
      await search(text);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  if (!ctx) return null;
  if (!ctx.event || ctx.event.status !== "active") return <NoEvent />;

  return (
    <div className="ing-step">
      <label className="ing-field">Código ou nome
        <input ref={input} className="ing-input" autoFocus autoComplete="off" autoCapitalize="characters" spellCheck={false}
          placeholder="Ex.: K7Q3 ou Rosa" value={text} onChange={(e) => onType(e.target.value)} />
      </label>
      {scanning
        ? <QrScanner onResult={(value) => { setScanning(false); setText(""); void search(value); }} onClose={() => setScanning(false)} />
        : <button type="button" className="ing-btn" onClick={() => setScanning(true)}>📷 Ler QR</button>}
      <ErrorBox text={error} />

      {delivered ? (
        <DeliveredPanel panel={delivered.panel} nextId={delivered.nextId} busy={busy} onMore={deliver} onNext={next} />
      ) : result?.kind === "ticket" ? (
        <StatusPanel panel={result.panel} busy={busy} onDeliver={deliver} onUndo={ctx.can["ticket.desfazer_entrega"] ? undo : undefined} />
      ) : result?.kind === "names" ? (
        <div className="ing-list">
          {!result.sales.length ? <p className="ing-muted">Nenhum comprador com esse nome neste evento.</p> : null}
          {result.sales.map((s) => (
            <div key={s.sale_id} className="ing-card">
              <b style={{ fontSize: 18 }}>{s.buyer_name}</b>
              <div className="ing-chips">
                {s.tickets.map((t) => t.delivered_at
                  ? <button key={t.id} type="button" className="ing-chipcode used" disabled aria-label={`${t.code} já entregue`}>{t.code}</button>
                  : <button key={t.id} type="button" className="ing-chipcode" disabled={busy} onClick={() => deliver(t.id)}>Entregar {t.code}</button>)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="ing-empty">Digite o código de 4 caracteres do ticket, ou procure pelo nome do cliente.</p>
      )}
      {counter ? <p className="ing-muted" style={{ textAlign: "center", fontSize: 17 }}><b>{counter.delivered} de {counter.sold}</b> refeições entregues</p> : null}
    </div>
  );
}

function StatusPanel({ panel, busy, onDeliver, onUndo }: { panel: Panel; busy: boolean; onDeliver: (id: string) => void; onUndo?: (id: string) => void }) {
  if (panel.state === "nao_encontrado") {
    return <div className="ing-status red" role="status"><h2>NÃO ENCONTRADO</h2><p>Confira as letras com o cliente ou procure pelo nome.</p></div>;
  }
  if (panel.state === "outro_evento") return <div className="ing-status red" role="status"><h2>TICKET DE OUTRO EVENTO</h2><p>{panel.event_name}</p></div>;
  if (panel.state === "cancelado") return <div className="ing-status red" role="status"><h2>TICKET CANCELADO</h2><p className="code">{panel.code}</p><p>{panel.buyer_name}</p></div>;
  if (panel.state === "utilizado") {
    const when = panel.delivered_at ? manausDateTime(panel.delivered_at) : null;
    return (
      <div className="ing-status red" role="status">
        <h2>JÁ UTILIZADO</h2>
        <p className="code">{panel.code}</p>
        <p>{panel.buyer_name}</p>
        {when ? <p>Entregue em {when.date} às {when.time}{panel.delivered_by_name ? ` por ${panel.delivered_by_name}` : ""}</p> : null}
        {onUndo ? <button type="button" className="ing-btn danger small" disabled={busy} onClick={() => onUndo(panel.ticket_id)}>Desfazer entrega</button> : null}
      </div>
    );
  }
  const pending = panel.state === "pendente";
  return (
    <div className={`ing-status ${pending ? "yellow" : "green"}`} role="status">
      <h2>VÁLIDO</h2>
      <p className="code">{panel.code}</p>
      <p><b>{panel.buyer_name}</b> · ticket {panel.number} de {panel.quantity}</p>
      {pending ? <p>Pagamento pendente · saldo {brl(panel.balance_cents)}{panel.due_date ? ` · ${panel.overdue ? "venceu" : "vence"} ${shortDate(panel.due_date)}` : ""}</p> : null}
      <button type="button" className="ing-btn green" disabled={busy} onClick={() => onDeliver(panel.ticket_id)}>{busy ? "Entregando…" : "Entregar refeição"}</button>
    </div>
  );
}

function DeliveredPanel({ panel, nextId, busy, onMore, onNext }: { panel: Panel; nextId: string | null; busy: boolean; onMore: (id: string) => void; onNext: () => void }) {
  const remaining = "remaining" in panel ? panel.remaining : 0;
  return (
    <div className="ing-step">
      <div className="ing-status green" role="status">
        <h2>ENTREGUE</h2>
        {"code" in panel ? <p className="code">{panel.code}</p> : null}
        {"buyer_name" in panel ? <p>{panel.buyer_name}{"number" in panel ? ` · ticket ${panel.number} de ${panel.quantity}` : ""}</p> : null}
      </div>
      {nextId && remaining > 0 ? <button type="button" className="ing-btn green" disabled={busy} onClick={() => onMore(nextId)}>Entregar mais um (faltam {remaining})</button> : null}
      <button type="button" className="ing-btn primary" onClick={onNext}>Próximo cliente</button>
    </div>
  );
}
