"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PLAN_STATUSES, SPECIAL_TYPES, type EducationDepartment } from "@/lib/education";

type Plan = { objective: string; priorities: string; expected: string; notes: string; version: number };
type Lesson = { date: string; group: string; theme: string; responsible: string; objective: string; reference: string; resources: string; status: string };
type Item = {
  id: string; kind: "special" | "management"; item_date: string | null; month: number | null; title: string; item_type: string;
  purpose: string; audience: string; location: string; responsible: string; requirements: string; status: string;
};
type Payload = { plan: Plan; saved: boolean; items: Item[]; lessons: Lesson[]; returnDate: string; canEdit: boolean };

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const br = (d: string | null) => (d ? d.split("-").reverse().join("/") : "A definir");
const TEXTS: [keyof Plan, string][] = [["objective", "Objetivo geral do ano"], ["priorities", "Diretrizes / prioridades"], ["expected", "Resultados esperados"], ["notes", "Observações da coordenação"]];

export function PlanClient({ department }: { department: EducationDepartment }) {
  const [year, setYear] = useState(() => Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()).slice(0, 4)));
  const [data, setData] = useState<Payload | null>(null);
  const [lessonDraft, setLessonDraft] = useState<Map<string, Partial<Lesson>>>(new Map());
  const [editingItem, setEditingItem] = useState<Item | { kind: "special" | "management" } | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const base = `/api/education/${department}/plan`;

  const load = useCallback(async () => {
    const response = await fetch(`${base}?year=${year}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setData(body);
    setLessonDraft(new Map());
  }, [base, year]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load().catch((e) => setError(e.message)); }, [load]);

  async function send(url: string, method: string, payload: object) {
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    return body;
  }
  async function run(work: () => Promise<string>) {
    setBusy(true); setError(""); setMessage("");
    try { setMessage(await work()); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Falha ao salvar."); }
    finally { setBusy(false); }
  }

  function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    void run(async () => {
      await send(base, "PUT", { year, ...Object.fromEntries(TEXTS.map(([k]) => [k, String(values.get(k) ?? "")])), version: data!.plan.version });
      return data!.saved ? "Planejamento atualizado." : "Planejamento do ano criado com as ações de organização padrão.";
    });
  }

  function saveLessons() {
    void run(async () => {
      const entries = [...lessonDraft].map(([key, change]) => { const [date, group] = key.split("|"); return { date, group, ...change }; });
      await send(`/api/education/${department}/schedule`, "PUT", { entries });
      return "Programa de aulas atualizado.";
    });
  }

  function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const kind = editingItem!.kind;
    const payload = {
      kind,
      item_date: kind === "special" ? String(values.get("item_date") ?? "") || null : null,
      month: kind === "management" ? Number(values.get("month")) : null,
      title: String(values.get("title") ?? ""),
      item_type: String(values.get("item_type") ?? ""),
      purpose: String(values.get("purpose") ?? ""),
      audience: String(values.get("audience") ?? ""),
      location: String(values.get("location") ?? ""),
      responsible: String(values.get("responsible") ?? ""),
      requirements: String(values.get("requirements") ?? ""),
      status: String(values.get("status") ?? "Planejado")
    };
    void run(async () => {
      if ("id" in editingItem!) await send(`${base}/items`, "PATCH", { ...payload, id: editingItem.id });
      else await send(`${base}/items`, "POST", { ...payload, year });
      setEditingItem(null);
      return "Item salvo.";
    });
  }

  function removeItem(item: Item) {
    if (!window.confirm(`Excluir “${item.title}” do planejamento?`)) return;
    void run(async () => { await send(`${base}/items`, "DELETE", { id: item.id }); return "Item excluído."; });
  }

  if (!data) return error ? <div className="error" role="alert">{error}</div> : <div className="notice">Carregando planejamento…</div>;
  const { canEdit } = data;
  const lessonValue = (l: Lesson, field: keyof Lesson) => (lessonDraft.get(`${l.date}|${l.group}`)?.[field] ?? l[field]) as string;
  const setLesson = (l: Lesson, field: keyof Lesson, value: string) =>
    setLessonDraft((current) => new Map(current).set(`${l.date}|${l.group}`, { ...current.get(`${l.date}|${l.group}`), [field]: value }));
  const specials = data.items.filter((i) => i.kind === "special");
  const management = data.items.filter((i) => i.kind === "management");
  const done = data.lessons.filter((l) => l.status === "Realizado").length;
  const item = editingItem && "id" in editingItem ? editingItem : null;
  const canEditItems = canEdit && data.saved;

  return (
    <div className="grid">
      <section className="card no-print">
        <div className="toolbar">
          <label>Ano<input type="number" min={2020} max={2100} value={year} onChange={(e) => { const y = Number(e.target.value); if (y >= 2020 && y <= 2100) setYear(y); }} style={{ width: 120 }} /></label>
          <button className="button" onClick={() => window.print()}>⎙ Planejamento</button>
        </div>
        <p className="small" style={{ marginBottom: 0 }}><strong>Recesso: janeiro e fevereiro.</strong> Retorno das atividades em <strong>{br(data.returnDate)}</strong> (primeiro domingo de março). Aulas aos domingos; dois evangelizadores por turma; idade considerada em 30 de junho.</p>
      </section>
      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}
      <div className="grid cards">
        <article className="card kpi"><span className="small muted">Aulas no ano</span><b>{data.lessons.length}</b></article>
        <article className="card kpi"><span className="small muted">Aulas realizadas</span><b>{done}</b></article>
        <article className="card kpi"><span className="small muted">Atividades especiais</span><b>{specials.length}</b></article>
      </div>

      <section className="card">
        <h2>Diretrizes do ano {data.saved ? "" : "(modelo — ainda não salvo)"}</h2>
        <form className="form-stack" onSubmit={savePlan} key={`${year}-${data.plan.version}`}>
          <div className="form-row">
            {TEXTS.map(([key, text]) => <label key={key}>{text}<textarea name={key} rows={4} maxLength={4000} disabled={!canEdit} defaultValue={String(data.plan[key])} /></label>)}
          </div>
          {canEdit ? <div className="row-actions"><button className="button primary" disabled={busy}>{data.saved ? "Salvar diretrizes" : "Criar planejamento do ano"}</button></div> : null}
        </form>
      </section>

      <section className="card">
        <div className="toolbar">
          <div><h2 style={{ marginBottom: 2 }}>1. Programa de aulas</h2><span className="small muted">Data, turma, tema e evangelizadores vêm do Cronograma; aqui ficam objetivo, material, recursos e situação.</span></div>
          {canEdit ? <button className="button primary no-print" disabled={busy || !lessonDraft.size} onClick={saveLessons}>{lessonDraft.size ? `Salvar ${lessonDraft.size} aula(s)` : "Tudo salvo"}</button> : null}
        </div>
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table>
            <thead><tr><th>Data</th><th>Turma</th><th>Tema (cronograma)</th><th>Objetivo da aula</th><th>Referência / material</th><th>Evangelizadores</th><th>Recursos / dinâmica</th><th>Situação</th></tr></thead>
            <tbody>
              {data.lessons.map((l) => (
                <tr key={`${l.date}|${l.group}`}>
                  <td>{br(l.date)}</td><td>{l.group}</td><td>{l.theme || <span className="muted">A definir no cronograma</span>}</td>
                  {(["objective", "reference"] as const).map((f) => <td key={f}><input value={lessonValue(l, f)} disabled={!canEdit} maxLength={f === "reference" ? 300 : 1000} onChange={(e) => setLesson(l, f, e.target.value)} /></td>)}
                  <td>{l.responsible || "—"}</td>
                  <td><input value={lessonValue(l, "resources")} disabled={!canEdit} maxLength={1000} onChange={(e) => setLesson(l, "resources", e.target.value)} /></td>
                  <td><select value={lessonValue(l, "status")} disabled={!canEdit} onChange={(e) => setLesson(l, "status", e.target.value)}>{PLAN_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editingItem ? (
        <section className="card">
          <h2>{item ? "Editar item" : editingItem.kind === "special" ? "Nova atividade especial" : "Nova ação de organização"}</h2>
          <form className="form-stack" onSubmit={saveItem} key={item?.id ?? editingItem.kind}>
            <div className="form-row">
              {editingItem.kind === "special" ? <>
                <label>Data prevista<input name="item_date" type="date" min={data.returnDate} max={`${year}-12-31`} defaultValue={item?.item_date ?? ""} /></label>
                <label>Tipo<select name="item_type" defaultValue={item?.item_type || "Evento"}>{SPECIAL_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
              </> : (
                <label>Mês<select name="month" defaultValue={item?.month ?? 3}>{MONTHS.map((m, i) => <option key={m} value={i + 1} disabled={i < 2}>{i < 2 ? `${m} · Recesso` : m}</option>)}</select></label>
              )}
              <label>Situação<select name="status" defaultValue={item?.status ?? "Planejado"}>{PLAN_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
            </div>
            <label>{editingItem.kind === "special" ? "Passeio / evento / atividade *" : "Ação *"}<input name="title" required maxLength={300} defaultValue={item?.title} /></label>
            {editingItem.kind === "special" ? <div className="form-row">
              <label>Finalidade educativa / doutrinária<input name="purpose" maxLength={1000} defaultValue={item?.purpose} /></label>
              <label>Turma / público<input name="audience" maxLength={160} defaultValue={item?.audience || "Todas as turmas"} /></label>
              <label>Local<input name="location" maxLength={300} defaultValue={item?.location} /></label>
            </div> : null}
            <div className="form-row">
              <label>Responsável<input name="responsible" maxLength={300} defaultValue={item?.responsible || "Coordenação"} /></label>
              <label>{editingItem.kind === "special" ? "Necessidades / autorizações" : "Meta / resultado esperado"}<input name="requirements" maxLength={1000} defaultValue={item?.requirements} /></label>
            </div>
            <div className="row-actions">
              <button className="button primary" disabled={busy}>Salvar</button>
              <button type="button" className="button" onClick={() => setEditingItem(null)}>Cancelar</button>
            </div>
          </form>
        </section>
      ) : null}

      {([["special", "2. Passeios, eventos e atividades especiais", specials], ["management", "3. Organização e acompanhamento do departamento", management]] as const).map(([kind, title, list]) => (
        <section className="card" key={kind}>
          <div className="toolbar">
            <h2>{title}</h2>
            {canEditItems ? <button className="button primary no-print" onClick={() => setEditingItem({ kind })}>+ Novo item</button> : null}
          </div>
          {!data.saved ? <p className="small muted">Crie o planejamento do ano para incluir itens.</p> : null}
          <div className="table-wrap">
            <table>
              <thead><tr><th>{kind === "special" ? "Data" : "Mês"}</th>{kind === "special" ? <th>Tipo</th> : null}<th>{kind === "special" ? "Atividade" : "Ação"}</th>{kind === "special" ? <><th>Finalidade</th><th>Público / local</th></> : null}<th>Responsável</th><th>{kind === "special" ? "Necessidades" : "Meta"}</th><th>Situação</th>{canEditItems ? <th className="no-print">Ação</th> : null}</tr></thead>
              <tbody>
                {list.map((i) => (
                  <tr key={i.id}>
                    <td>{kind === "special" ? br(i.item_date) : MONTHS[(i.month ?? 1) - 1]}</td>
                    {kind === "special" ? <td>{i.item_type}</td> : null}
                    <td><strong>{i.title}</strong></td>
                    {kind === "special" ? <><td>{i.purpose || "—"}</td><td>{i.audience || "—"}<br /><span className="small muted">{i.location}</span></td></> : null}
                    <td>{i.responsible || "—"}</td><td>{i.requirements || "—"}</td><td>{i.status}</td>
                    {canEditItems ? <td className="no-print"><div className="row-actions"><button className="button" onClick={() => setEditingItem(i)}>Editar</button><button className="button danger" onClick={() => removeItem(i)}>Excluir</button></div></td> : null}
                  </tr>
                ))}
                {!list.length ? <tr><td colSpan={9}>Nenhum item.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
