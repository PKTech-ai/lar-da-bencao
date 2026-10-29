"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bar, ErrorBox, NoEvent, brl, openWhatsapp, useApi, useLoad, useShell, type EventInfo } from "@/components/ingressos/base";
import {
  ACCESS_STATE_LABEL, DEFAULT_ACCESS_DAYS, addDays, formatWhatsapp, manausDateTime, parseBRL, shortDate, todayManaus, type AccessState
} from "@/lib/ingressos/regras";

type SellerRow = {
  seller_id: string; name: string; whatsapp: string | null; is_user: boolean; goal: number | null; sold: number; percent: number | null; reached: boolean;
  pix_cents: number; in_hands_cents: number; receivable_cents: number; access: { valid_until: string } | null; access_state: AccessState; removed: boolean;
};
type Panel = {
  event: EventInfo; days_to_event: number; distributed: number; sold_total: number;
  pix_cents: number; in_hands_cents: number; receivable_cents: number; sellers: SellerRow[];
};

function accessText(s: { access_state: AccessState; access: { valid_until: string } | null }) {
  return s.access_state === "ativo" && s.access ? `Ativo · até ${shortDate(s.access.valid_until, true)}` : ACCESS_STATE_LABEL[s.access_state];
}

/** Metas (RF-11) e painel da meta (RF-14). */
export function Metas() {
  const { ctx, base } = useShell();
  const api = useApi();
  const eventId = ctx?.event?.id ?? null;
  const { data, error, reload } = useLoad<Panel>(eventId ? `/api/ingressos/metas/${eventId}` : null);
  const [goals, setGoals] = useState<Record<string, number>>({});
  const [eventGoal, setEventGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!data) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGoals(Object.fromEntries(data.sellers.filter((s) => s.goal).map((s) => [s.seller_id, s.goal as number])));
    setEventGoal(data.event.goal_tickets ? String(data.event.goal_tickets) : "");
  }, [data]);

  if (!ctx) return null;
  if (!ctx.event) return <NoEvent />;
  if (error) return <ErrorBox text={error} />;
  if (!data) return <p className="ing-muted">Carregando…</p>;

  const target = Number(eventGoal) || 0;
  const distributed = Object.values(goals).reduce((s, g) => s + g, 0);
  const listed = data.sellers.filter((s) => !s.removed);

  async function run(work: () => Promise<unknown>, done?: string) {
    setBusy(true);
    setMessage("");
    setOk("");
    try { await work(); await reload(); if (done) setOk(done); } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  }
  const sellerPost = (sellerId: string, body: object) =>
    api<{ wa_url?: string }>(`/api/ingressos/metas/${data.event.id}/${sellerId}`, { method: "POST", body });

  return (
    <div className="ing-step">
      <div className="ing-card">
        <p style={{ fontSize: 20 }}><b>{data.sold_total} de {data.event.goal_tickets ?? "—"}</b> ingressos</p>
        {data.event.goal_tickets ? <Bar value={data.sold_total} max={data.event.goal_tickets} /> : null}
        <p className="ing-muted">
          {data.event.goal_tickets ? `${Math.round((data.sold_total / data.event.goal_tickets) * 100)}% · ` : ""}
          {data.days_to_event > 0 ? `faltam ${data.days_to_event} dias para o evento` : data.days_to_event === 0 ? "o evento é hoje" : "o evento já passou"}
        </p>
        <div className="ing-kpis" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          <div className="ing-kpi"><span>Pix na conta</span><b style={{ fontSize: 17 }}>{brl(data.pix_cents)}</b></div>
          <div className="ing-kpi"><span>Em mãos</span><b style={{ fontSize: 17 }}>{brl(data.in_hands_cents)}</b></div>
          <div className="ing-kpi"><span>A receber</span><b style={{ fontSize: 17 }}>{brl(data.receivable_cents)}</b></div>
        </div>
      </div>

      <div className="ing-list">
        {data.sellers.map((s) => (
          <div key={s.seller_id} className="ing-card">
            <Link href={`${base}/metas/${s.seller_id}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div className="ing-money-line"><b>{s.name}</b><span>{s.sold} / {s.goal ?? "—"}</span></div>
            </Link>
            {s.goal ? <Bar value={s.sold} max={s.goal} /> : null}
            <small className="ing-muted">
              {s.is_user && s.access_state === "nao_enviado"
                ? <span className="ing-badge closed">Usuário do sistema</span>
                : <span className={`ing-badge ${s.access_state}`}>{accessText(s)}</span>}
              {s.in_hands_cents ? ` · em mãos ${brl(s.in_hands_cents)}` : ""}{s.removed ? " · fora da lista de metas" : ""}
            </small>
            <div className="ing-row">
              {s.in_hands_cents ? <Link className="ing-btn small" href={`${base}/metas/${s.seller_id}#acerto`}>Acerto</Link> : null}
              {s.goal && s.sold < s.goal && s.whatsapp ? (
                <button type="button" className="ing-btn small" disabled={busy} onClick={() => run(async () => openWhatsapp((await sellerPost(s.seller_id, { action: "lembrar" })).wa_url))}>Lembrar</button>
              ) : null}
              {!s.removed ? (
                <div className="ing-stepper" aria-label={`Meta de ${s.name}`}>
                  <button type="button" aria-label="Diminuir meta" onClick={() => setGoals({ ...goals, [s.seller_id]: Math.max(1, (goals[s.seller_id] ?? 1) - 1) })}>−</button>
                  <input inputMode="numeric" aria-label="Meta" value={goals[s.seller_id] ?? ""} onChange={(e) => setGoals({ ...goals, [s.seller_id]: Math.min(999, Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1)) })} />
                  <button type="button" aria-label="Aumentar meta" onClick={() => setGoals({ ...goals, [s.seller_id]: Math.min(999, (goals[s.seller_id] ?? 0) + 1) })}>+</button>
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {!data.sellers.length ? <p className="ing-muted">Nenhum trabalhador ainda. Adicione quem vai vender.</p> : null}
      </div>

      <div className="ing-card">
        <label className="ing-field">Meta do evento (ingressos)
          <input inputMode="numeric" value={eventGoal} onChange={(e) => setEventGoal(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Ex.: 300" />
        </label>
        <p>Distribuído <b>{distributed} de {target || "—"}</b></p>
        {target ? <Bar value={distributed} max={target} /> : null}
        {target ? <p className="ing-muted">{distributed <= target ? `Faltam ${target - distributed} para distribuir` : `${distributed - target} acima da meta`}</p> : null}
        <button type="button" className="ing-btn primary" disabled={busy} onClick={() => run(() => api(`/api/ingressos/metas/${data.event.id}`, {
          method: "PUT", body: { goal_tickets: target || null, goals: listed.filter((s) => goals[s.seller_id]).map((s) => ({ seller_id: s.seller_id, goal: goals[s.seller_id] })) }
        }), "Metas salvas.")}>Salvar metas</button>
      </div>

      <ErrorBox text={message} />
      {ok ? <div className="success" role="status">{ok}</div> : null}
      {adding ? <AddSeller eventId={data.event.id} onDone={() => { setAdding(false); void reload(); }} /> : (
        <button type="button" className="ing-btn" onClick={() => setAdding(true)}>+ Adicionar trabalhador</button>
      )}
    </div>
  );
}

function AddSeller({ eventId, onDone }: { eventId: string; onDone: () => void }) {
  const api = useApi();
  const [q, setQ] = useState("");
  const [workers, setWorkers] = useState<{ id: string; full_name: string; phone: string | null }[]>([]);
  const [manual, setManual] = useState({ name: "", whatsapp: "" });
  const [goal, setGoal] = useState("10");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    if (q.trim().length < 2) return;
    const timer = window.setTimeout(() => {
      void api<{ workers: typeof workers }>(`/api/ingressos/trabalhadores?q=${encodeURIComponent(q.trim())}`).then((r) => { if (active) setWorkers(r.workers); }).catch(() => undefined);
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [api, q]);

  async function add(body: object) {
    setBusy(true);
    setError("");
    try {
      await api(`/api/ingressos/metas/${eventId}`, { method: "POST", body: { ...body, goal: Number(goal) || 10 } });
      onDone();
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  return (
    <div className="ing-card">
      <h3>Adicionar trabalhador</h3>
      <label className="ing-field">Meta<input inputMode="numeric" value={goal} onChange={(e) => setGoal(e.target.value.replace(/\D/g, "").slice(0, 3))} /></label>
      <label className="ing-field">Procurar no cadastro da Casa<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome do trabalhador" /></label>
      <div className="ing-list">
        {(q.trim().length < 2 ? [] : workers).map((w) => (
          <button key={w.id} type="button" className="ing-item" disabled={busy} onClick={() => add({ worker_id: w.id })}>
            <span className="grow">{w.full_name}<small>{w.phone ?? "sem telefone na ficha"}</small></span><span aria-hidden="true">+</span>
          </button>
        ))}
      </div>
      <p className="ing-muted">Não está no cadastro? Informe nome e WhatsApp:</p>
      <label className="ing-field">Nome e sobrenome<input value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} /></label>
      <label className="ing-field">WhatsApp com DDD<input inputMode="tel" value={manual.whatsapp} onChange={(e) => setManual({ ...manual, whatsapp: e.target.value })} /></label>
      <ErrorBox text={error} />
      <div className="ing-row">
        <button type="button" className="ing-btn primary small" disabled={busy || !manual.name} onClick={() => add(manual)}>Adicionar</button>
        <button type="button" className="ing-btn small" onClick={onDone}>Fechar</button>
      </div>
    </div>
  );
}

type SellerDetail = {
  event: EventInfo; seller: { id: string; name: string; whatsapp: string | null };
  sold: number; goal: number | null; totals: { pix_cents: number; cash_cents: number; settled_cents: number; receivable_cents: number };
  sales: { id: string; total_cents: number; cancelled_at: string | null }[];
  settlements: { id: string; amount_cents: number; received_at: string; received_by_name: string; note: string }[];
  access: { valid_until: string; first_access_at: string | null; last_access_at: string | null } | null; access_state: AccessState;
};

/** Detalhe do trabalhador: acesso temporário (RF-12) e acerto (RF-13). */
export function Trabalhador({ sellerId }: { sellerId: string }) {
  const { ctx, base } = useShell();
  const api = useApi();
  const eventId = ctx?.event?.id ?? null;
  const { data, error, reload } = useLoad<SellerDetail>(eventId ? `/api/ingressos/metas/${eventId}/${sellerId}` : null);
  const today = todayManaus();
  const [days, setDays] = useState<number | "outra">(DEFAULT_ACCESS_DAYS);
  const [validUntil, setValidUntil] = useState(addDays(today, DEFAULT_ACCESS_DAYS));
  const [amount, setAmount] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState("");
  const [confirmBlock, setConfirmBlock] = useState(false);

  if (!ctx) return null;
  if (!ctx.event) return <NoEvent />;
  if (error) return <ErrorBox text={error} />;
  if (!data) return <p className="ing-muted">Carregando…</p>;

  async function run(work: () => Promise<unknown>, done?: string) {
    setBusy(true);
    setMessage("");
    setOk("");
    try { await work(); await reload(); if (done) setOk(done); } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  }
  const post = (body: object) => api<{ wa_url?: string }>(`/api/ingressos/metas/${data.event.id}/${sellerId}`, { method: "POST", body });
  const chooseDays = (value: number | "outra") => { setDays(value); if (value !== "outra") setValidUntil(addDays(today, value)); };
  const total = data.sales.filter((s) => !s.cancelled_at).reduce((s, v) => s + v.total_cents, 0);
  const hasAccess = data.access_state === "enviado" || data.access_state === "ativo";

  return (
    <div className="ing-step">
      <Link className="ing-back" href={`${base}/metas`}>← Metas</Link>
      <div className="ing-card">
        <h2 style={{ fontSize: 22 }}>{data.seller.name}</h2>
        <p className="ing-muted">{data.seller.whatsapp ? formatWhatsapp(data.seller.whatsapp) : "Sem WhatsApp"} · meta {data.goal ?? "—"} · vendeu {data.sold}</p>
        <p><span className={`ing-badge ${data.access_state}`}>{data.access_state === "ativo" && data.access ? `Ativo · até ${shortDate(data.access.valid_until, true)}` : ACCESS_STATE_LABEL[data.access_state]}</span></p>
      </div>

      <div className="ing-card">
        <h3>Acesso pelo celular</h3>
        <div className="ing-chips" role="group" aria-label="Validade do acesso">
          {[30, 60, 90].map((d) => <button key={d} type="button" aria-pressed={days === d} onClick={() => chooseDays(d)}>{d} dias</button>)}
          <button type="button" aria-pressed={days === "outra"} onClick={() => chooseDays("outra")}>Outra data</button>
        </div>
        <label className="ing-field">Válido até
          <input type="date" value={validUntil} min={today} onChange={(e) => { setDays("outra"); setValidUntil(e.target.value); }} />
        </label>
        <p className="ing-muted">O acesso encerra sozinho às 23:59 de {shortDate(validUntil, true)}.</p>
        {!hasAccess ? (
          <button type="button" className="ing-btn green" disabled={busy || !data.seller.whatsapp} onClick={() => run(async () => openWhatsapp((await post({ action: "enviar", valid_until: validUntil })).wa_url))}>
            Enviar acesso pelo WhatsApp
          </button>
        ) : (
          <>
            <button type="button" className="ing-btn" disabled={busy} onClick={() => run(() => post({ action: "prorrogar", valid_until: validUntil }), "Validade alterada.")}>Prorrogar até {shortDate(validUntil)}</button>
            <button type="button" className="ing-btn" disabled={busy} onClick={() => run(async () => openWhatsapp((await post({ action: "enviar", valid_until: validUntil })).wa_url))}>Reenviar (novo link e novo PIN)</button>
            {confirmBlock ? (
              <div className="ing-confirm">
                <b>Bloquear o acesso agora? O link para de funcionar na hora.</b>
                <div className="ing-row">
                  <button type="button" className="ing-btn danger" disabled={busy} onClick={() => run(async () => { await post({ action: "bloquear" }); setConfirmBlock(false); }, "Acesso bloqueado.")}>Sim, bloquear</button>
                  <button type="button" className="ing-btn" onClick={() => setConfirmBlock(false)}>Não</button>
                </div>
              </div>
            ) : <button type="button" className="ing-btn danger" onClick={() => setConfirmBlock(true)}>Bloquear</button>}
          </>
        )}
        {data.access?.last_access_at ? <small className="ing-muted">Último acesso: {manausDateTime(data.access.last_access_at).fullDate} {manausDateTime(data.access.last_access_at).time}</small> : null}
      </div>

      <div className="ing-card" id="acerto">
        <h3>Acerto</h3>
        <div className="ing-money-line"><span>Vendidos</span><b>{data.sold} · {brl(total)}</b></div>
        <div className="ing-money-line"><span>Pix na conta da Casa</span><b>{brl(data.totals.pix_cents)}</b></div>
        <div className="ing-money-line"><span>Dinheiro em mãos</span><b>{brl(data.totals.cash_cents)}</b></div>
        <div className="ing-money-line"><span>A receber dos compradores</span><b>{brl(data.totals.receivable_cents)}</b></div>
        {data.totals.cash_cents > 0 && ctx.can["acerto.registrar"] ? (
          <form className="ing-step" onSubmit={(e) => {
            e.preventDefault();
            const cents = parseBRL(amount ?? (data.totals.cash_cents / 100).toFixed(2).replace(".", ","));
            if (!cents) { setMessage("Informe o valor entregue."); return; }
            void run(async () => { await post({ action: "acerto", amount_cents: cents }); setAmount(null); }, "Acerto registrado.");
          }}>
            <label className="ing-field">Valor entregue
              <input inputMode="decimal" value={amount ?? (data.totals.cash_cents / 100).toFixed(2).replace(".", ",")} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <button className="ing-btn primary" disabled={busy}>Registrar acerto de {brl(parseBRL(amount ?? (data.totals.cash_cents / 100).toFixed(2).replace(".", ",")) ?? 0)}</button>
          </form>
        ) : null}
        {data.settlements.map((s) => (
          <small key={s.id} className="ing-muted">{manausDateTime(s.received_at).fullDate} · {brl(s.amount_cents)} recebido por {s.received_by_name}</small>
        ))}
      </div>

      <ErrorBox text={message} />
      {ok ? <div className="success" role="status">{ok}</div> : null}
      {data.goal ? (
        <button type="button" className="ing-btn danger small" disabled={busy} onClick={() => run(() => post({ action: "remover" }), "Retirado da lista. As vendas já feitas continuam registradas.")}>
          Retirar da lista de metas
        </button>
      ) : null}
    </div>
  );
}
