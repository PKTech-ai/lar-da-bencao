"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client-api";

type Pending = { key: string; label: string; count: number; href: string };
type Flag = { key: string; enabled: boolean; description: string; wave: string | null; uat_reference: string | null; enabled_at: string | null };

/** Painel da Diretoria: o que espera decisão e a situação dos módulos. */
export function PresidenciaPainel() {
  const [pending, setPending] = useState<Pending[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void api<{ pending: Pending[] }>("/api/pendencias").then((b) => setPending(b.pending)).catch((e: Error) => setError(e.message));
    void api<{ flags: Flag[] }>("/api/feature-flags").then((b) => setFlags(b.flags)).catch(() => undefined);
  }, []);

  return (
    <div className="grid">
      {error ? <div className="error" role="alert">{error}</div> : null}
      <div className="grid cards">
        {pending.map((p) => (
          <Link key={p.key} href={p.href} className="card card-link kpi">
            <span className="small">{p.label}</span><b>{p.count}</b>
          </Link>
        ))}
        {!pending.length && !error ? <p className="small muted">Nenhuma pendência para a Diretoria neste momento.</p> : null}
      </div>
      {flags.length ? (
        <section className="card">
          <div className="toolbar"><h3>Situação dos módulos</h3><button type="button" className="button no-print" onClick={() => window.print()}>⎙ Imprimir</button></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Módulo</th><th>Onda</th><th>Situação</th><th>UAT registrado</th></tr></thead>
              <tbody>
                {flags.map((flag) => (
                  <tr key={flag.key}>
                    <td>{flag.description || flag.key}</td>
                    <td>{flag.wave ?? "—"}</td>
                    <td>{flag.enabled ? "Ligado" : "Desligado"}{flag.enabled_at ? ` · ${new Date(flag.enabled_at).toLocaleDateString("pt-BR")}` : ""}</td>
                    <td className="small">{flag.uat_reference ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
