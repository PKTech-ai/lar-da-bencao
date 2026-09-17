"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Factor = { id: string; friendly_name?: string };

export function MfaForm() {
  const router = useRouter();
  const [factor, setFactor] = useState<Factor | null>(null);
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [recoveryInput, setRecoveryInput] = useState("");
  const [notice, setNotice] = useState("");
  const [enrollRound, setEnrollRound] = useState(0);

  useEffect(() => {
    let alive = true;
    async function prepare() {
      try {
        const supabase = createClient();
        const listed = await supabase.auth.mfa.listFactors();
        if (listed.error) throw listed.error;
        const existing = listed.data.totp.find((item) => item.status === "verified") ?? null;
        if (existing) {
          if (alive) setFactor(existing);
          return;
        }
        const stale = listed.data.all.find((item) => item.status === "unverified");
        if (stale) {
          const removed = await supabase.auth.mfa.unenroll({ factorId: stale.id });
          if (removed.error) throw removed.error;
        }
        const enrolled = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Lar da Bênção" });
        if (enrolled.error) throw enrolled.error;
        if (alive) {
          setFactor(enrolled.data);
          setQr(enrolled.data.totp.qr_code);
          setSecret(enrolled.data.totp.secret);
        }
      } catch (caught) {
        if (alive) setError(caught instanceof Error ? caught.message : "Não foi possível preparar o segundo fator.");
      } finally {
        if (alive) setBusy(false);
      }
    }
    void prepare();
    return () => { alive = false; };
  }, [enrollRound]);

  async function issueRecoveryCodes() {
    const response = await fetch("/api/mfa/recovery-codes", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Não foi possível emitir códigos de recuperação.");
    setRecoveryCodes(body.codes);
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factor) return;
    setBusy(true);
    setError("");
    try {
      const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\D/g, "");
      const supabase = createClient();
      const result = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (result.error) throw result.error;
      const audited = await fetch("/api/auth/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "login_success" }) });
      if (!audited.ok) throw new Error("O acesso foi confirmado, mas o registro de segurança falhou. Tente novamente.");
      if (qr) {
        try { await issueRecoveryCodes(); } catch (recoveryError) {
          setError(recoveryError instanceof Error ? recoveryError.message : "MFA ok, mas códigos de recuperação falharam.");
          return;
        }
      } else {
        router.replace("/termos");
        router.refresh();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Código inválido.");
    } finally {
      setBusy(false);
    }
  }

  async function useRecoveryCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/mfa/recovery-codes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: recoveryInput })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Código inválido.");
      const refreshed = await createClient().auth.refreshSession();
      if (refreshed.error) throw refreshed.error;
      setRecoveryInput("");
      setFactor(null);
      setNotice("Código aceito. Cadastre agora o novo autenticador; novos códigos de recuperação serão emitidos em seguida.");
      setEnrollRound((round) => round + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Código inválido.");
      setBusy(false);
    }
  }

  if (recoveryCodes) {
    return (
      <div className="form-stack">
        <div className="notice">Guarde estes códigos agora. Eles só são mostrados uma vez e cada um vale para um uso.</div>
        <ul>{recoveryCodes.map((code) => <li key={code}><code>{code}</code></li>)}</ul>
        <button className="button primary" type="button" onClick={() => { router.replace("/termos"); router.refresh(); }}>Já salvei — continuar</button>
      </div>
    );
  }

  if (busy && !factor) return <div className="notice">Preparando autenticação segura…</div>;
  return (
    <>
      <form className="form-stack" onSubmit={verify}>
        {notice ? <div className="success" role="status">{notice}</div> : null}
        {qr ? <>
          <div className="notice">Escaneie o QR Code e guarde o segredo em local seguro. Ele será mostrado somente durante esta ativação.</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="qr" src={qr} alt="QR Code para cadastrar o segundo fator" />
          <label>Chave manual<input value={secret} readOnly onFocus={(event) => event.currentTarget.select()} /></label>
        </> : null}
        <label>Código de 6 dígitos<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></label>
        {error ? <div className="error" role="alert">{error}</div> : null}
        <button className="button primary" type="submit" disabled={busy || !factor}>{busy ? "Verificando…" : "Confirmar e entrar"}</button>
      </form>
      {!qr ? (
        <form className="form-stack" style={{ marginTop: 24 }} onSubmit={useRecoveryCode}>
          <h3>Perdeu o autenticador?</h3>
          <label>Código de recuperação<input value={recoveryInput} onChange={(e) => setRecoveryInput(e.target.value)} placeholder="XXXXX-XXXXX-XXXXX-XXXXX" autoComplete="off" maxLength={64} required /></label>
          <button className="button" type="submit" disabled={busy}>Usar código de recuperação</button>
        </form>
      ) : null}
    </>
  );
}
