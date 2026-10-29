"use client";
/* eslint-disable @next/next/no-img-element -- logos e QR gerados na hora (data: ou API própria) */

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import QRCode from "qrcode";
import {
  EVENT_KIND_LABEL, PAYMENT_STATUS_LABEL, formatBRL, shortDate, weekday,
  type EventKind, type EventStatus, type PaymentStatus, type PixKeyType
} from "@/lib/ingressos/regras";

/** Base das telas de Ingressos: contexto (quem opera, evento, meta), chamadas à API e peças comuns. */

export type Permission = "organizador.gerenciar" | "evento.gerenciar" | "meta.gerenciar" | "acesso.gerenciar" | "acerto.registrar"
  | "venda.criar" | "venda.cancelar" | "pagamento.registrar" | "pagamento.estornar" | "ticket.validar" | "ticket.desfazer_entrega"
  | "caixa.ver" | "caixa.exportar";

export type EventInfo = {
  id: string; organizer_id: string; organizer_name: string; organizer_cnpj: string; organizer_whatsapp: string | null; logo_url: string;
  kind: EventKind; name: string; purpose: string; event_date: string; event_time: string; place: string; price_cents: number;
  pix_key_type: PixKeyType; pix_key: string; pix_receiver: string; pix_city: string; reservations_whatsapp: string | null;
  goal_tickets: number | null; status: EventStatus; version: number;
};

export type ModuleContext = {
  mode: "user" | "seller";
  role: "coordenacao" | "equipe" | "consulta" | "trabalhador";
  name: string;
  event: EventInfo | null;
  me: { sold: number; goal: number | null; totals: { pix_cents: number; cash_cents: number; receivable_cents: number } } | null;
  sellers: { id: string; name: string }[];
  can: Record<Permission, boolean>;
};

export type Sale = {
  id: string; event_id: string; buyer_id: string; buyer_name: string; buyer_whatsapp: string | null; seller_id: string; seller_name: string;
  quantity: number; unit_price_cents: number; total_cents: number; due_date: string | null; created_at: string; cancelled_at: string | null;
  cancel_reason: string | null; undone: boolean; paid_cents: number; delivered: number; undo_seconds_left: number; balance_cents: number;
  status: PaymentStatus | "cancelada"; access_ended?: boolean;
};

type Shell = { mode: "user" | "seller"; base: string; ctx: ModuleContext | null; reload: () => Promise<void> };
const ShellContext = createContext<Shell | null>(null);

export function useShell() {
  const shell = useContext(ShellContext);
  if (!shell) throw new Error("Fora do módulo de Ingressos.");
  return shell;
}

export function ShellProvider({ mode, base, children }: { mode: "user" | "seller"; base: string; children: (ctx: ModuleContext | null, error: string) => ReactNode }) {
  const [ctx, setCtx] = useState<ModuleContext | null>(null);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    try {
      setCtx(await call<ModuleContext>(mode, "/api/ingressos/contexto"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
      if ((e as { code?: string }).code === "ACCESS_ENDED") window.location.reload();
    }
  }, [mode]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void reload(); }, [reload]);
  return <ShellContext.Provider value={{ mode, base, ctx, reload }}>{children(ctx, error)}</ShellContext.Provider>;
}

/** fetch JSON; no app do trabalhador vai o cabeçalho que liga a sessão do link. */
export async function call<T>(mode: "user" | "seller", url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: init?.method ?? "GET",
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...(mode === "seller" ? { "X-Ingressos-Modo": "vendedor" } : {}) },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body)
    });
  } catch {
    throw Object.assign(new Error("Sem conexão. Tente de novo."), { code: "OFFLINE" });
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error ?? "Falha na operação. Tente de novo."), { code: body.code as string | undefined });
  return body as T;
}

export function useApi() {
  const { mode } = useShell();
  return useCallback(<T,>(url: string, init?: { method?: string; body?: unknown }) => call<T>(mode, url, init), [mode]);
}

/** Carrega uma URL e recarrega quando pedir. */
export function useLoad<T>(url: string | null) {
  const api = useApi();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!url) return;
    try {
      setData(await api<T>(url));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [api, url]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  return { data, error, reload: load, setData };
}

export const brl = formatBRL;
export const eventWhen = (e: Pick<EventInfo, "event_date" | "event_time">) =>
  `${weekday(e.event_date).replace("-feira", "")}, ${shortDate(e.event_date)}${e.event_time ? ` · ${e.event_time}` : ""}`;
export const kindLabel = (kind: EventKind) => EVENT_KIND_LABEL[kind];

export function Badge({ status }: { status: PaymentStatus | "cancelada" }) {
  return <span className={`ing-badge ${status}`}>{status === "cancelada" ? "Cancelada" : PAYMENT_STATUS_LABEL[status]}</span>;
}

export function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return <div className={`ing-bar${max > 0 && value >= max ? " done" : ""}`} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}><i style={{ width: `${pct}%` }} /></div>;
}

export function ErrorBox({ text }: { text: string }) {
  return text ? <div className="error" role="alert">{text}</div> : null;
}

export function Qr({ text, size = 240, alt }: { text: string; size?: number; alt: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => { void QRCode.toDataURL(text, { margin: 1, width: size, errorCorrectionLevel: "M" }).then(setSrc); }, [text, size]);
  return src ? <img src={src} width={size} height={size} alt={alt} /> : <span style={{ width: size, height: size, display: "block" }} />;
}

export function Top() {
  const { ctx, base, mode } = useShell();
  const event = ctx?.event;
  return (
    <header className="ing-top">
      <img src={event?.logo_url ?? "/marca-lar-da-bencao.png"} alt="" />
      <div className="ing-top-text">
        <strong>{event ? event.name : "Ingressos"}</strong>
        <span>{event ? `${eventWhen(event)} · ${brl(event.price_cents)}${event.status === "closed" ? " · encerrado" : ""}` : "Nenhum evento ativo"}</span>
      </div>
      {mode === "user" && ctx?.can["evento.gerenciar"] ? <Link className="ing-gear" href={`${base}/eventos`} aria-label="Eventos">⚙</Link> : null}
    </header>
  );
}

export function Tabs({ current }: { current: string }) {
  const { ctx, base, mode } = useShell();
  const tabs = mode === "seller"
    ? [{ key: "", label: "Vender", icon: "🎟" }, { key: "minhas", label: "Minhas vendas", icon: "📋" }]
    : [
        ...(ctx?.can["venda.criar"] ? [{ key: "", label: "Vender", icon: "🎟" }] : []),
        ...(ctx?.can["ticket.validar"] ? [{ key: "validar", label: "Validar", icon: "✔" }] : []),
        ...(ctx?.can["caixa.ver"] ? [{ key: "caixa", label: "Caixa", icon: "R$" }] : []),
        ...(ctx?.can["meta.gerenciar"] ? [{ key: "metas", label: "Metas", icon: "🎯" }] : [])
      ];
  if (tabs.length < 2) return null;
  return (
    <nav className="ing-tabs" aria-label="Ingressos">
      {tabs.map((t) => (
        <Link key={t.key} href={t.key ? `${base}/${t.key}` : base} aria-current={current === t.key ? "page" : undefined}>
          <span aria-hidden="true">{t.icon}</span>{t.label}
        </Link>
      ))}
    </nav>
  );
}

/** Abre o WhatsApp na mesma aba (no iPhone, janela nova depois de esperar a rede é bloqueada). */
export function openWhatsapp(url: string | null | undefined) {
  if (url) window.location.href = url;
}

export function vibrate() {
  try { navigator.vibrate?.(60); } catch { /* sem vibração */ }
}

export function NoEvent() {
  const { ctx, base } = useShell();
  return (
    <div className="ing-empty">
      <p>{ctx?.mode === "seller" ? "As vendas deste evento estão encerradas." : "Nenhum evento ativo."}</p>
      {ctx?.can["evento.gerenciar"]
        ? <Link className="ing-btn primary" href={`${base}/eventos/novo`}>Criar evento</Link>
        : ctx?.mode === "user" ? <p>Peça à coordenação para criar um.</p> : null}
    </div>
  );
}
