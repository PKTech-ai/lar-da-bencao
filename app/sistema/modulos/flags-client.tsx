"use client";

import { useCallback, useEffect, useState } from "react";

type Flag = {
  key: string; enabled: boolean; description: string; wave: string | null;
  uat_reference: string | null; enabled_at: string | null; updated_at: string; updated_by_name: string | null;
};

const waveLabel: Record<string, string> = { fundacao: "Fundação", "1": "Onda 1", "2": "Onda 2", "3": "Onda 3" };

export function FlagsClient() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [locked, setLocked] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/feature-flags", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setFlags(body.flags);
    setLocked(body.locked);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load().catch((e) => setError(e.message)); }, [load]);

  async function toggle(flag: Flag) {
    const enabling = !flag.enabled;
    let uat: string | undefined;
    if (enabling && flag.wave !== "fundacao") {
      const answer = window.prompt(`Referência do UAT aprovado para “${flag.description || flag.key}” (ata, data e responsável):`, flag.uat_reference ?? "");
      if (answer === null) return;
      uat = answer.trim();
    } else if (!enabling && !window.confirm(`Desligar “${flag.description || flag.key}”? O módulo deixa de responder imediatamente.`)) {
      return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/feature-flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: flag.key, enabled: enabling, uat_reference: uat || undefined })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setMessage(enabling ? "Módulo liberado e registrado no Dedo-duro." : "Módulo desligado e registrado no Dedo-duro.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao alterar módulo.");
    } finally {
      setBusy(false);
    }
  }

  const master = flags.find((flag) => flag.key === "business_modules");

  return (
    <div className="grid">
      {master && !master.enabled ? (
        <div className="notice">A chave-mestra “Módulos operacionais” está desligada: nenhum módulo de negócio responde, mesmo que esteja liberado abaixo.</div>
      ) : null}
      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}
      <section className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Módulo</th><th>Onda</th><th>Situação</th><th>UAT</th><th>Última alteração</th><th>Ação</th></tr></thead>
            <tbody>
              {flags.map((flag) => (
                <tr key={flag.key}>
                  <td><strong>{flag.description || flag.key}</strong><br /><span className="muted small">{flag.key}</span></td>
                  <td>{flag.wave ? waveLabel[flag.wave] ?? flag.wave : "—"}</td>
                  <td><span className={`status ${flag.enabled ? "ready" : "building"}`}>{flag.enabled ? "Ligado" : "Desligado"}</span></td>
                  <td>{flag.uat_reference ?? "—"}</td>
                  <td>{new Date(flag.updated_at).toLocaleString("pt-BR")}{flag.updated_by_name ? <><br /><span className="muted small">{flag.updated_by_name}</span></> : null}</td>
                  <td>
                    {locked.includes(flag.key)
                      ? <span className="muted small">Protegido</span>
                      : <button className={`button${flag.enabled ? " danger" : " primary"}`} disabled={busy} onClick={() => void toggle(flag)}>{flag.enabled ? "Desligar" : "Liberar"}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
