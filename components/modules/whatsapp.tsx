"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, postJson } from "@/lib/client-api";

type Message = {
  id: string; scope: string; recipient_name: string; phone: string; body: string; consent_source: string;
  status: "Na fila" | "Enviada" | "Cancelada"; created_at: string; sent_at: string | null;
  created_by_name: string | null; sent_by_name: string | null; cancel_reason: string;
};

const maskPhone = (phone: string) => `(${phone.slice(2, 4)}) ****-${phone.slice(-4)}`;

/** Fila de mensagens: o sistema não envia sozinho — abre a conversa e registra o envio. */
export function WhatsappQueue({ scope }: { scope: "tesouraria" | "doutrina" }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api<{ messages: Message[] }>(`/api/whatsapp?scope=${scope}`).then((b) => setMessages(b.messages)).catch((e: Error) => setError(e.message)), [scope]);
  useEffect(() => { void load(); }, [load]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true); setError(""); setMessage("");
    void postJson<{ id: string; phone: string }>("/api/whatsapp", {
      scope, recipient_name: data.get("recipient_name"), phone: data.get("phone"),
      body: data.get("body"), consent: data.get("consent") === "on", consent_source: data.get("consent_source")
    })
      .then(async () => { form.reset(); await load(); setMessage("Mensagem na fila. Abra a conversa quando quiser enviar."); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  }

  function open(item: Message) {
    const url = `https://wa.me/${item.phone}?text=${encodeURIComponent(item.body)}`;
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) { setError("Permita a abertura de nova janela para acessar o WhatsApp."); return; }
    if (window.confirm("Marcar esta mensagem como enviada?")) decide(item, "sent");
  }

  function decide(item: Message, action: "sent" | "cancel") {
    const reason = action === "cancel" ? window.prompt("Motivo do cancelamento:") ?? "" : "";
    if (action === "cancel" && reason.trim().length < 3) return;
    setBusy(true); setError(""); setMessage("");
    void postJson(`/api/whatsapp/${item.id}`, { scope, action, reason })
      .then(async () => { await load(); setMessage(action === "sent" ? "Envio registrado." : "Mensagem cancelada."); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  }

  return (
    <div className="grid">
      <p className="small muted">
        O sistema não envia mensagens sozinho: ele guarda o texto, abre a conversa no WhatsApp e registra quem enviou.
        Só entra na fila quem autorizou receber mensagens, e o consentimento fica registrado.
      </p>
      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}
      <section className="card no-print">
        <h3>Nova mensagem</h3>
        <form className="form-stack" onSubmit={submit}>
          <div className="form-row">
            <label>Destinatário *<input name="recipient_name" required maxLength={160} /></label>
            <label>WhatsApp com DDD *<input name="phone" required maxLength={40} inputMode="tel" placeholder="(31) 99999-9999" /></label>
            <label>Como o consentimento foi obtido *<input name="consent_source" required maxLength={200} placeholder="Ex.: autorização assinada na ficha" /></label>
            <label style={{ gridColumn: "1 / -1" }}>Mensagem *<textarea name="body" required minLength={5} maxLength={1000} rows={4} /></label>
          </div>
          <label className="check-inline"><input type="checkbox" name="consent" required /> A pessoa autorizou receber mensagens neste número.</label>
          <div><button className="button primary" disabled={busy}>Colocar na fila</button></div>
        </form>
      </section>
      <section className="card">
        <div className="toolbar"><h3>Fila</h3><button type="button" className="button no-print" onClick={() => window.print()}>⎙ Imprimir</button></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Destinatário</th><th>Mensagem</th><th>Consentimento</th><th>Situação</th><th className="no-print">Ações</th></tr></thead>
            <tbody>
              {messages.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.recipient_name}</strong><br /><span className="small">{maskPhone(item.phone)}</span></td>
                  <td className="small">{item.body.slice(0, 120)}{item.body.length > 120 ? "…" : ""}</td>
                  <td className="small">{item.consent_source}</td>
                  <td>{item.status}{item.status === "Enviada" && item.sent_by_name ? <><br /><span className="small">{item.sent_by_name}</span></> : null}{item.cancel_reason ? <><br /><span className="small">{item.cancel_reason}</span></> : null}</td>
                  <td className="no-print">
                    {item.status === "Na fila" ? (
                      <div className="row-actions">
                        <button type="button" className="button primary" disabled={busy} onClick={() => open(item)}>Abrir no WhatsApp</button>
                        <button type="button" className="button" disabled={busy} onClick={() => decide(item, "sent")}>Marcar enviada</button>
                        <button type="button" className="button danger" disabled={busy} onClick={() => decide(item, "cancel")}>Cancelar</button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!messages.length ? <tr><td colSpan={5}>Nenhuma mensagem na fila.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
