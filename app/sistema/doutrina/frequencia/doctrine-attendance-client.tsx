"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ATTENDANCE_CONFIG, ATTENDANCE_DOWS, type AttendanceValue } from "@/lib/doutrina-attendance";
import { DAY_HOURS, monthDays } from "@/lib/doutrina-scale";

type Stats = { perDay: Record<string, number>; encounters: number; total: number; average: number; max: { date: string; total: number } | null };

const currentMonth = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()).slice(0, 7);
const br = (date: string) => date.slice(5).split("-").reverse().join("/");

export function DoctrineAttendanceClient() {
  const [ym, setYm] = useState(currentMonth);
  const [saved, setSaved] = useState<Map<string, number>>(new Map());
  const [draft, setDraft] = useState<Map<string, string>>(new Map());
  const [stats, setStats] = useState<Stats | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const apply = useCallback((values: AttendanceValue[], nextStats: Stats) => {
    setSaved(new Map(values.map((v) => [`${v.date}|${v.row_id}`, v.value])));
    setDraft(new Map());
    setStats(nextStats);
  }, []);

  const load = useCallback(async () => {
    const response = await fetch(`/api/doutrina/attendance?month=${ym}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    apply(body.values, body.stats);
    setCanEdit(body.canEdit);
  }, [ym, apply]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load().catch((e) => setError(e.message)); }, [load]);

  const cell = (key: string) => draft.get(key) ?? (saved.has(key) ? String(saved.get(key)) : "");
  const dayTotal = useCallback((date: string, dow: number) => ATTENDANCE_CONFIG[dow].rows.reduce((sum, row) => {
    if (!("id" in row)) return sum;
    const key = `${date}|${row.id}`;
    const raw = draft.get(key) ?? (saved.has(key) ? String(saved.get(key)) : "");
    return sum + (Number(raw) || 0);
  }, 0), [draft, saved]);
  const dirty = useMemo(() => [...draft].filter(([key, value]) => value !== (saved.has(key) ? String(saved.get(key)) : "")), [draft, saved]);

  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const entries = dirty.map(([key, value]) => {
        const [date, row_id] = key.split("|");
        return { date, row_id, value: value === "" ? null : Math.max(0, Math.trunc(Number(value))) };
      });
      const response = await fetch("/api/doutrina/attendance", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month: ym, entries }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      apply(body.values, body.stats);
      setMessage("Frequência salva e registrada no Dedo-duro.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid">
      <section className="card no-print">
        <div className="toolbar">
          <label>Mês<input type="month" value={ym} onChange={(e) => { if (!e.target.value) return; if (dirty.length && !window.confirm("Há lançamentos não salvos. Descartar?")) return; setYm(e.target.value); }} /></label>
          <div className="row-actions">
            {canEdit ? <button className="button primary" disabled={busy || !dirty.length} onClick={() => void save()}>{dirty.length ? `Salvar ${dirty.length} alteração(ões)` : "Tudo salvo"}</button> : null}
            <button className="button" onClick={() => window.print()}>⎙ Imprimir</button>
          </div>
        </div>
      </section>
      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}
      <div className="grid cards">
        <article className="card kpi"><span className="small muted">Encontros lançados</span><b>{stats?.encounters ?? 0}</b></article>
        <article className="card kpi"><span className="small muted">Total mensal</span><b>{stats?.total ?? 0}</b></article>
        <article className="card kpi"><span className="small muted">Média por encontro</span><b>{stats?.average ?? 0}</b></article>
      </div>
      {ATTENDANCE_DOWS.map((dow) => {
        const config = ATTENDANCE_CONFIG[dow];
        const days = monthDays(ym, dow);
        if (!days.length) return null;
        const dates = days.map((day) => `${ym}-${String(day).padStart(2, "0")}`);
        return (
          <section className="card scale-sheet" key={dow}>
            <div className="toolbar"><strong>{config.label}</strong><span className="small muted">{DAY_HOURS[dow]} · {days.length} encontro(s)</span></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Atividade / classificação</th>{dates.map((d) => <th key={d}>{br(d)}</th>)}</tr></thead>
                <tbody>
                  {config.rows.map((row) => "section" in row ? (
                    <tr key={row.section}><td colSpan={dates.length + 1}><strong>{row.section}</strong></td></tr>
                  ) : (
                    <tr key={row.id}>
                      <td>{row.label}</td>
                      {dates.map((date) => {
                        const key = `${date}|${row.id}`;
                        return (
                          <td key={date}>
                            <input type="number" min={0} step={1} inputMode="numeric" disabled={!canEdit} value={cell(key)}
                              aria-label={`${row.label} em ${br(date)}`}
                              onChange={(e) => setDraft((current) => new Map(current).set(key, e.target.value))} style={{ minHeight: 36, width: 80 }} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr><td><strong>TOTAL DO DIA</strong><br /><span className="small muted">Soma automática</span></td>{dates.map((date) => <td key={date}><strong>{dayTotal(date, dow)}</strong></td>)}</tr>
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
      <p className="small muted">O total do dia é a soma das participações nas atividades. Uma pessoa em mais de uma atividade pode aparecer mais de uma vez na soma.</p>
    </div>
  );
}
