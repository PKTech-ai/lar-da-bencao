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
  }, []);

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
      router.replace("/sistema");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Código inválido.");
    } finally {
      setBusy(false);
    }
  }

  if (busy && !factor) return <div className="notice">Preparando autenticação segura…</div>;
  return (
    <form className="form-stack" onSubmit={verify}>
      {qr ? <>
        <div className="notice">Escaneie o QR Code e guarde o segredo em local seguro. Ele será mostrado somente durante esta ativação.</div>
        {/* Supabase fornece um data URL SVG para o QR TOTP. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="qr" src={qr} alt="QR Code para cadastrar o segundo fator" />
        <label>Chave manual<input value={secret} readOnly onFocus={(event) => event.currentTarget.select()} /></label>
      </> : null}
      <label>Código de 6 dígitos<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></label>
      {error ? <div className="error" role="alert">{error}</div> : null}
      <button className="button primary" type="submit" disabled={busy || !factor}>{busy ? "Verificando…" : "Confirmar e entrar"}</button>
    </form>
  );
}
