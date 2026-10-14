"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/client-api";
import type { MyArea } from "@/lib/my-area";
import { brDate, formatMoney } from "@/lib/resources/types";
import { createClient } from "@/lib/supabase/client";

type Account = {
  name: string; email: string; role: string;
  events: { occurred_at: string; action: string; result: string; masked_ip: string | null; by_me: boolean }[];
};

function monthLabel(month: string) {
  return month.split("-").reverse().join("/");
}

export function AccountClient() {
  const [data, setData] = useState<Account | null>(null);
  const [area, setArea] = useState<MyArea | null>(null);
  const [pending, setPending] = useState<"password" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsNonce, setNeedsNonce] = useState(false);

  const load = useCallback(async () => {
    const [account, minhaArea] = await Promise.all([
      api<Account>("/api/account"),
      api<MyArea>("/api/minha-area")
    ]);
    setData(account);
    setArea(minhaArea);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load().catch((e) => setError(e.message)); }, [load]);

  async function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true); setError(""); setMessage("");
    try {
      if (pending === "password") {
        const password = String(values.get("password") ?? "");
        if (password.length < 14) throw new Error("A nova senha deve ter ao menos 14 caracteres.");
        if (password !== String(values.get("confirmation") ?? "")) throw new Error("As senhas não conferem.");
        const supabase = createClient();
        const nonce = String(values.get("nonce") ?? "").trim();
        const result = await supabase.auth.updateUser(nonce ? { password, nonce } : { password });
        if (result.error?.code === "reauthentication_needed" || result.error?.code === "reauthentication_not_valid") {
          // Troca segura de senha: o Supabase envia um código por e-mail e exige esse código.
          const sent = await supabase.auth.reauthenticate();
          if (sent.error) throw sent.error;
          setNeedsNonce(true);
          setMessage("Enviamos um código de confirmação para o seu e-mail. Informe-o e confirme de novo.");
          return;
        }
        if (result.error) throw result.error;
        setNeedsNonce(false);
        await fetch("/api/auth/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "password_changed" }) });
        setMessage("Senha alterada.");
      }
      setPending(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }

  if (!data || !area) return error ? <div className="error" role="alert">{error}</div> : <div className="notice">Carregando…</div>;

  return (
    <div className="grid my-area">
      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}

      <div className="mb-profile">
        <strong>{area.worker?.name || area.profile.name}</strong>
        <p>{area.profile.roleLabel}</p>
      </div>

      {area.worker ? (
        <>
          <h3>Meu cadastro</h3>
          <p>{area.worker.departments.join(" · ") || "Departamento não informado"}</p>
          <p>Contato: {area.worker.phone || "Não informado"}</p>
          <p>Situação da ficha: {area.worker.status}</p>

          <h3>Minhas contribuições</h3>
          <p className="mb-muted">Últimos 12 meses com lançamentos registrados. Meses sem lançamento não são considerados pendentes.</p>
          <ul className="mb-own-list">
            {area.contributions.map((item) => (
              <li key={item.month} className="mb-contrib">
                <div>
                  <strong>{monthLabel(item.month)}</strong>
                  <span>{item.status}</span>
                </div>
                <div>
                  <span>Recebido: {formatMoney(item.amount_cents)}</span>
                  <small>Previsto: {formatMoney(item.expected_cents)}</small>
                  {item.amount_cents ? <small>Data: {brDate(item.paid_date)}</small> : null}
                </div>
              </li>
            ))}
            {!area.contributions.length ? <li>Nenhum lançamento registrado.</li> : null}
          </ul>

          <h3>Minhas escalas de limpeza e eventos</h3>
          <ul className="mb-own-list">
            {area.scales.map((item, index) => (
              <li key={`${item.date}-${item.activity}-${index}`}>
                <strong>{item.activity}</strong>
                {item.date ? brDate(item.date) : "Data a definir"}
                <small>{[item.place || item.role, item.status].filter(Boolean).join(" · ")}</small>
              </li>
            ))}
            {!area.scales.length ? <li>Nenhuma escala futura registrada para você.</li> : null}
          </ul>
        </>
      ) : (
        <p className="mb-muted">Seu acesso ainda não foi vinculado a uma ficha de trabalhador. Solicite ao Administrador esse vínculo para consultar suas informações pessoais.</p>
      )}

      <section className="card">
        <h2>Segurança</h2>
        <div className="row-actions">
          <button className="button" disabled={busy} onClick={() => setPending("password")}>Alterar senha</button>
        </div>
        {pending === "password" ? (
          <form className="form-stack" onSubmit={run} style={{ marginTop: 16 }}>
            <div className="form-row">
              <label>Nova senha<input name="password" type="password" autoComplete="new-password" minLength={14} required /></label>
              <label>Confirme a nova senha<input name="confirmation" type="password" autoComplete="new-password" minLength={14} required /></label>
              {needsNonce ? <label>Código recebido por e-mail<input name="nonce" inputMode="numeric" autoComplete="one-time-code" maxLength={10} required /></label> : null}
            </div>
            <div className="row-actions">
              <button className="button primary" disabled={busy}>Confirmar</button>
              <button type="button" className="button" onClick={() => setPending(null)}>Cancelar</button>
            </div>
          </form>
        ) : null}
      </section>
      <section className="card">
        <h2>Últimos eventos de segurança da sua conta</h2>
        <p className="small muted">Se não reconhecer algum evento, troque a senha e avise a administração.</p>
        <div className="table-wrap visual-table-scroll">
          <table className="visual-table">
            <thead><tr><th>Quando</th><th>Evento</th><th>Resultado</th><th>Origem</th></tr></thead>
            <tbody>
              {data.events.map((e, i) => (
                <tr key={i}>
                  <td>{new Date(e.occurred_at).toLocaleString("pt-BR")}</td>
                  <td>{e.action}{e.by_me ? "" : <span className="small muted"> (pela administração)</span>}</td>
                  <td>{e.result === "success" ? "Concluído" : e.result === "denied" ? "Negado" : "Falhou"}</td>
                  <td>{e.masked_ip ?? "—"}</td>
                </tr>
              ))}
              {!data.events.length ? <tr><td colSpan={4}>Nenhum evento.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
