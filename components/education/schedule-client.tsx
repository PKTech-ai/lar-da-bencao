"use client";

import { useCallback, useEffect, useState } from "react";
import type { EducationDepartment } from "@/lib/education";

type Row = { date: string; group: string; theme: string; responsible: string };

const currentMonth = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()).slice(0, 7);
const br = (d: string) => d.split("-").reverse().join("/");

export function ScheduleClient({ department }: { department: EducationDepartment }) {
  const [ym, setYm] = useState(currentMonth);
  const [rows, setRows] = useState<Row[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [draft, setDraft] = useState<Map<string, Partial<Row>>>(new Map());
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/education/${department}/schedule?month=${ym}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setRows(body.rows);
    setCanEdit(body.canEdit);
    setDraft(new Map());
  }, [department, ym]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load().catch((e) => setError(e.message)); }, [load]);

  const edit = (row: Row, field: "theme" | "responsible", value: string) =>
    setDraft((current) => new Map(current).set(`${row.date}|${row.group}`, { ...current.get(`${row.date}|${row.group}`), [field]: value }));

  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const entries = [...draft].map(([key, change]) => { const [date, group] = key.split("|"); return { date, group, ...change }; });
      const response = await fetch(`/api/education/${department}/schedule`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entries }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setMessage("Cronograma salvo. O programa de aulas do Planejamento Anual usa estes dados.");
      await load();
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
          <label>Mês<input type="month" value={ym} onChange={(e) => { if (!e.target.value) return; if (draft.size && !window.confirm("Há alterações não salvas. Descartar?")) return; setYm(e.target.value); }} /></label>
          <div className="row-actions">
            {canEdit ? <button className="button primary" disabled={busy || !draft.size} onClick={() => void save()}>{draft.size ? `Salvar ${draft.size} linha(s)` : "Tudo salvo"}</button> : null}
            <button className="button" onClick={() => window.print()}>⎙ Cronograma</button>
          </div>
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>Uma linha para cada {department === "infancia" ? "turma" : "grupo"} em cada domingo com aula. Os evangelizadores vinculados à turma aparecem como padrão.</p>
      </section>
      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}
      {!rows.length ? <div className="notice">Sem aulas neste mês (recesso de janeiro e fevereiro).</div> : (
        <section className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Data</th><th>Dia</th><th>{department === "infancia" ? "Turma" : "Grupo"}</th><th>Tema / atividade</th><th>Evangelizadores</th></tr></thead>
              <tbody>
                {rows.map((row) => {
                  const change = draft.get(`${row.date}|${row.group}`) ?? {};
                  return (
                    <tr key={`${row.date}|${row.group}`}>
                      <td>{br(row.date)}</td><td>Domingo</td><td><strong>{row.group}</strong></td>
                      <td><input value={change.theme ?? row.theme} disabled={!canEdit} maxLength={300} placeholder="Tema / atividade" onChange={(e) => edit(row, "theme", e.target.value)} /></td>
                      <td><input value={change.responsible ?? row.responsible} disabled={!canEdit} maxLength={300} placeholder="Evangelizadores" onChange={(e) => edit(row, "responsible", e.target.value)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
