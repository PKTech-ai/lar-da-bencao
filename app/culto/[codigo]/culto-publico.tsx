"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import type { CultoPublicMonth } from "@/lib/culto-link";
import { CULTO_NAME_MAX } from "@/lib/doutrina-extras";
import { brDate } from "@/lib/monthly-saturdays";

/** Lista dos sábados do ano no link público: sábado livre → digitar o nome → confirmar. */
export function CultoPublico({ code, months }: { code: string; months: CultoPublicMonth[] }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [open, setOpen] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ month: string; text: string } | null>(null);
  const [honey, setHoney] = useState("");

  function choose(month: string) {
    setOpen(month); setError(""); setDone(null);
  }

  async function submit(event: FormEvent, row: CultoPublicMonth) {
    event.preventDefault();
    const text = name.replace(/\s+/g, " ").trim();
    if (text.length < 2) { setError("Digite o seu nome."); return; }
    setBusy(true); setError("");
    const response = await fetch("/api/public/culto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, month: row.month, host_name: text, website: honey })
    }).catch(() => null);
    const body = response ? await response.json().catch(() => ({})) : {};
    setBusy(false);
    if (!response || !response.ok) {
      setError(String(body.error ?? "Não foi possível gravar. Confira a internet e tente de novo."));
      if (response?.status === 409) startRefresh(() => router.refresh());
      return;
    }
    setOpen(null); setName("");
    setDone({ month: row.month, text: `Obrigado, ${body.host_name ?? text}! O Culto no Lar de ${brDate(row.culto)} ficou com você. Que Jesus abençoe o seu lar.` });
    startRefresh(() => router.refresh());
  }

  const free = months.filter((m) => !m.host_name && !m.past).length;

  return (
    <div className="culto-public-list">
      {error && !open ? <div className="error" role="alert">{error}</div> : null}
      <p className="small muted">{free === 0 ? "Todos os sábados deste ano já foram escolhidos. Obrigado!" : `${free} ${free === 1 ? "sábado livre" : "sábados livres"}.`}</p>
      <ul>
        {months.map((row) => {
          const state = row.host_name ? "taken" : row.past ? "past" : "free";
          return (
            <li key={row.month} className={`culto-day culto-day-${state}`}>
              <div className="culto-day-head">
                <div>
                  <strong>{row.label}</strong>
                  <span>Sábado, {brDate(row.culto)}</span>
                </div>
                {state === "taken" ? <span className="culto-day-host">✓ {row.host_name}</span>
                  : state === "past" ? <span className="small muted">Já passou</span>
                  : open === row.month ? null
                  : <button type="button" className="button primary" disabled={busy || refreshing} onClick={() => choose(row.month)}>Escolher</button>}
              </div>
              {open === row.month ? (
                <form className="culto-day-form" onSubmit={(e) => void submit(e, row)}>
                  <label htmlFor={`nome-${row.month}`}>Seu nome</label>
                  <input id={`nome-${row.month}`} autoFocus autoComplete="name" maxLength={CULTO_NAME_MAX} value={name}
                    onChange={(e) => setName(e.target.value)} placeholder="Nome e sobrenome" />
                  <input className="culto-honey" tabIndex={-1} autoComplete="off" aria-hidden="true" name="website" value={honey} onChange={(e) => setHoney(e.target.value)} />
                  {error ? <div className="error" role="alert">{error}</div> : null}
                  <div className="row-actions">
                    <button type="submit" className="button primary" disabled={busy}>{busy ? "Gravando…" : `Confirmar ${brDate(row.culto).slice(0, 5)}`}</button>
                    <button type="button" className="button" disabled={busy} onClick={() => { setOpen(null); setError(""); }}>Cancelar</button>
                  </div>
                </form>
              ) : null}
              {done?.month === row.month ? <div className="success culto-day-done" role="status">{done.text}</div> : null}
            </li>
          );
        })}
      </ul>
      <p className="small muted">Escolheu o sábado errado ou não vai poder receber? Fale com a Doutrina para trocar.</p>
    </div>
  );
}
