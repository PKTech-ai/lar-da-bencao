"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { MaskedInput } from "@/components/masked-input";
import { PasswordField } from "@/components/password-field";
import { maskCpfInput } from "@/lib/cpf";

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
      const body = await response.json().catch(() => ({})) as { error?: string; next?: string };
      if (!response.ok) throw new Error(body.error ?? "Não foi possível entrar.");
      await fetch("/api/auth/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "login_success" })
      });
      router.replace(body.next ?? "/sistema");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof TypeError ? "Sem resposta do sistema. Tente de novo." : caught instanceof Error ? caught.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form-stack" method="post" action="/login" onSubmit={submit}>
      {params.get("motivo") === "sessao" ? <div className="notice" role="status">Sua sessão foi encerrada. Entre novamente.</div> : null}
      {params.get("motivo") === "bienio" ? <div className="notice" role="status">Seu acesso de Diretoria está fora do biênio vigente. Procure o Administrador do Sistema.</div> : null}
      <label>CPF<MaskedInput name="email" mask={maskCpfInput} type="text" inputMode="numeric" autoComplete="username" minLength={11} maxLength={14} placeholder="000.000.000-00" required /></label>
      <label>Senha<PasswordField name="password" autoComplete="current-password" minLength={6} required /></label>
      {error ? <div className="error" role="alert">{error}</div> : null}
      <button className={busy ? "button primary is-loading" : "button primary"} type="submit" disabled={busy}>{busy ? "Entrando…" : "Continuar"}</button>
      <Link href="/recuperar" className="button">Esqueci minha senha</Link>
      <p className="small muted">Contas compartilhadas não são permitidas. Procure o Administrador para recuperar o acesso.</p>
    </form>
  );
}
