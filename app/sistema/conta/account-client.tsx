"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Account = {
  name: string; email: string; role: string;
  factors: { id: string; name: string; created_at: string; status: string }[];
  recoveryCodesRemaining: number; totpAt: number | null; reauthWindowSeconds: number;
  events: { occurred_at: string; action: string; result: string; masked_ip: string | null; by_me: boolean }[];
};

export function AccountClient() {
  const router = useRouter();
  const [data, setData] = useState<Account | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [pending, setPending] = useState<"codes" | "replace" | "password" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsNonce, setNeedsNonce] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/account", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setData(body);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load().catch((e) => setError(e.message)); }, [load]);

  /** Reautenticação: confirma um código TOTP atual antes da operação sensível. */
  async function confirmTotp(code: string) {
    const factor = data?.factors.find((f) => f.status === "verified");
    if (!factor) throw new Error("Nenhum autenticador ativo.");
    const result = await createClient().auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (result.error) throw new Error("Código do autenticador inválido.");
  }

  async function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const code = String(values.get("code") ?? "").replace(/\D/g, "");
    setBusy(true); setError(""); setMessage("");
    try {
      await confirmTotp(code);
      if (pending === "codes") {
        const response = await fetch("/api/mfa/recovery-codes", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        setCodes(body.codes);
        setMessage("Novos códigos emitidos; os anteriores deixaram de valer.");
      } else if (pending === "replace") {
        if (!window.confirm("Remover o autenticador atual? Você cadastrará o novo aparelho em seguida e as outras sessões serão encerradas.")) return;
        const response = await fetch("/api/account/mfa/replace", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        await createClient().auth.refreshSession();
        router.replace(body.next);
        router.refresh();
        return;
      } else if (pending === "password") {
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

  if (!data) return error ? <div className="error" role="alert">{error}</div> : <div className="notice">Carregando…</div>;
  const factor = data.factors.find((f) => f.status === "verified");

  return (
    <div className="grid">
      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}
      {codes ? (
        <section className="card">
          <div className="notice">Guarde estes códigos agora. Eles só são mostrados uma vez e cada um vale para um uso.</div>
          <ul>{codes.map((c) => <li key={c}><code>{c}</code></li>)}</ul>
          <button className="button" onClick={() => setCodes(null)}>Já guardei</button>
        </section>
      ) : null}
      <div className="grid cards">
        <article className="card kpi"><span className="small muted">Conta</span><b style={{ fontSize: 18 }}>{data.name}</b><span className="small muted">{data.email}</span></article>
        <article className="card kpi"><span className="small muted">Autenticador</span><b style={{ fontSize: 18 }}>{factor ? factor.name : "Não cadastrado"}</b>{factor ? <span className="small muted">desde {new Date(factor.created_at).toLocaleDateString("pt-BR")}</span> : null}</article>
        <article className="card kpi"><span className="small muted">Códigos de recuperação disponíveis</span><b>{data.recoveryCodesRemaining}</b></article>
      </div>
      <section className="card">
        <h2>Segurança</h2>
        <p className="small muted">Para proteger sua conta, estas ações pedem o código atual do autenticador.</p>
        <div className="row-actions">
          <button className="button" disabled={busy} onClick={() => setPending("codes")}>Gerar novos códigos de recuperação</button>
          <button className="button danger" disabled={busy} onClick={() => setPending("replace")}>Trocar de aparelho autenticador</button>
          <button className="button" disabled={busy} onClick={() => setPending("password")}>Alterar senha</button>
        </div>
        {pending ? (
          <form className="form-stack" onSubmit={run} style={{ marginTop: 16 }}>
            {pending === "password" ? <div className="form-row">
              <label>Nova senha<input name="password" type="password" autoComplete="new-password" minLength={14} required /></label>
              <label>Confirme a nova senha<input name="confirmation" type="password" autoComplete="new-password" minLength={14} required /></label>
              {needsNonce ? <label>Código recebido por e-mail<input name="nonce" inputMode="numeric" autoComplete="one-time-code" maxLength={10} required /></label> : null}
            </div> : null}
            {pending === "replace" ? <div className="notice">O autenticador atual será removido. Tenha o novo aparelho em mãos para ler o QR Code.</div> : null}
            <label>Código atual do autenticador<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></label>
            <div className="row-actions">
              <button className="button primary" disabled={busy}>Confirmar</button>
              <button type="button" className="button" onClick={() => setPending(null)}>Cancelar</button>
            </div>
          </form>
        ) : null}
      </section>
      <section className="card">
        <h2>Últimos eventos de segurança da sua conta</h2>
        <p className="small muted">Se não reconhecer algum evento, troque a senha, troque o autenticador e avise a administração.</p>
        <div className="table-wrap">
          <table>
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
