"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";

type Worker = { id: string; full_name: string; birth_date: string; day: number; month: number; departments: string[] };

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** Aniversariantes dos trabalhadores ativos (painel comum a vários módulos). */
export function BirthdaysPanel({ department }: { department?: string }) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (department) params.set("department", department);
    if (month) params.set("month", month);
    void api<{ workers: Worker[] }>(`/api/aniversariantes?${params}`).then((b) => setWorkers(b.workers)).catch((e) => setError(e.message));
  }, [department, month]);

  return (
    <div className="grid">
      {error ? <div className="error" role="alert">{error}</div> : null}
      <section className="card">
        <div className="filters no-print">
          <label>Mês
            <select value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="">Ano inteiro</option>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </label>
          <button type="button" className="button" onClick={() => window.print()}>⎙ Imprimir</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Dia</th><th>Trabalhador</th><th>Departamentos</th></tr></thead>
            <tbody>
              {workers.map((w) => (
                <tr key={w.id}>
                  <td>{String(w.day).padStart(2, "0")}/{String(w.month).padStart(2, "0")}</td>
                  <td><strong>{w.full_name}</strong></td>
                  <td>{w.departments.join(" / ") || "—"}</td>
                </tr>
              ))}
              {!workers.length ? <tr><td colSpan={3}>Nenhum aniversariante no período.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <p className="small muted">{workers.length} trabalhador(es) · somente ativos com data de nascimento no cadastro.</p>
      </section>
    </div>
  );
}
