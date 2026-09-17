"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, postJson } from "@/lib/client-api";

type Suggestion = {
  id: string; subject: string; body: string; area: string; status: string; answer: string;
  created_at: string; answered_at: string | null; author: string | null; anonymous: boolean; mine: boolean; version: number;
};

const STATUSES = ["Recebida", "Em análise", "Respondida", "Arquivada"];

export function SuggestionsClient() {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [answering, setAnswering] = useState<Suggestion | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api<{ suggestions: Suggestion[]; canManage: boolean }>("/api/sugestoes")
    .then((b) => { setItems(b.suggestions); setCanManage(b.canManage); })
    .catch((e: Error) => setError(e.message)), []);
  useEffect(() => { void load(); }, [load]);

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true); setError(""); setMessage("");
    void postJson("/api/sugestoes", { subject: data.get("subject"), body: data.get("body"), area: data.get("area"), anonymous: data.get("anonymous") === "on" })
      .then(async () => { form.reset(); await load(); setMessage("Sugestão enviada à Diretoria. Obrigado!"); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  }

  function answer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const target = answering!;
    setBusy(true); setError(""); setMessage("");
    void postJson(`/api/sugestoes/${target.id}`, { status: data.get("status"), answer: data.get("answer"), version: target.version }, "PATCH")
      .then(async () => { setAnswering(null); await load(); setMessage("Resposta registrada."); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  }

  return (
    <div className="grid">
      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}
      <section className="card no-print">
        <h2>Nova sugestão</h2>
        <form className="form-stack" onSubmit={send}>
          <div className="form-row">
            <label>Assunto *<input name="subject" required minLength={3} maxLength={160} /></label>
            <label>Área (opcional)<input name="area" maxLength={80} placeholder="Ex.: Doutrina, Patrimônio" /></label>
            <label style={{ gridColumn: "1 / -1" }}>Mensagem *<textarea name="body" required minLength={5} maxLength={4000} rows={4} /></label>
          </div>
          <label className="check-inline"><input type="checkbox" name="anonymous" /> Enviar sem mostrar meu nome à Diretoria.</label>
          <div><button className="button primary" disabled={busy}>Enviar</button></div>
        </form>
      </section>

      {answering ? (
        <section className="card no-print">
          <div className="toolbar"><h2>Responder</h2><button type="button" className="button" onClick={() => setAnswering(null)}>Fechar</button></div>
          <p className="small"><strong>{answering.subject}</strong><br />{answering.body}</p>
          <form className="form-stack" onSubmit={answer} key={answering.id}>
            <label>Situação<select name="status" defaultValue={answering.status}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
            <label>Resposta<textarea name="answer" maxLength={4000} rows={4} defaultValue={answering.answer} /></label>
            <div><button className="button primary" disabled={busy}>Salvar resposta</button></div>
          </form>
        </section>
      ) : null}

      <section className="card">
        <div className="toolbar"><h2>{canManage ? "Sugestões recebidas" : "Minhas sugestões"}</h2><button type="button" className="button no-print" onClick={() => window.print()}>⎙ Imprimir</button></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Assunto</th><th>Quem enviou</th><th>Situação</th><th>Resposta</th><th className="no-print">Ação</th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.subject}</strong><br /><span className="small">{item.body.slice(0, 160)}{item.body.length > 160 ? "…" : ""}</span>{item.area ? <><br /><span className="small muted">{item.area}</span></> : null}</td>
                  <td className="small">{item.anonymous ? "Anônima" : item.author ?? "—"}{item.mine ? " (você)" : ""}<br />{new Date(item.created_at).toLocaleDateString("pt-BR")}</td>
                  <td>{item.status}</td>
                  <td className="small">{item.answer || "—"}</td>
                  <td className="no-print">{canManage ? <button type="button" className="button" onClick={() => setAnswering(item)}>Responder</button> : null}</td>
                </tr>
              ))}
              {!items.length ? <tr><td colSpan={5}>Nenhuma sugestão até agora.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
