"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { brDate } from "@/lib/resources/types";

type Worker = {
  id: string; full_name: string; phone: string | null; email: string | null; birth_date: string | null;
  status: string; functions: string[]; departments: string[]; approved_at: string | null;
};

const STATUS: Record<string, string> = { active: "Ativo", pending: "Aguardando Diretoria", inactive: "Inativo", rejected: "Reprovado" };

/** Trabalhadores vinculados a um departamento (painel comum dos módulos). */
export function DepartmentWorkers({ department }: { department: string }) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [status, setStatus] = useState("active");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams({ department });
    if (status) params.set("status", status);
    void api<{ workers: Worker[] }>(`/api/workers?${params}`).then((b) => setWorkers(b.workers)).catch((e: Error) => setError(e.message));
  }, [department, status]);

  return (
    <div className="grid">
      {error ? <div className="error" role="alert">{error}</div> : null}
      <section className="card">
        <div className="filters no-print">
          <label>Situação
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">Ativos</option>
              <option value="pending">Aguardando Diretoria</option>
              <option value="inactive">Inativos</option>
              <option value="">Todas</option>
            </select>
          </label>
          <Link className="button" href="/sistema/trabalhadores">Abrir cadastro de trabalhadores</Link>
          <button type="button" className="button" onClick={() => window.print()}>⎙ Imprimir</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Trabalhador</th><th>Funções</th><th>Departamentos</th><th>Contato</th><th>Situação</th></tr></thead>
            <tbody>
              {workers.map((worker) => (
                <tr key={worker.id}>
                  <td><strong>{worker.full_name}</strong>{worker.approved_at ? <><br /><span className="small muted">Aprovado em {brDate(worker.approved_at)}</span></> : null}</td>
                  <td className="small">{worker.functions.join(", ") || "—"}</td>
                  <td className="small">{worker.departments.join(" / ")}</td>
                  <td className="small">{[worker.phone, worker.email].filter(Boolean).join(" · ") || "—"}</td>
                  <td>{STATUS[worker.status] ?? worker.status}</td>
                </tr>
              ))}
              {!workers.length ? <tr><td colSpan={5}>Nenhum trabalhador nesta situação.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <p className="small muted">{workers.length} trabalhador(es) · a ficha completa fica no cadastro de Trabalhadores.</p>
      </section>
    </div>
  );
}
