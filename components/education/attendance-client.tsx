"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { attendanceSummary, type EducationDepartment, type Mark } from "@/lib/education";

type Payload = { dates: string[]; students: { id: string; full_name: string; group: string }[]; marks: { evangelizando_id: string; date: string; mark: Mark }[]; canEdit?: boolean };

const currentMonth = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()).slice(0, 7);
const cycle: Record<string, Mark | ""> = { "": "P", P: "F", F: "" };

export function EducationAttendanceClient({ department }: { department: EducationDepartment }) {
  const [ym, setYm] = useState(currentMonth);
  const [data, setData] = useState<Payload | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [draft, setDraft] = useState<Map<string, Mark | "">>(new Map());
  const [group, setGroup] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/education/${department}/attendance?month=${ym}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setData(body);
    setCanEdit(Boolean(body.canEdit));
    setDraft(new Map());
  }, [department, ym]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load().catch((e) => setError(e.message)); }, [load]);

  const saved = useMemo(() => new Map((data?.marks ?? []).map((m) => [`${m.evangelizando_id}|${m.date}`, m.mark])), [data]);
  const value = (key: string) => (draft.has(key) ? draft.get(key)! : saved.get(key) ?? "");
  const changes = [...draft].filter(([key, mark]) => mark !== (saved.get(key) ?? ""));
  const groups = [...new Set((data?.students ?? []).map((s) => s.group))];
  const students = (data?.students ?? []).filter((s) => !group || s.group === group);
  const allMarks = students.flatMap((s) => (data?.dates ?? []).map((d) => value(`${s.id}|${d}`)).filter(Boolean).map((mark) => ({ evangelizando_id: s.id, mark: mark as Mark })));
  const summary = attendanceSummary(allMarks);

  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const entries = changes.map(([key, mark]) => { const [evangelizando_id, date] = key.split("|"); return { evangelizando_id, date, mark: mark || null }; });
      const response = await fetch(`/api/education/${department}/attendance`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month: ym, entries }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setData((current) => ({ ...body, canEdit: current?.canEdit }));
      setDraft(new Map());
      setMessage("Chamada salva e registrada no Dedo-duro.");
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
          <div className="row-actions">
            <label>Mês<input type="month" value={ym} onChange={(e) => { if (!e.target.value) return; if (changes.length && !window.confirm("Há marcações não salvas. Descartar?")) return; setYm(e.target.value); }} /></label>
            <label>{department === "infancia" ? "Turma" : "Grupo"}<select value={group} onChange={(e) => setGroup(e.target.value)}><option value="">Todas</option>{groups.map((g) => <option key={g}>{g}</option>)}</select></label>
          </div>
          <div className="row-actions">
            {canEdit ? <button className="button primary" disabled={busy || !changes.length} onClick={() => void save()}>{changes.length ? `Salvar ${changes.length} marcação(ões)` : "Tudo salvo"}</button> : null}
            <button className="button" onClick={() => window.print()}>⎙ Frequência mensal</button>
          </div>
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>Toque na célula para alternar: P = Presente, F = Falta, em branco = chamada não realizada. Aulas só aos domingos; recesso em janeiro e fevereiro.</p>
      </section>
      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}
      <div className="grid cards">
        <article className="card kpi"><span className="small muted">Presenças</span><b>{summary.present}</b></article>
        <article className="card kpi"><span className="small muted">Faltas</span><b>{summary.absent}</b></article>
        <article className="card kpi"><span className="small muted">Frequência geral</span><b>{summary.rate === null ? "—" : `${summary.rate}%`}</b></article>
      </div>
      {data && !data.dates.length ? <div className="notice">Sem aulas neste mês (recesso de janeiro e fevereiro).</div> : null}
      {data && data.dates.length ? (
        <section className="card scale-sheet">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Evangelizando</th><th>{department === "infancia" ? "Turma" : "Grupo"}</th>{data.dates.map((d) => <th key={d}>{d.slice(8)}/{d.slice(5, 7)}</th>)}<th>P</th><th>F</th><th>Freq.</th></tr></thead>
              <tbody>
                {students.map((s) => {
                  const marks = data.dates.map((d) => value(`${s.id}|${d}`));
                  const p = marks.filter((m) => m === "P").length;
                  const f = marks.filter((m) => m === "F").length;
                  return (
                    <tr key={s.id}>
                      <td><strong>{s.full_name}</strong></td>
                      <td>{s.group}</td>
                      {data.dates.map((d) => {
                        const key = `${s.id}|${d}`;
                        const mark = value(key);
                        return (
                          <td key={d}>
                            <button type="button" className={`button${mark === "P" ? " primary" : mark === "F" ? " danger" : ""}`} disabled={!canEdit || busy}
                              aria-label={`${s.full_name} em ${d}: ${mark || "sem chamada"}`} style={{ minHeight: 36, minWidth: 44, padding: "4px 8px" }}
                              onClick={() => setDraft((current) => new Map(current).set(key, cycle[mark]))}>{mark || "—"}</button>
                          </td>
                        );
                      })}
                      <td>{p}</td><td>{f}</td><td>{p + f ? `${Math.round((p / (p + f)) * 100)}%` : "—"}</td>
                    </tr>
                  );
                })}
                {!students.length ? <tr><td colSpan={data.dates.length + 5}>Nenhum evangelizando com matrícula vigente neste filtro.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
