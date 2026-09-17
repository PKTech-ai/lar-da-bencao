"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { classify, EDUCATION_LABEL, guardianRequired, renewalTargetYear, type EducationDepartment } from "@/lib/education";
import { uploadAttachment } from "@/lib/upload-client";

type Row = {
  id: string; full_name: string; birth_date: string; filled_date: string; guardian_name: string | null; guardian_relation: string | null;
  guardian_phone: string | null; whatsapp: string | null; address: string | null; point_reference: string | null;
  father_name: string | null; father_contact: string | null; mother_name: string | null; mother_contact: string | null;
  religion: string | null; marital_status: string | null; valid_through_year: number; manual_inactive: boolean;
  inactive_at: string | null; rancho_requested: boolean; notes: string; photo_attachment_id: string | null; version: number;
  active: boolean; status_reason: string; current_group: string | null; current_age: number | null;
};

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const br = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");
const FIELDS: [keyof Row, string, number][] = [
  ["guardian_relation", "Parentesco do responsável", 60], ["guardian_phone", "Telefone", 40], ["whatsapp", "WhatsApp", 40],
  ["address", "Endereço", 300], ["point_reference", "Ponto de referência", 300], ["father_name", "Pai", 160],
  ["father_contact", "Contato do pai", 40], ["mother_name", "Mãe", 160], ["mother_contact", "Contato da mãe", 40],
  ["religion", "Religião", 80], ["marital_status", "Estado civil", 40]
];

export function EvangelizandosClient({ department }: { department: EducationDepartment }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [birth, setBirth] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const label = EDUCATION_LABEL[department];

  const load = useCallback(async () => {
    const response = await fetch(`/api/evangelizandos?department=${department}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setRows(body.evangelizandos);
    setCanEdit(body.canEdit);
  }, [department]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load().catch((e) => setError(e.message)); }, [load]);

  async function send(url: string, method: string, payload?: object) {
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: payload ? JSON.stringify(payload) : undefined });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    return body;
  }
  async function run(work: () => Promise<string>) {
    setBusy(true); setError(""); setMessage("");
    try { setMessage(await work()); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Falha na operação."); await load().catch(() => undefined); }
    finally { setBusy(false); }
  }

  function open(row: Row | "new") {
    setEditing(row);
    setBirth(row === "new" ? "" : row.birth_date);
    setError(""); setMessage("");
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const payload: Record<string, unknown> = Object.fromEntries(["full_name", "birth_date", "filled_date", "guardian_name", "notes", ...FIELDS.map(([k]) => k)].map((k) => [k, String(values.get(k) ?? "")]));
    payload.rancho_requested = values.get("rancho_requested") === "on";
    const photo = (form.elements.namedItem("photo") as HTMLInputElement | null)?.files?.[0];
    void run(async () => {
      let id: string;
      let version: number;
      let msg: string;
      if (editing === "new") {
        const body = await send("/api/evangelizandos", "POST", { ...payload, department_key: department });
        id = body.id; version = 1; msg = `Matrícula salva — ${body.group}.`;
      } else {
        const row = editing as Row;
        const body = await send(`/api/evangelizandos/${row.id}`, "PATCH", { ...payload, op: "update", manual_inactive: values.get("manual_inactive") === "on", version: row.version });
        id = row.id; version = row.version + 1; msg = `Matrícula atualizada — ${body.group}.`;
      }
      if (photo) {
        const attachmentId = await uploadAttachment(photo, `evangelizando_photo_${department}`, id);
        await send(`/api/evangelizandos/${id}`, "PATCH", { op: "photo", attachment_id: attachmentId, version });
      }
      setEditing(null);
      return payload.rancho_requested ? `${msg} A solicitação de rancho fica registrada para análise do Dpto de Assistência Social.` : msg;
    });
  }

  function renew(row: Row) {
    const target = renewalTargetYear(row, Number(today().slice(0, 4)));
    if (!window.confirm(`Renovar a matrícula de ${row.full_name} até ${target}?`)) return;
    void run(async () => {
      const body = await send(`/api/evangelizandos/${row.id}`, "PATCH", { op: "renew", version: row.version });
      setEditing(null);
      return `Matrícula renovada até ${body.valid_through_year} — ${body.group}.`;
    });
  }

  function remove(row: Row) {
    if (!window.confirm(`Excluir definitivamente a ficha de “${row.full_name}”?\n\nAs marcações de frequência vinculadas também serão excluídas.`)) return;
    void run(async () => { await send(`/api/evangelizandos/${row.id}`, "DELETE"); setEditing(null); return "Ficha excluída."; });
  }

  const form = editing === "new" ? null : editing;
  const referenceYear = form ? Math.min(Number(today().slice(0, 4)), form.valid_through_year) : Number(today().slice(0, 4));
  const preview = useMemo(() => (birth ? classify(birth, department, referenceYear) : null), [birth, department, referenceYear]);
  const needsGuardian = birth ? guardianRequired(department, birth, today()) : department === "infancia";
  const term = search.trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const visible = rows.filter((r) => (status === "all" || (status === "active") === r.active)
    && (!term || [r.full_name, r.current_group, r.guardian_name, r.guardian_phone, r.whatsapp].join(" ").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(term)));

  return (
    <div className="grid">
      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}
      {editing ? (
        <section className="card">
          <h2>{form ? `Matrícula — ${form.full_name}` : `Nova matrícula — ${label}`}</h2>
          {form ? (
            <div className="notice" style={{ marginBottom: 12 }}>
              Situação: <strong>{form.active ? "Ativa" : "Inativa"}</strong> ({form.status_reason}) · matrícula válida até <strong>31/12/{form.valid_through_year}</strong>
              {canEdit ? <> · <button type="button" className="link-button" onClick={() => renew(form)}>Renovar para {renewalTargetYear(form, Number(today().slice(0, 4)))}</button></> : null}
            </div>
          ) : null}
          <form className="form-stack" onSubmit={save} key={form?.id ?? "new"}>
            <div className="form-row">
              <label>Nome completo *<input name="full_name" required minLength={2} maxLength={160} defaultValue={form?.full_name} /></label>
              <label>Data de nascimento *<input name="birth_date" type="date" required max={today()} value={birth} onChange={(e) => setBirth(e.target.value)} /></label>
              <label>Data da ficha<input name="filled_date" type="date" max={today()} defaultValue={form?.filled_date ?? today()} disabled={Boolean(form)} /></label>
            </div>
            {preview ? <div className={preview.valid ? "success" : "error"}>{preview.message}</div> : null}
            <div className="form-row">
              <label>Responsável{needsGuardian ? " *" : ""}<input name="guardian_name" maxLength={160} required={needsGuardian} defaultValue={form?.guardian_name ?? ""} /></label>
              {FIELDS.slice(0, 3).map(([key, text, max]) => <label key={key}>{text}<input name={key} maxLength={max} defaultValue={(form?.[key] as string) ?? ""} /></label>)}
            </div>
            <div className="form-row">
              {FIELDS.slice(3).map(([key, text, max]) => <label key={key}>{text}<input name={key} maxLength={max} defaultValue={(form?.[key] as string) ?? ""} /></label>)}
            </div>
            <label>Observações<textarea name="notes" rows={2} maxLength={2000} defaultValue={form?.notes ?? ""} /></label>
            <label>Foto (JPG ou PNG){form?.photo_attachment_id ? " — já cadastrada" : ""}<input name="photo" type="file" accept=".jpg,.jpeg,.png" /></label>
            <fieldset className="check-grid">
              <legend>Opções</legend>
              <label><input type="checkbox" name="rancho_requested" defaultChecked={form?.rancho_requested} />Solicitar rancho familiar (análise do Dpto Social)</label>
              {form ? <label><input type="checkbox" name="manual_inactive" defaultChecked={form.manual_inactive} />Inativar matrícula</label> : null}
            </fieldset>
            <div className="row-actions">
              {canEdit ? <button className="button primary" disabled={busy || Boolean(preview && !preview.valid)}>Salvar matrícula</button> : null}
              {canEdit && form ? <button type="button" className="button danger" disabled={busy} onClick={() => remove(form)}>Excluir ficha</button> : null}
              <button type="button" className="button" onClick={() => setEditing(null)}>Fechar</button>
            </div>
          </form>
        </section>
      ) : null}
      <section className="card">
        <div className="toolbar">
          <div><h2 style={{ marginBottom: 2 }}>Evangelizandos</h2><span className="small muted">Turma calculada pela idade em 30 de junho. Matrícula anual: vence em 31/12 e pode ser renovada.</span></div>
          <div className="row-actions">
            <button className="button no-print" onClick={() => window.print()}>⎙ Imprimir</button>
            {canEdit ? <button className="button primary no-print" onClick={() => open("new")}>+ Matricular</button> : null}
          </div>
        </div>
        <div className="filters no-print">
          <label>Pesquisar<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, turma, responsável ou contato" /></label>
          <label>Situação da matrícula
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">Todas</option><option value="active">Ativas</option><option value="inactive">Inativas</option>
            </select>
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Foto</th><th>Nome / Turma</th><th>Nascimento</th><th>Responsável</th><th>Contato</th><th>Matrícula</th><th className="no-print">Ação</th></tr></thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id}>
                  <td>{r.photo_attachment_id
                    ? <a className="link-button" href={`/api/attachments/${r.photo_attachment_id}/download`} target="_blank" rel="noreferrer">Ver foto</a>
                    : <span className="small muted">Sem foto</span>}</td>
                  <td><strong>{r.full_name}</strong><br /><span className="small">{r.current_group ?? "—"}{r.current_age !== null ? ` · ${r.current_age} anos em 30/06` : ""}</span></td>
                  <td>{br(r.birth_date)}</td>
                  <td>{r.guardian_name ?? "—"}{r.guardian_relation ? <><br /><span className="small muted">{r.guardian_relation}</span></> : null}</td>
                  <td>{[r.guardian_phone, r.whatsapp].filter(Boolean).join(" · ") || "—"}</td>
                  <td><span className={`status ${r.active ? "ready" : ""}`}>{r.active ? "Ativa" : "Inativa"}</span><br /><span className="small muted">até {r.valid_through_year}</span></td>
                  <td className="no-print"><button className="button" onClick={() => open(r)}>{canEdit ? "Abrir" : "Consultar"}</button></td>
                </tr>
              ))}
              {!visible.length ? <tr><td colSpan={7}>Nenhum evangelizando neste filtro.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
