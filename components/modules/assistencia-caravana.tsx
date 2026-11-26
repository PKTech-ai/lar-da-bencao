"use client";

import { useState } from "react";
import { brDate, lastSaturday, programYear, yearSaturdays } from "@/lib/monthly-saturdays";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Manaus" }).format(new Date());

/** Programação da Caravana do Amor: sempre no último sábado do mês. Só mostra as datas (nada a digitar). */
export function CaravanaAmorPanel() {
  const [now] = useState(today);
  const current = Number(now.slice(0, 4));
  const [year, setYear] = useState(() => programYear(now));
  const years = Array.from({ length: 4 }, (_, i) => current - 1 + i);
  if (!years.includes(year)) years.push(year);
  const months = yearSaturdays(year);
  // A próxima de verdade (pode ser ainda neste mês, mesmo olhando o ano seguinte).
  const thisMonth = now.slice(0, 7);
  const [y, m] = thisMonth.split("-").map(Number);
  const next = lastSaturday(thisMonth) >= now ? lastSaturday(thisMonth) : lastSaturday(m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`);

  return (
    <section className="card">
      <div className="row-actions no-print">
        <label>Ano
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>
      <h2>Caravana do Amor — Programação {year}</h2>
      <p className="small muted">A Caravana do Amor acontece sempre no <strong>último sábado</strong> de cada mês. O penúltimo sábado é do Culto no Lar dos Trabalhadores, por isso as datas nunca coincidem.</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Mês</th><th>Data</th><th>Situação</th></tr></thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month}>
                <td><strong>{m.label}</strong></td>
                <td><strong>{brDate(m.caravana)}</strong><div className="small muted">Último sábado do mês</div></td>
                <td>{m.caravana < now ? <span className="small muted">Já passou</span>
                  : m.caravana === next ? <span className="audit-badge">Próxima</span>
                  : <span className="small muted">Programada</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
