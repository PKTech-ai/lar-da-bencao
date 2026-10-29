"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bar, ErrorBox, NoEvent, brl, openWhatsapp, useApi, useLoad, useShell } from "@/components/ingressos/base";
import {
  DEFAULT_DDD, DEFAULT_DUE_DAYS, MAX_TICKETS_PER_SALE, NAME_ERROR, WHATSAPP_ERROR, addDays, normalizeBuyerName, normalizeWhatsapp,
  shortDate, todayManaus
} from "@/lib/ingressos/regras";

type Payment = "pix" | "dinheiro" | "prazo";
type Buyer = { id: string; name: string; whatsapp?: string | null };
type Created = { sale_id: string; wa_url: string | null; no_whatsapp: boolean };

const WA_KEY = (id: string) => `ing-wa:${id}`;

/** Venda em 3 toques (RF-04): quantos → como paga → para quem. Cada toque avança sozinho. */
export function Vender() {
  const { ctx, base, reload } = useShell();
  const api = useApi();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [quantity, setQuantity] = useState(0);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [typingMore, setTypingMore] = useState(false);
  const [more, setMore] = useState("");
  const [error, setError] = useState("");
  const top = useRef<HTMLDivElement>(null);
  const firstStep = useRef(true);
  useEffect(() => {
    if (firstStep.current) { firstStep.current = false; return; }
    top.current?.closest(".ing")?.scrollIntoView({ block: "start" });
  }, [step]);

  if (!ctx) return null;
  const event = ctx.event;
  if (!event || event.status !== "active") return <NoEvent />;
  const price = event.price_cents;
  const due = addDays(todayManaus(), DEFAULT_DUE_DAYS);

  const pick = (n: number) => { setQuantity(n); setTypingMore(false); setStep(2); };
  const goal = ctx.me?.goal;

  async function finish(input: { buyer_id?: string; whatsapp?: string; name?: string; no_whatsapp?: boolean }) {
    setError("");
    const created = await api<Created>("/api/ingressos/vendas", { method: "POST", body: { quantity, payment, ...input } });
    if (created.wa_url) sessionStorage.setItem(WA_KEY(created.sale_id), created.wa_url);
    void reload();
    router.push(`${base}/venda-feita/${created.sale_id}`);
  }

  return (
    <div className="ing-step" ref={top}>
      {step === 1 ? (
        <>
          <div className="ing-hello"><span>Olá, <b>{ctx.name.split(" ")[0]}</b></span>{goal ? <span>Meta: <b>{ctx.me?.sold ?? 0} de {goal}</b></span> : null}</div>
          {goal ? <Bar value={ctx.me?.sold ?? 0} max={goal} /> : null}
          <h2 className="ing-question">Quantos ingressos?</h2>
          <div className="ing-grid3">
            {[1, 2, 3, 4, 5, 6].map((n) => <button key={n} type="button" className="ing-num" onClick={() => pick(n)}>{n}</button>)}
          </div>
          {typingMore ? (
            <form className="ing-row" onSubmit={(e) => {
              e.preventDefault();
              const n = Number(more);
              if (!Number.isInteger(n) || n < 1 || n > MAX_TICKETS_PER_SALE) { setError(`Escolha de 1 a ${MAX_TICKETS_PER_SALE} ingressos.`); return; }
              setError("");
              pick(n);
            }}>
              <label className="ing-field">Quantidade (até {MAX_TICKETS_PER_SALE})
                <input autoFocus inputMode="numeric" pattern="[0-9]*" value={more} onChange={(e) => setMore(e.target.value.replace(/\D/g, "").slice(0, 2))} />
              </label>
              <button className="ing-btn primary" type="submit">Continuar</button>
            </form>
          ) : <button type="button" className="ing-more" onClick={() => setTypingMore(true)}>Mais de 6</button>}
          <ErrorBox text={error} />
          <div className="ing-links">
            {ctx.mode === "seller" ? <Link href={`${base}/minhas`}>Minhas vendas</Link> : <span />}
            <Link href={`${base}/ajuda`}>Ajuda</Link>
          </div>
        </>
      ) : step === 2 ? (
        <>
          <button type="button" className="ing-back" onClick={() => setStep(1)}>← Voltar</button>
          <p className="ing-chosen">{quantity} {quantity === 1 ? "ingresso" : "ingressos"} · {brl(quantity * price)}</p>
          <h2 className="ing-question">Como vai pagar?</h2>
          <button type="button" className="ing-pay pix" onClick={() => { setPayment("pix"); setStep(3); }}>
            <span className="ing-pay-icon" aria-hidden="true">◆</span><span><b>Pix</b><small>Pagou no Pix da Casa</small></span>
          </button>
          <button type="button" className="ing-pay dinheiro" onClick={() => { setPayment("dinheiro"); setStep(3); }}>
            <span className="ing-pay-icon" aria-hidden="true">💵</span><span><b>Dinheiro</b><small>Pagou em mãos</small></span>
          </button>
          <button type="button" className="ing-pay prazo" onClick={() => { setPayment("prazo"); setStep(3); }}>
            <span className="ing-pay-icon" aria-hidden="true">📅</span><span><b>A prazo</b><small>Vai pagar até {shortDate(due)}</small></span>
          </button>
        </>
      ) : (
        <ParaQuem quantity={quantity} price={price} payment={payment as Payment} onBack={() => setStep(2)} onFinish={finish} />
      )}
    </div>
  );
}

function ParaQuem({ quantity, price, payment, onBack, onFinish }: {
  quantity: number; price: number; payment: Payment; onBack: () => void;
  onFinish: (input: { buyer_id?: string; whatsapp?: string; name?: string; no_whatsapp?: boolean }) => Promise<void>;
}) {
  const api = useApi();
  const recent = useLoad<{ recent: Buyer[] }>("/api/ingressos/compradores");
  const [ddd, setDdd] = useState(DEFAULT_DDD);
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [lookup, setLookup] = useState<{ whatsapp: string; buyer: Buyer | null } | null>(null);
  const [noWhatsapp, setNoWhatsapp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const numberRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const whatsapp = normalizeWhatsapp(`${ddd}${number}`);
  // undefined = ainda procurando; null = comprador novo.
  const found = whatsapp && lookup?.whatsapp === whatsapp ? lookup.buyer : undefined;
  const canPickContact = typeof navigator !== "undefined" && "contacts" in navigator && typeof window !== "undefined" && "ContactsManager" in window;

  useEffect(() => {
    let active = true;
    if (!whatsapp) return;
    api<{ buyer: Buyer | null }>(`/api/ingressos/compradores?whatsapp=${whatsapp}`)
      .then((r) => { if (active) { setLookup({ whatsapp, buyer: r.buyer }); if (!r.buyer) setTimeout(() => nameRef.current?.focus(), 50); } })
      .catch(() => { if (active) setLookup({ whatsapp, buyer: null }); });
    return () => { active = false; };
  }, [api, whatsapp]);

  async function run(input: Parameters<typeof onFinish>[0]) {
    setBusy(true);
    setError("");
    try {
      await onFinish(input);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  function submit() {
    if (noWhatsapp) {
      if (!normalizeBuyerName(name)) { setError(NAME_ERROR); return; }
      void run({ no_whatsapp: true, name });
      return;
    }
    if (!whatsapp) { setError(WHATSAPP_ERROR); numberRef.current?.focus(); return; }
    if (found === undefined) return;
    if (!found && !normalizeBuyerName(name)) { setError(NAME_ERROR); nameRef.current?.focus(); return; }
    void run({ whatsapp, name: found ? undefined : name });
  }

  async function fromContacts() {
    try {
      const picked = await (navigator as unknown as { contacts: { select: (p: string[], o: object) => Promise<{ name?: string[]; tel?: string[] }[]> } })
        .contacts.select(["name", "tel"], { multiple: false });
      const contact = picked[0];
      if (!contact) return;
      let digits = (contact.tel?.[0] ?? "").replace(/\D/g, "");
      if (digits.startsWith("55") && digits.length >= 12) digits = digits.slice(2);
      if (digits.startsWith("0")) digits = digits.slice(1);
      if (digits.length >= 10) { setDdd(digits.slice(0, 2)); setNumber(digits.slice(2, 11)); } else setNumber(digits.slice(0, 9));
      if (contact.name?.[0]) setName(contact.name[0]);
      setNoWhatsapp(false);
    } catch { /* cancelado */ }
  }

  return (
    <>
      <button type="button" className="ing-back" onClick={onBack} disabled={busy}>← Voltar</button>
      <p className="ing-chosen">{quantity} {quantity === 1 ? "ingresso" : "ingressos"} · {brl(quantity * price)} · {payment === "pix" ? "Pix" : payment === "dinheiro" ? "Dinheiro" : "A prazo"}</p>
      <h2 className="ing-question">Para quem?</h2>
      {noWhatsapp ? (
        <label className="ing-field">Nome e sobrenome
          <input ref={nameRef} autoFocus autoCapitalize="words" autoComplete="off" placeholder="Ex.: Rosa Lima" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      ) : (
        <>
          <div className="ing-field">
            <span id="ing-wa-label">WhatsApp</span>
            <div className="ing-phone">
              <input aria-label="DDD" inputMode="tel" value={ddd} onChange={(e) => setDdd(e.target.value.replace(/\D/g, "").slice(0, 2))} />
              <input ref={numberRef} aria-labelledby="ing-wa-label" autoFocus inputMode="tel" autoComplete="off" placeholder="9 9999-9999"
                value={number} onChange={(e) => setNumber(e.target.value.replace(/\D/g, "").slice(0, 9))} />
            </div>
          </div>
          {found ? <div className="ing-found" role="status"><b>{found.name}</b> · já comprou antes</div> : null}
          {whatsapp && found === null ? (
            <label className="ing-field">Nome e sobrenome
              <input ref={nameRef} autoCapitalize="words" autoComplete="off" placeholder="Ex.: Rosa Lima" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
          ) : null}
        </>
      )}
      <ErrorBox text={error} />
      <button type="button" className="ing-btn green" disabled={busy} onClick={submit}>{busy ? "Gravando…" : "Pronto"}</button>
      <div className="ing-row">
        {canPickContact && !noWhatsapp ? <button type="button" className="ing-btn small" onClick={fromContacts} disabled={busy}>Da agenda</button> : null}
        {payment !== "prazo" ? (
          <button type="button" className="ing-btn small" disabled={busy} onClick={() => { setNoWhatsapp(!noWhatsapp); setError(""); }}>
            {noWhatsapp ? "Tem WhatsApp" : "Sem WhatsApp"}
          </button>
        ) : null}
      </div>
      {recent.data?.recent.length ? (
        <div className="ing-list">
          <p className="ing-list-title">Compraram com você</p>
          {recent.data.recent.filter((b) => payment !== "prazo" || b.whatsapp).map((b) => (
            <button key={b.id} type="button" className="ing-item" disabled={busy} onClick={() => run({ buyer_id: b.id })}>
              <span className="grow">{b.name}</span><span aria-hidden="true">›</span>
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}

type Detail = {
  sale: { id: string; quantity: number; buyer_name: string; buyer_whatsapp: string | null; undo_seconds_left: number; cancelled_at: string | null; total_cents: number };
  tickets: { code: string }[];
  payments: { method: string; amount_cents: number; custody_name: string | null }[];
  can: { undo: boolean };
};

/** "Venda feita" (RF-06): confirmação, meta atualizada, dinheiro em mãos, desfazer em 2 minutos e reenviar. */
export function VendaFeita({ id }: { id: string }) {
  const { ctx, base, reload } = useShell();
  const api = useApi();
  const { data, error, reload: again } = useLoad<Detail>(`/api/ingressos/vendas/${id}`);
  const [left, setLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  // Link do WhatsApp da venda recém-feita: abre sozinho uma vez e fica num botão-link direto,
  // porque no celular abrir o app por script depois da rede pode falhar.
  const [waUrl] = useState(() => (typeof window === "undefined" ? null : sessionStorage.getItem(WA_KEY(id))));

  useEffect(() => {
    if (!waUrl || sessionStorage.getItem(`${WA_KEY(id)}:aberto`)) return;
    sessionStorage.setItem(`${WA_KEY(id)}:aberto`, "1");
    openWhatsapp(waUrl);
  }, [id, waUrl]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (data) setLeft(data.can.undo ? data.sale.undo_seconds_left : 0); }, [data]);
  useEffect(() => {
    if (!left) return;
    const timer = window.setTimeout(() => setLeft((s) => (s ? s - 1 : 0)), 1000);
    return () => window.clearTimeout(timer);
  }, [left]);

  if (error) return <ErrorBox text={error} />;
  if (!data || !ctx) return <p className="ing-muted">Carregando…</p>;
  const { sale } = data;
  const cash = data.payments.filter((p) => p.method === "dinheiro" && p.custody_name).reduce((s, p) => s + p.amount_cents, 0);

  if (sale.cancelled_at) {
    return (
      <div className="ing-done">
        <h2>Venda desfeita</h2>
        <p>Os ingressos de {sale.buyer_name} foram cancelados.</p>
        <Link className="ing-btn primary" href={base}>Nova venda</Link>
      </div>
    );
  }

  async function undo() {
    setBusy(true);
    try {
      await api(`/api/ingressos/vendas/${id}`, { method: "POST", body: { action: "desfazer" } });
      await Promise.all([again(), reload()]);
    } catch (e) {
      setMessage((e as Error).message);
    } finally { setBusy(false); }
  }

  async function resend() {
    setBusy(true);
    try {
      const r = await api<{ wa_url: string | null }>(`/api/ingressos/vendas/${id}`, { method: "POST", body: { action: "reenviar" } });
      openWhatsapp(r.wa_url);
    } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="ing-step">
      <div className="ing-done">
        <div className="check" aria-hidden="true">✓</div>
        <h2>Venda feita!</h2>
        <p><b>{sale.buyer_name}</b> · {sale.quantity} {sale.quantity === 1 ? "ingresso" : "ingressos"}</p>
        {ctx.me?.goal ? <p>Sua meta: <b>{ctx.me.sold} de {ctx.me.goal}</b></p> : null}
      </div>
      {cash ? <div className="notice">{brl(cash)} em dinheiro ficam com você até o acerto com a coordenação.</div> : null}
      {!sale.buyer_whatsapp ? (
        <>
          <p className="ing-question" style={{ fontSize: 20 }}>Anote os códigos para o comprador</p>
          <div className="ing-bigcodes">{data.tickets.map((t) => <div key={t.code}>{t.code}</div>)}</div>
          <p className="ing-muted">Na entrega, a equipe também encontra pelo nome.</p>
        </>
      ) : null}
      <ErrorBox text={message} />
      <Link className="ing-btn primary" href={base}>Nova venda</Link>
      {sale.buyer_whatsapp ? (
        waUrl
          ? <a className="ing-btn green" href={waUrl}>Enviar no WhatsApp</a>
          : <button type="button" className="ing-btn green" disabled={busy} onClick={resend}>Reenviar no WhatsApp</button>
      ) : null}
      {left ? (
        <button type="button" className="ing-btn danger" disabled={busy} onClick={undo}>
          Desfazer venda ({Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")})
        </button>
      ) : null}
      <Link className="ing-btn small" href={`${base}/venda/${id}`}>Ver detalhe da venda</Link>
    </div>
  );
}

/** Tela completa (Equipe no balcão): tudo numa tela, com "Vendido por". */
export function TelaCompleta() {
  const { ctx, base, reload } = useShell();
  const api = useApi();
  const router = useRouter();
  const [form, setForm] = useState({ quantity: "1", payment: "pix" as Payment, due_date: addDays(todayManaus(), DEFAULT_DUE_DAYS), whatsapp: `${DEFAULT_DDD}`, name: "", seller_id: "", no_whatsapp: false });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!ctx) return null;
  if (!ctx.event || ctx.event.status !== "active") return <NoEvent />;
  const set = (patch: Partial<typeof form>) => setForm({ ...form, ...patch });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const created = await api<Created>("/api/ingressos/vendas", {
        method: "POST",
        body: {
          quantity: Number(form.quantity), payment: form.payment, due_date: form.payment === "prazo" ? form.due_date : undefined,
          whatsapp: form.no_whatsapp ? undefined : form.whatsapp, name: form.name, no_whatsapp: form.no_whatsapp,
          seller_id: form.seller_id || undefined
        }
      });
      if (created.wa_url) sessionStorage.setItem(WA_KEY(created.sale_id), created.wa_url);
      void reload();
      router.push(`${base}/venda-feita/${created.sale_id}`);
    } catch (err) { setError((err as Error).message); setBusy(false); }
  }

  return (
    <form className="ing-step" onSubmit={submit}>
      <Link className="ing-back" href={base}>← Venda em 3 toques</Link>
      <h2 className="ing-question">Tela completa</h2>
      <label className="ing-field">Quantidade
        <input inputMode="numeric" value={form.quantity} onChange={(e) => set({ quantity: e.target.value.replace(/\D/g, "").slice(0, 2) })} />
      </label>
      <label className="ing-field">Pagamento
        <select value={form.payment} onChange={(e) => set({ payment: e.target.value as Payment, no_whatsapp: e.target.value === "prazo" ? false : form.no_whatsapp })}>
          <option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="prazo">A prazo</option>
        </select>
      </label>
      {form.payment === "prazo" ? (
        <label className="ing-field">Vencimento<input type="date" value={form.due_date} min={todayManaus()} onChange={(e) => set({ due_date: e.target.value })} /></label>
      ) : null}
      {!form.no_whatsapp ? (
        <label className="ing-field">WhatsApp com DDD<input inputMode="tel" value={form.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} /></label>
      ) : null}
      <label className="ing-field">Nome e sobrenome (se for novo)
        <input autoCapitalize="words" placeholder="Ex.: Rosa Lima" value={form.name} onChange={(e) => set({ name: e.target.value })} />
      </label>
      {form.payment !== "prazo" ? (
        <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 16 }}>
          <input type="checkbox" style={{ width: 24, minHeight: 24 }} checked={form.no_whatsapp} onChange={(e) => set({ no_whatsapp: e.target.checked })} /> Sem WhatsApp
        </label>
      ) : null}
      <label className="ing-field">Vendido por
        <select value={form.seller_id} onChange={(e) => set({ seller_id: e.target.value })}>
          <option value="">Eu ({ctx.name})</option>
          {ctx.sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <ErrorBox text={error} />
      <button className="ing-btn green" type="submit" disabled={busy}>{busy ? "Gravando…" : "Registrar venda"}</button>
    </form>
  );
}

export function Ajuda() {
  const { ctx, base } = useShell();
  return (
    <div className="ing-step">
      <Link className="ing-back" href={base}>← Voltar</Link>
      <h2 className="ing-question">Ajuda</h2>
      <div className="ing-card">
        <p><b>1.</b> Toque na quantidade de ingressos.</p>
        <p><b>2.</b> Toque em como a pessoa pagou: Pix, Dinheiro ou A prazo.</p>
        <p><b>3.</b> Digite o WhatsApp. Se a pessoa já comprou, o nome aparece sozinho. Se não, escreva nome e sobrenome e toque em <b>Pronto</b>.</p>
        <p>O WhatsApp abre com a mensagem pronta. É só tocar em enviar.</p>
        <p>Errou? Use <b>Desfazer venda</b> nos 2 primeiros minutos.</p>
      </div>
      {ctx?.mode === "user" && ctx.can["venda.criar"] ? <Link className="ing-btn" href={`${base}/completa`}>Tela completa</Link> : null}
    </div>
  );
}
