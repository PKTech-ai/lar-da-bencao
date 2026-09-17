"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

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
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível entrar.");
      router.replace(body.next ?? "/mfa");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form-stack" onSubmit={submit}>
      {params.get("motivo") === "sessao" ? <div className="notice" role="status">Sua sessão foi encerrada. Entre novamente.</div> : null}
      {params.get("motivo") === "bienio" ? <div className="notice" role="status">Seu acesso de Diretoria está fora do biênio vigente. Procure o Administrador do Sistema.</div> : null}
      <label>E-mail institucional<input name="email" type="email" autoComplete="username" required /></label>
      <label>Senha<input name="password" type="password" autoComplete="current-password" minLength={10} required /></label>
      {error ? <div className="error" role="alert">{error}</div> : null}
      <button className="button primary" type="submit" disabled={busy}>{busy ? "Entrando…" : "Continuar"}</button>
      <Link href="/recuperar" className="button">Esqueci minha senha</Link>
      <p className="small muted">Contas compartilhadas não são permitidas. Procure o Administrador para recuperar o acesso.</p>
    </form>
  );
}
