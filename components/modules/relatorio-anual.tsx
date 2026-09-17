"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { formatMoney } from "@/lib/resources/types";

type Row = { label: string; months: number[]; total: number; sumLabel?: string; sumMonths?: number[]; sumTotal?: number };
type Report = { department: string; year: number; rows: Row[]; workers: { status: string; total: number }[] };

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const STATUS: Record<string, string> = { active: "Ativos", pending: "Aguardando Diretoria", inactive: "Inativos", rejected: "Reprovados" };

/** Relatório anual comum a todos os departamentos (BL-015). */
export function AnnualReport({ department }: { department: string }) {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void api<Report>(`/api/relatorios/${department}?year=${year}`).then(setReport).catch((e: Error) => setError(e.message));
  }, [department, year]);

  return (
    <div className="grid">
      {error ? <div className="error" role="alert">{error}</div> : null}
      <div className="filters no-print">
        <label>Ano<input type="number" min={1900} max={2199} value={year} onChange={(e) => setYear(e.target.value)} /></label>
        <button type="button" className="button" onClick={() => window.print()}>⎙ Imprimir relatório</button>
      </div>
      <section className="card">
        <h3>Trabalhadores do departamento</h3>
        <p>{(report?.workers ?? []).map((w) => `${STATUS[w.status] ?? w.status}: ${w.total}`).join(" · ") || "Nenhum trabalhador vinculado."}</p>
      </section>
      <section className="card">
        <h3>Movimento do ano</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Cadastro</th>{MONTHS.map((m) => <th key={m}>{m}</th>)}<th>Total</th></tr></thead>
            <tbody>
              {(report?.rows ?? []).map((row) => (
                <tr key={row.label}>
                  <td><strong>{row.label}</strong></td>
                  {row.months.map((value, index) => <td key={index}>{value || "—"}</td>)}
                  <td><strong>{row.total}</strong></td>
                </tr>
              ))}
              {(report?.rows ?? []).filter((row) => row.sumLabel).map((row) => (
                <tr key={`${row.label}-valor`}>
                  <td>{row.sumLabel}</td>
                  {(row.sumMonths ?? []).map((value, index) => <td key={index}>{value ? formatMoney(value) : "—"}</td>)}
                  <td><strong>{formatMoney(row.sumTotal ?? 0)}</strong></td>
                </tr>
              ))}
              {!report?.rows.length ? <tr><td colSpan={14}>Sem movimento no ano.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
