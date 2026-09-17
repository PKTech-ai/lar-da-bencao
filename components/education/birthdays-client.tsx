"use client";

import { useCallback, useEffect, useState } from "react";
import type { EducationDepartment } from "@/lib/education";

type Person = { id: string; name: string; kind: string; link: string; day: number; month: number; age: number };
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export function BirthdaysClient({ department }: { department: EducationDepartment }) {
  const now = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const [year, setYear] = useState(Number(now.slice(0, 4)));
  const [from, setFrom] = useState(Number(now.slice(5, 7)));
  const [to, setTo] = useState(Number(now.slice(5, 7)));
  const [audience, setAudience] = useState("all");
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/education/${department}/birthdays?year=${year}&from=${from}&to=${to}&audience=${audience}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setPeople(body.people);
  }, [department, year, from, to, audience]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load().then(() => setError("")).catch((e) => setError(e.message)); }, [load]);

  const month = (value: number, set: (n: number) => void, label: string) => (
    <label>{label}<select value={value} onChange={(e) => set(Number(e.target.value))}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></label>
  );
  return (
    <div className="grid">
      <section className="card no-print">
        <div className="form-row">
          <label>Público<select value={audience} onChange={(e) => setAudience(e.target.value)}><option value="all">Todos</option><option value="evangelizandos">Evangelizandos</option><option value="evangelizadores">Evangelizadores</option></select></label>
          {month(from, setFrom, "Do mês")}
          {month(to, setTo, "Até o mês")}
          <label>Ano de referência<input type="number" min={2020} max={2100} value={year} onChange={(e) => { const y = Number(e.target.value); if (y >= 2020 && y <= 2100) setYear(y); }} /></label>
        </div>
        <div className="row-actions" style={{ marginTop: 10 }}>
          <button className="button" onClick={() => { setFrom(Number(now.slice(5, 7))); setTo(Number(now.slice(5, 7))); }}>Mês atual</button>
          <button className="button" onClick={() => { setFrom(1); setTo(12); }}>Ano inteiro</button>
          <button className="button primary" onClick={() => window.print()}>⎙ Imprimir relação</button>
        </div>
      </section>
      {error ? <div className="error" role="alert">{error}</div> : null}
      <section className="card">
        <p><strong>Período:</strong> {MONTHS[Math.min(from, to) - 1]}{from !== to ? ` a ${MONTHS[Math.max(from, to) - 1]}` : ""} de {year} · {people.length} aniversariante(s)</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Nome</th><th>Tipo</th><th>Turma / vínculo</th><th>Idade no ano</th></tr></thead>
            <tbody>
              {people.map((p) => (
                <tr key={`${p.kind}-${p.id}`}><td>{String(p.day).padStart(2, "0")}/{String(p.month).padStart(2, "0")}</td><td><strong>{p.name}</strong></td><td>{p.kind}</td><td>{p.link}</td><td>{p.age}</td></tr>
              ))}
              {!people.length ? <tr><td colSpan={5}>Nenhum aniversariante no período.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <p className="small muted">Considera evangelizandos com matrícula vigente no ano e evangelizadores aprovados e ativos no departamento.</p>
      </section>
    </div>
  );
}
