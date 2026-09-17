"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client-api";

type Pending = { key: string; label: string; count: number; href: string };

/** Painel da Diretoria: o que espera decisão e a situação dos módulos. */
export function PresidenciaPainel() {
  const [pending, setPending] = useState<Pending[]>([]);
  const [error, setError] = useState("");

  useEffect(() => { void api<{ pending: Pending[] }>("/api/pendencias").then((b) => setPending(b.pending)).catch((e) => setError(e.message)); }, []);

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
    </div>
  );
}
