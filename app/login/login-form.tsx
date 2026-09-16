"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { safeInternalPath } from "@/lib/navigation";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const supabase = createClient();
      const result = await supabase.auth.signInWithPassword({
        email: String(form.get("email") ?? "").trim(),
        password: String(form.get("password") ?? "")
      });
      if (result.error) throw result.error;
      const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error) throw assurance.error;
      const next = safeInternalPath(params.get("next"), "/sistema");
      if (assurance.data.currentLevel === "aal2") {
        await fetch("/api/auth/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "login_success" }) });
      }
      router.replace(assurance.data.currentLevel === "aal2" ? next : "/mfa");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form-stack" onSubmit={submit}>
      <label>E-mail institucional<input name="email" type="email" autoComplete="username" required /></label>
      <label>Senha<input name="password" type="password" autoComplete="current-password" minLength={10} required /></label>
      {error ? <div className="error" role="alert">{error}</div> : null}
      <button className="button primary" type="submit" disabled={busy}>{busy ? "Entrando…" : "Continuar"}</button>
      <Link href="/recuperar" className="button">Esqueci minha senha</Link>
      <p className="small muted">Contas compartilhadas não são permitidas. Procure o Administrador para recuperar o acesso.</p>
    </form>
  );
}
