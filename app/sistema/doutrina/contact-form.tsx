"use client";

import { useState, type FormEvent } from "react";

export function DoctrineContactForm({ coordinator, phone, canEdit }: { coordinator: string; phone: string; canEdit: boolean }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setStatus("");
    const response = await fetch("/api/doutrina/contact", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: new FormData(event.currentTarget).get("phone") })
    });
    const body = await response.json();
    setStatus(response.ok ? "Contato atualizado." : body.error);
    setBusy(false);
  }
  return (
    <form className="form-stack" onSubmit={save}>
      <div className="form-row">
        <label>Coordenador(a) — Controle de Acesso<input value={coordinator} readOnly /></label>
        <label>WhatsApp / Contato<input name="phone" defaultValue={phone} maxLength={40} disabled={!canEdit} placeholder="(92) 99999-9999" /></label>
      </div>
      {canEdit ? <div className="row-actions"><button className="button primary" disabled={busy}>Salvar contato</button>{status ? <span className="small">{status}</span> : null}</div> : null}
    </form>
  );
}
