"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

export function TermsForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function accept(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: CURRENT_TERMS_VERSION })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      router.replace("/sistema");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível registrar o aceite.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form-stack" onSubmit={accept}>
      <div className="notice">
        <p>Ao continuar, você confirma que:</p>
        <ul>
          <li>usará apenas a conta individual atribuída (sem compartilhar senha ou MFA);</li>
          <li>tratará dados de trabalhadores, famílias e menores com confidencialidade;</li>
          <li>compreende que ações sensíveis são registradas no Dedo-duro.</li>
        </ul>
        <p className="small muted">Versão dos termos: {CURRENT_TERMS_VERSION}</p>
      </div>
      {error ? <div className="error">{error}</div> : null}
      <button className="button primary" disabled={busy}>Li e aceito</button>
    </form>
  );
}
