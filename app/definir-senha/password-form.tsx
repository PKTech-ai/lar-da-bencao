"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PasswordField } from "@/components/password-field";

export function PasswordForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmation })
      });
      const body = await response.json().catch(() => ({})) as { error?: string; next?: string };
      if (!response.ok) throw new Error(body.error ?? "Não foi possível definir a senha.");
      router.push(body.next ?? "/sistema");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof TypeError ? "Sem resposta do sistema. Tente de novo." : caught instanceof Error ? caught.message : "Não foi possível definir a senha.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form-stack" onSubmit={submit}>
      <label>Nova senha<PasswordField name="password" autoComplete="new-password" minLength={6} required /></label>
      <label>Confirme a senha<PasswordField name="confirmation" autoComplete="new-password" minLength={6} required /></label>
      {error ? <div className="error" role="alert">{error}</div> : null}
      <button className={busy ? "button primary is-loading" : "button primary"} type="submit" disabled={busy}>{busy ? "Salvando a nova senha…" : "Salvar senha"}</button>
    </form>
  );
}
