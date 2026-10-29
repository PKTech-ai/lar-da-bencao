"use client";
/* eslint-disable @next/next/no-img-element -- logos do organizador (API própria ou prévia local) */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ErrorBox, brl, kindLabel, useApi, useLoad, useShell, type EventInfo } from "@/components/ingressos/base";
import { ArteEvento } from "@/components/ingressos/arte";
import {
  EVENT_KINDS, EVENT_NAME_SUGGESTION, EVENT_STATUS_LABEL, PIX_KEY_LABEL, PIX_KEY_TYPES, formatCnpj, formatWhatsapp, isValidCnpj,
  parseBRL, shortDate, type EventKind, type PixKeyType
} from "@/lib/ingressos/regras";

type EventListRow = EventInfo & { sold: number; sales: number };
type Organizer = { id: string; name: string; cnpj: string; whatsapp: string | null; logo_url: string; version: number };

/** Lista de eventos (só Coordenação). Toque ativa ou abre o evento. */
export function Eventos() {
  const { base, reload: reloadCtx } = useShell();
  const api = useApi();
  const { data, error, reload } = useLoad<{ events: EventListRow[] }>("/api/ingressos/eventos");
  const [message, setMessage] = useState("");
  if (error) return <ErrorBox text={error} />;
  if (!data) return <p className="ing-muted">Carregando…</p>;

  async function activate(id: string) {
    setMessage("");
    try {
      await api(`/api/ingressos/eventos/${id}`, { method: "POST", body: { action: "ativar" } });
      await Promise.all([reload(), reloadCtx()]);
    } catch (e) { setMessage((e as Error).message); }
  }

  return (
    <div className="ing-step">
      <Link className="ing-back" href={base}>← Voltar</Link>
      <h2 className="ing-question">Eventos</h2>
      <Link className="ing-btn primary" href={`${base}/eventos/novo`}>+ Novo evento</Link>
      <ErrorBox text={message} />
      <div className="ing-list">
        {data.events.map((e) => (
          <div key={e.id} className="ing-card" style={e.status === "active" ? { borderColor: "var(--ing-green-line)", borderWidth: 2 } : undefined}>
            <Link href={`${base}/eventos/${e.id}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div className="ing-money-line"><b>{e.name}</b><span className={`ing-badge ${e.status}`}>{EVENT_STATUS_LABEL[e.status]}</span></div>
              <small className="ing-muted">{shortDate(e.event_date, true)} · {e.sold} vendidos · {brl(e.price_cents)}</small>
            </Link>
            {e.status !== "active" ? <button type="button" className="ing-btn small" onClick={() => activate(e.id)}>Ativar este evento</button> : null}
          </div>
        ))}
        {!data.events.length ? <p className="ing-muted">Nenhum evento ainda.</p> : null}
      </div>
    </div>
  );
}

const emptyForm = {
  organizer_id: "", kind: "feijoada" as EventKind, name: EVENT_NAME_SUGGESTION.feijoada, purpose: "", event_date: "", event_time: "",
  place: "", price: "", pix_key_type: "cnpj" as PixKeyType, pix_key: "", pix_receiver: "", pix_city: "MANAUS", reservations_whatsapp: "", goal_tickets: ""
};

/** Novo / editar evento (RF-02), com o bloco do organizador e a arte de divulgação. */
export function EventoForm({ id }: { id?: string }) {
  const { base, reload: reloadCtx } = useShell();
  const api = useApi();
  const router = useRouter();
  const orgs = useLoad<{ organizers: Organizer[]; suggestion: { name: string; cnpj: string; whatsapp: string } | null }>("/api/ingressos/organizadores");
  const existing = useLoad<{ event: EventInfo & { logo_url: string } }>(id ? `/api/ingressos/eventos/${id}` : null);
  const [form, setForm] = useState(emptyForm);
  const [version, setVersion] = useState<number | undefined>();
  const [editingOrg, setEditingOrg] = useState<Organizer | "novo" | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<"encerrar" | "excluir" | null>(null);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    const e = existing.data?.event;
    if (!e) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      organizer_id: e.organizer_id, kind: e.kind, name: e.name, purpose: e.purpose, event_date: e.event_date, event_time: e.event_time, place: e.place,
      price: (e.price_cents / 100).toFixed(2).replace(".", ","), pix_key_type: e.pix_key_type, pix_key: e.pix_key, pix_receiver: e.pix_receiver,
      pix_city: e.pix_city, reservations_whatsapp: e.reservations_whatsapp ? formatWhatsapp(e.reservations_whatsapp) : "", goal_tickets: e.goal_tickets ? String(e.goal_tickets) : ""
    });
    setVersion(e.version);
  }, [existing.data]);

  const organizers = orgs.data?.organizers ?? [];
  const organizer = organizers.find((o) => o.id === form.organizer_id) ?? (id ? undefined : organizers[0]);
  // Evento novo: chave Pix e recebedor sugeridos a partir do CNPJ e do nome do organizador.
  useEffect(() => {
    if (id || !organizer) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm((f) => ({
      ...f, organizer_id: f.organizer_id || organizer.id,
      pix_key: f.pix_key || formatCnpj(organizer.cnpj), pix_receiver: f.pix_receiver || organizer.name.slice(0, 25)
    }));
  }, [id, organizer]);

  if (orgs.error) return <ErrorBox text={orgs.error} />;
  if (!orgs.data || (id && !existing.data)) return <p className="ing-muted">Carregando…</p>;

  if (editingOrg || !organizers.length) {
    return (
      <OrganizerForm organizer={editingOrg === "novo" || !editingOrg ? null : editingOrg} suggestion={orgs.data.suggestion}
        canCancel={organizers.length > 0} onDone={async (newId) => {
          await orgs.reload();
          if (newId) set({ organizer_id: newId });
          setEditingOrg(null);
        }} />
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const price = parseBRL(form.price);
    if (!price) { setError("Informe o valor do ticket."); return; }
    setBusy(true);
    setError("");
    try {
      const body = {
        organizer_id: form.organizer_id, kind: form.kind, name: form.name, purpose: form.purpose, event_date: form.event_date, event_time: form.event_time,
        place: form.place, price_cents: price, pix_key_type: form.pix_key_type, pix_key: form.pix_key, pix_receiver: form.pix_receiver, pix_city: form.pix_city,
        reservations_whatsapp: form.reservations_whatsapp, goal_tickets: form.goal_tickets ? Number(form.goal_tickets) : null, version
      };
      const saved = await api<{ id: string }>(id ? `/api/ingressos/eventos/${id}` : "/api/ingressos/eventos", { method: id ? "PUT" : "POST", body });
      await reloadCtx();
      if (id) { await existing.reload(); setBusy(false); } else router.push(`${base}/eventos/${saved.id}#arte`);
    } catch (err) { setError((err as Error).message); setBusy(false); }
  }

  async function status(action: "ativar" | "encerrar" | "excluir") {
    if (!id) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/ingressos/eventos/${id}`, { method: "POST", body: { action } });
      await reloadCtx();
      if (action === "excluir") router.push(`${base}/eventos`);
      else { await existing.reload(); setConfirm(null); setBusy(false); }
    } catch (err) { setError((err as Error).message); setBusy(false); }
  }

  const current = existing.data?.event;
  return (
    <div className="ing-step">
      <Link className="ing-back" href={`${base}/eventos`}>← Eventos</Link>
      <h2 className="ing-question">{id ? "Editar evento" : "Novo evento"}</h2>
      {current ? <p><span className={`ing-badge ${current.status}`}>{EVENT_STATUS_LABEL[current.status]}</span></p> : null}
      <form className="ing-step" onSubmit={submit}>
        {organizer ? (
          <div className="ing-card" style={{ gridTemplateColumns: "56px 1fr auto", alignItems: "center", display: "grid" }}>
            <img src={organizer.logo_url} alt="" width={56} height={56} style={{ borderRadius: "50%", objectFit: "contain", background: "#fff" }} />
            <div><b>{organizer.name}</b><br /><small className="ing-muted">CNPJ {formatCnpj(organizer.cnpj)}</small></div>
            <button type="button" className="ing-btn small" onClick={() => setEditingOrg(organizer)}>Editar</button>
          </div>
        ) : null}
        {organizers.length > 1 ? (
          <label className="ing-field">Organizador
            <select value={form.organizer_id} onChange={(e) => set({ organizer_id: e.target.value })}>
              {organizers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
        ) : null}
        <button type="button" className="ing-links" style={{ justifyContent: "flex-start", border: 0, background: "none", padding: 0 }} onClick={() => setEditingOrg("novo")}>
          <span style={{ color: "var(--blue-700)", textDecoration: "underline", fontWeight: 700 }}>Trocar: cadastrar outro organizador</span>
        </button>
        <fieldset className="ing-field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend>Tipo</legend>
          <div className="ing-chips">
            {EVENT_KINDS.map((k) => (
              <button key={k} type="button" aria-pressed={form.kind === k} onClick={() => set({
                kind: k, name: !form.name || Object.values(EVENT_NAME_SUGGESTION).includes(form.name) ? EVENT_NAME_SUGGESTION[k] : form.name
              })}>{kindLabel(k)}</button>
            ))}
          </div>
        </fieldset>
        <label className="ing-field">Nome do evento<input maxLength={60} value={form.name} onChange={(e) => set({ name: e.target.value })} required /></label>
        <label className="ing-field">Finalidade<textarea maxLength={140} rows={2} value={form.purpose} onChange={(e) => set({ purpose: e.target.value })}
          placeholder="Ex.: Angariar fundos para os brinquedos das crianças no fim de ano" required /></label>
        <small className="ing-muted">{form.purpose.length}/140</small>
        <div className="ing-row">
          <label className="ing-field">Data<input type="date" value={form.event_date} onChange={(e) => set({ event_date: e.target.value })} required /></label>
          <label className="ing-field">Horário<input type="time" value={form.event_time} onChange={(e) => set({ event_time: e.target.value })} /></label>
        </div>
        <label className="ing-field">Local<input maxLength={80} value={form.place} onChange={(e) => set({ place: e.target.value })} /></label>
        <label className="ing-field">Valor do ticket (R$)<input inputMode="decimal" value={form.price} onChange={(e) => set({ price: e.target.value })} placeholder="30,00" required /></label>
        <div className="ing-row">
          <label className="ing-field">Tipo da chave Pix
            <select value={form.pix_key_type} onChange={(e) => set({ pix_key_type: e.target.value as PixKeyType })}>
              {PIX_KEY_TYPES.map((t) => <option key={t} value={t}>{PIX_KEY_LABEL[t]}</option>)}
            </select>
          </label>
          <label className="ing-field">Chave Pix<input value={form.pix_key} onChange={(e) => set({ pix_key: e.target.value })} required /></label>
        </div>
        <div className="ing-row">
          <label className="ing-field">Nome do recebedor Pix<input maxLength={25} value={form.pix_receiver} onChange={(e) => set({ pix_receiver: e.target.value })} /></label>
          <label className="ing-field">Cidade<input maxLength={15} value={form.pix_city} onChange={(e) => set({ pix_city: e.target.value })} /></label>
        </div>
        <label className="ing-field">WhatsApp para reservas (opcional)
          <input inputMode="tel" value={form.reservations_whatsapp} onChange={(e) => set({ reservations_whatsapp: e.target.value })}
            placeholder={organizer?.whatsapp ? formatWhatsapp(organizer.whatsapp) : "(92) 99999-0000"} />
        </label>
        <label className="ing-field">Meta do evento (ingressos, opcional)<input inputMode="numeric" value={form.goal_tickets} onChange={(e) => set({ goal_tickets: e.target.value.replace(/\D/g, "").slice(0, 6) })} /></label>
        <ErrorBox text={error} />
        <button className="ing-btn primary" type="submit" disabled={busy}>{busy ? "Gravando…" : id ? "Salvar e refazer a arte" : "Criar evento e gerar arte"}</button>
      </form>

      {current ? (
        <>
          <div id="arte"><ArteEvento event={current} /></div>
          <div className="ing-card">
            <h3>Situação</h3>
            {current.status !== "active" ? <button type="button" className="ing-btn green" disabled={busy} onClick={() => status("ativar")}>Ativar este evento</button> : null}
            {current.status === "active" ? (
              confirm === "encerrar" ? (
                <div className="ing-confirm">
                  <b>Encerrar? Novas vendas e entregas param. As baixas continuam.</b>
                  <div className="ing-row"><button type="button" className="ing-btn danger" disabled={busy} onClick={() => status("encerrar")}>Sim, encerrar</button><button type="button" className="ing-btn" onClick={() => setConfirm(null)}>Não</button></div>
                </div>
              ) : <button type="button" className="ing-btn danger" onClick={() => setConfirm("encerrar")}>Encerrar evento</button>
            ) : null}
            {confirm === "excluir" ? (
              <div className="ing-confirm">
                <b>Excluir o evento? Só é possível se ainda não teve vendas.</b>
                <div className="ing-row"><button type="button" className="ing-btn danger" disabled={busy} onClick={() => status("excluir")}>Sim, excluir</button><button type="button" className="ing-btn" onClick={() => setConfirm(null)}>Não</button></div>
              </div>
            ) : <button type="button" className="ing-btn small danger" onClick={() => setConfirm("excluir")}>Excluir evento</button>}
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Reduz a logo no navegador (máx. 1024 px no maior lado) antes de enviar. */
async function shrinkLogo(file: File) {
  if (!["image/png", "image/jpeg"].includes(file.type)) throw new Error("A logo deve ser PNG ou JPG.");
  if (file.size > 5 * 1024 * 1024) throw new Error("A logo deve ter até 5 MB.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const png = canvas.toDataURL("image/png");
  return png.length < 1_800_000 ? png : canvas.toDataURL("image/jpeg", 0.85);
}

function OrganizerForm({ organizer, suggestion, canCancel, onDone }: {
  organizer: Organizer | null; suggestion: { name: string; cnpj: string; whatsapp: string } | null; canCancel: boolean;
  onDone: (id?: string) => void | Promise<void>;
}) {
  const api = useApi();
  const [form, setForm] = useState({
    name: organizer?.name ?? suggestion?.name ?? "", cnpj: formatCnpj(organizer?.cnpj ?? suggestion?.cnpj ?? ""),
    whatsapp: organizer?.whatsapp ? formatWhatsapp(organizer.whatsapp) : suggestion?.whatsapp ? formatWhatsapp(suggestion.whatsapp) : ""
  });
  const [logo, setLogo] = useState<string | undefined>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidCnpj(form.cnpj)) { setError("CNPJ inválido. Confira os números."); return; }
    setBusy(true);
    setError("");
    try {
      const body = { ...form, logo, version: organizer?.version };
      const saved = await api<{ id: string }>(organizer ? `/api/ingressos/organizadores/${organizer.id}` : "/api/ingressos/organizadores", { method: organizer ? "PUT" : "POST", body });
      await onDone(saved.id);
    } catch (err) { setError((err as Error).message); setBusy(false); }
  }

  return (
    <form className="ing-step" onSubmit={submit}>
      <h2 className="ing-question">{organizer ? "Organizador" : "Quem organiza o evento?"}</h2>
      {!organizer && suggestion ? <p className="ing-muted">Preenchido com os dados da Casa. Confira e salve.</p> : null}
      <label className="ing-field">Nome<input maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
      <label className="ing-field">CNPJ<input inputMode="numeric" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: formatCnpj(e.target.value.replace(/\D/g, "").slice(0, 14)) })} required /></label>
      <label className="ing-field">WhatsApp de contato (opcional)<input inputMode="tel" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></label>
      <label className="ing-field">Logo (PNG ou JPG, até 5 MB)
        <input type="file" accept="image/png,image/jpeg" onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try { setLogo(await shrinkLogo(file)); setError(""); } catch (err) { setError((err as Error).message); }
        }} />
      </label>
      {logo || organizer ? <img src={logo ?? organizer?.logo_url} alt="Logo" width={96} height={96} style={{ borderRadius: "50%", objectFit: "contain", background: "#fff", border: "1px solid var(--line)" }} /> : null}
      <ErrorBox text={error} />
      <button className="ing-btn primary" disabled={busy}>{busy ? "Gravando…" : "Salvar organizador"}</button>
      {canCancel ? <button type="button" className="ing-btn" onClick={() => onDone()}>Voltar</button> : null}
    </form>
  );
}
