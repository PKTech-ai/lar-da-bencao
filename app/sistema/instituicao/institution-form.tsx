"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/client-api";

type Institution = { name: string; founded_on: string; motto: string; cnpj: string; address: string; phone: string; email: string; version: number };

export function InstitutionForm() {
  const [data, setData] = useState<Institution | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api<{ institution: Institution }>("/api/instituicao").then((b) => setData(b.institution)).catch((e: Error) => setError(e.message));
  useEffect(() => { void load(); }, []);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true); setError(""); setMessage("");
    void api("/api/instituicao", {
      method: "PUT",
      body: JSON.stringify({
        name: values.get("name"), founded_on: values.get("founded_on"), motto: values.get("motto"),
        cnpj: values.get("cnpj"), address: values.get("address"), phone: values.get("phone"), email: values.get("email"),
        version: data!.version
      })
    })
      .then(async () => { await load(); setMessage("Dados da instituição atualizados."); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  }

  if (!data) return <p className="small muted">Carregando…</p>;

  return (
    <section className="card">
      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}
      <form className="form-stack" onSubmit={save} key={data.version}>
        <div className="form-row">
          <label>Nome da Casa *<input name="name" required minLength={2} maxLength={160} defaultValue={data.name} /></label>
          <label>Data de fundação *<input type="date" name="founded_on" required defaultValue={data.founded_on} /></label>
          <label>CNPJ<input name="cnpj" maxLength={20} defaultValue={data.cnpj} /></label>
          <label>Telefone<input name="phone" maxLength={40} defaultValue={data.phone} /></label>
          <label>E-mail<input type="email" name="email" maxLength={200} defaultValue={data.email} /></label>
          <label style={{ gridColumn: "1 / -1" }}>Endereço<input name="address" maxLength={300} defaultValue={data.address} /></label>
          <label style={{ gridColumn: "1 / -1" }}>Frase da Casa<input name="motto" maxLength={200} defaultValue={data.motto} /></label>
        </div>
        <div><button className="button primary" disabled={busy}>Salvar</button></div>
      </form>
    </section>
  );
}
