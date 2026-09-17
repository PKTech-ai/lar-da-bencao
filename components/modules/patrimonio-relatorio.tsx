"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { formatMoney } from "@/lib/resources/types";

type Report = {
  year: number;
  assets: { department_key: string; total: number; active: number; value_cents: string; entries: number; disposed: number }[];
  disposals: { status: string; total: number }[];
  cleaning: { month: number; scheduled: number; done: number; fee: number; cancelled: number; fee_paid_cents: string; fee_pending_cents: string }[];
};

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DISPOSAL_LABEL: Record<string, string> = { pending: "Pendentes", approved: "Autorizadas", rejected: "Recusadas", cancelled: "Canceladas" };

export function PatrimonyReport() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");

  useEffect(() => { void api<Report>(`/api/patrimonio/relatorio?year=${year}`).then(setReport).catch((e) => setError(e.message)); }, [year]);

  const totalValue = report?.assets.reduce((s, a) => s + Number(a.value_cents), 0) ?? 0;
  const feePaid = report?.cleaning.reduce((s, c) => s + Number(c.fee_paid_cents), 0) ?? 0;
  const feePending = report?.cleaning.reduce((s, c) => s + Number(c.fee_pending_cents), 0) ?? 0;

  return (
    <div className="grid">
      <div className="filters no-print">
        <label>Ano<input type="number" min={1900} max={2199} value={year} onChange={(e) => setYear(e.target.value)} /></label>
        <button type="button" className="button" onClick={() => window.print()}>⎙ Imprimir relatório</button>
      </div>
      {error ? <div className="error" role="alert">{error}</div> : null}
      <div className="grid cards">
        <article className="card kpi"><span className="small">Bens no patrimônio</span><b>{report?.assets.reduce((s, a) => s + a.active, 0) ?? 0}</b></article>
        <article className="card kpi"><span className="small">Valor cadastrado</span><b>{formatMoney(totalValue)}</b></article>
        <article className="card kpi"><span className="small">Entradas no ano</span><b>{report?.assets.reduce((s, a) => s + a.entries, 0) ?? 0}</b></article>
        <article className="card kpi"><span className="small">Baixas no ano</span><b>{report?.assets.reduce((s, a) => s + a.disposed, 0) ?? 0}</b></article>
        <article className="card kpi"><span className="small">Taxas de limpeza recebidas</span><b>{formatMoney(feePaid)}</b></article>
        <article className="card kpi"><span className="small">Taxas pendentes</span><b>{formatMoney(feePending)}</b></article>
      </div>
      <section className="card">
        <h3>Bens por departamento</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Departamento</th><th>No patrimônio</th><th>Valor</th><th>Entradas no ano</th><th>Baixas no ano</th></tr></thead>
            <tbody>
              {(report?.assets ?? []).map((a) => (
                <tr key={a.department_key}><td>{a.department_key}</td><td>{a.active}</td><td>{formatMoney(a.value_cents)}</td><td>{a.entries}</td><td>{a.disposed}</td></tr>
              ))}
              {!report?.assets.length ? <tr><td colSpan={5}>Nenhum bem cadastrado.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <h3>Memorandos de baixa do ano</h3>
        <p>{(report?.disposals ?? []).map((d) => `${DISPOSAL_LABEL[d.status] ?? d.status}: ${d.total}`).join(" · ") || "Nenhum memorando no ano."}</p>
      </section>
      <section className="card">
        <h3>Escala de limpeza por mês</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Mês</th><th>Escalados</th><th>Realizadas</th><th>Taxa de serviço</th><th>Cancelados</th><th>Taxas recebidas</th><th>Taxas pendentes</th></tr></thead>
            <tbody>
              {(report?.cleaning ?? []).map((c) => (
                <tr key={c.month}><td>{MONTHS[c.month - 1]}</td><td>{c.scheduled}</td><td>{c.done}</td><td>{c.fee}</td><td>{c.cancelled}</td><td>{formatMoney(c.fee_paid_cents)}</td><td>{formatMoney(c.fee_pending_cents)}</td></tr>
              ))}
              {!report?.cleaning.length ? <tr><td colSpan={7}>Nenhuma escala no ano.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
