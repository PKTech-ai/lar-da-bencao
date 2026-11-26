"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { CULTO_NAME_MAX, CULTO_PURPOSE } from "@/lib/doutrina-extras";
import { brDate } from "@/lib/monthly-saturdays";

type CultoMonth = { month: string; label: string; culto: string; caravana: string; host_name: string; version: number };
type Payload = { year: number; months: CultoMonth[]; canEdit: boolean };

/** Programação anual do Culto no Lar: escolher um penúltimo sábado livre e digitar o nome do trabalhador. */
export function CultoClient({ initialYear, years }: { initialYear: number; years: number[] }) {
  const [year, setYear] = useState(initialYear);
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  /** Sábado com a caixa de nome aberta (mês AAAA-MM) e o texto digitado. */
  const [editing, setEditing] = useState<{ month: string; text: string } | null>(null);

  // Só a leitura mais recente vale: ao trocar de ano depressa, uma resposta antiga não sobrescreve a nova.
  const loadSeq = useRef(0);
  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    const response = await fetch(`/api/doutrina/culto?year=${year}`, { cache: "no-store" });
    const body = await response.json();
    if (seq !== loadSeq.current) return;
    if (!response.ok) throw new Error(body.error ?? "Não foi possível carregar a programação.");
    setData(body);
  }, [year]);

  useEffect(() => { void load().catch((e) => setError(e.message)); }, [load]);

  async function save(row: CultoMonth, hostName: string, done: string) {
    setBusy(true); setError(""); setMessage("");
    const response = await fetch("/api/doutrina/culto", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: row.month, host_name: hostName, version: row.version })
    });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(body.error ?? "Não foi possível gravar.");
      if (response.status === 409) void load().catch(() => undefined);
      return;
    }
    setEditing(null);
    setMessage(done);
    await load().catch((e) => setError(e.message));
  }

  function submit(event: FormEvent<HTMLFormElement>, row: CultoMonth) {
    event.preventDefault();
    const text = editing?.text.trim() ?? "";
    if (text.length < 2) {
      setError("Digite o nome do trabalhador.");
      return;
    }
    void save(row, text, `${text} ficou com o Culto no Lar de ${brDate(row.culto)}.`);
  }

  const free = data?.months.filter((m) => !m.host_name).length ?? 0;

  return (
    <div className="form-stack">
      <section className="card">
        <p className="small">{CULTO_PURPOSE}</p>
        <p className="small muted">Um culto por mês, sempre no <strong>penúltimo sábado</strong>. O último sábado é da Caravana do Amor, por isso as datas nunca coincidem.</p>
      </section>

      <section className="card">
        <div className="row-actions no-print">
          <label>Ano
            <select value={year} onChange={(e) => { setEditing(null); setMessage(""); setError(""); setYear(Number(e.target.value)); }}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          {data ? <span className="small muted">{free ? `${free} sábado(s) livre(s) em ${data.year}` : `Todos os sábados de ${data.year} já têm trabalhador`}</span> : null}
        </div>
        {error ? <div className="error" role="alert">{error}</div> : null}
        {message ? <div className="success" role="status">{message}</div> : null}
        <h2>Programação {year} — Culto no Lar dos Trabalhadores</h2>
        {data ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Mês</th><th>Data</th><th>Trabalhador</th><th>Situação</th></tr></thead>
              <tbody>
                {data.months.map((row) => (
                  <tr key={row.month}>
                    <td><strong>{row.label}</strong></td>
                    <td>
                      <strong>{brDate(row.culto)}</strong>
                      <div className="small muted">Penúltimo sábado · Caravana do Amor em {brDate(row.caravana).slice(0, 5)}</div>
                    </td>
                    <td>
                      {editing?.month === row.month ? (
                        <form className="row-actions" onSubmit={(e) => submit(e, row)}>
                          <input autoFocus value={editing.text} maxLength={CULTO_NAME_MAX} placeholder="Digite o nome do trabalhador"
                            aria-label={`Nome do trabalhador — Culto no Lar de ${brDate(row.culto)}`}
                            onChange={(e) => setEditing({ month: row.month, text: e.target.value })}
                            onKeyDown={(e) => { if (e.key === "Escape") setEditing(null); }} />
                          <button className="button primary" disabled={busy}>Gravar</button>
                          <button type="button" className="button" disabled={busy} onClick={() => setEditing(null)}>Cancelar</button>
                        </form>
                      ) : row.host_name ? (
                        <div className="row-actions">
                          <span>{row.host_name}</span>
                          {data.canEdit ? <>
                            <button type="button" className="link-button no-print" disabled={busy} onClick={() => setEditing({ month: row.month, text: row.host_name })}>Trocar</button>
                            <button type="button" className="link-button no-print" disabled={busy}
                              onClick={() => { if (window.confirm(`Liberar o sábado ${brDate(row.culto)} (${row.host_name})?`)) void save(row, "", `Sábado ${brDate(row.culto)} liberado.`); }}>Liberar</button>
                          </> : null}
                        </div>
                      ) : data.canEdit ? (
                        <button type="button" className="button no-print" disabled={busy} onClick={() => { setError(""); setEditing({ month: row.month, text: "" }); }}>Escolher este sábado</button>
                      ) : <span className="muted">—</span>}
                    </td>
                    <td>{row.host_name ? <span className="audit-badge">Agendado</span> : <span className="small muted">Disponível</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !error ? <p className="small muted">Carregando…</p> : null}
      </section>
    </div>
  );
}
