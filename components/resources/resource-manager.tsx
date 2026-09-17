"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { RESOURCES } from "@/lib/resources/registry";
import { brDate, fieldDisplay, formatMoney, parseMoney, type Field, type ResourceDef } from "@/lib/resources/types";
import { api } from "@/lib/client-api";
import { uploadAttachment } from "@/lib/upload-client";

type Row = Record<string, unknown> & { id: string; version: number; archived_at: string | null; archive_reason: string };
type Capabilities = { create: boolean; update: boolean; delete: boolean };
type Attachment = { id: string; kind: string | null; filename: string; size_bytes: string; status: string; uploaded_at: string; removed_at: string | null; uploaded_by_name: string; scan_result: string | null };
type HistoryEntry = { occurred_at: string; actor: string; action: string; before_json: Record<string, unknown> | null; after_json: Record<string, unknown> | null; details: string | null };
type Option = { key: string; label: string };

function FieldInput({ field, value, disabled, departments, workers, references }: {
  field: Field; value: unknown; disabled: boolean; departments: Option[]; workers: Option[]; references: Map<string, Option[]>;
}) {
  const common = { name: field.name, disabled: disabled || field.readOnly, required: field.required && !field.readOnly, "aria-describedby": field.help ? `${field.name}-help` : undefined };
  const text = value === null || value === undefined ? "" : String(value);
  let input: ReactNode;
  switch (field.type) {
    case "textarea": input = <textarea {...common} rows={3} maxLength={field.max} defaultValue={text} placeholder={field.placeholder} />; break;
    case "text": input = <input {...common} maxLength={field.max} defaultValue={text} placeholder={field.placeholder} />; break;
    case "phone": input = <input {...common} type="tel" inputMode="tel" maxLength={40} defaultValue={text} />; break;
    case "email": input = <input {...common} type="email" maxLength={200} defaultValue={text} />; break;
    case "date": input = <input {...common} type="date" defaultValue={text.slice(0, 10)} max={field.notFuture ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()) : undefined} />; break;
    case "month": input = <input {...common} type="month" defaultValue={text} />; break;
    case "money": input = <input {...common} inputMode="decimal" maxLength={20} placeholder="Ex.: 1.250,00" defaultValue={value === null || value === undefined ? "" : (Number(value) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} />; break;
    case "integer": input = <input {...common} type="number" min={field.min ?? 0} max={field.max} step={1} defaultValue={text} />; break;
    case "select": input = <select {...common} defaultValue={text}><option value="">Selecione</option>{field.options.map((o) => <option key={o}>{o}</option>)}</select>; break;
    case "department": input = <select {...common} defaultValue={text}><option value="">Selecione o departamento</option>{departments.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}</select>; break;
    case "worker": input = <select {...common} defaultValue={text}><option value="">Selecione o trabalhador</option>{workers.map((w) => <option key={w.key} value={w.key}>{w.label}</option>)}</select>; break;
    case "reference": input = <select {...common} defaultValue={text}><option value="">Selecione</option>{(references.get(field.name) ?? []).map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}</select>; break;
    case "boolean": return <label className="check-inline"><input type="checkbox" name={field.name} disabled={disabled || field.readOnly} defaultChecked={Boolean(value)} />{field.label}</label>;
    case "multiselect": {
      const selected = new Set((value as string[] | undefined) ?? []);
      return (
        <fieldset className="check-grid"><legend>{field.label}{field.required ? " *" : ""}</legend>
          {field.options.map((o) => <label key={o}><input type="checkbox" name={field.name} value={o} disabled={disabled} defaultChecked={selected.has(o)} />{o}</label>)}
        </fieldset>
      );
    }
  }
  return (
    <label style={field.wide ? { gridColumn: "1 / -1" } : undefined}>
      {field.label}{field.required && !field.readOnly ? " *" : ""}
      {input}
      {field.help ? <span id={`${field.name}-help`} className="small muted">{field.help}</span> : null}
    </label>
  );
}

function readForm(def: ResourceDef, form: HTMLFormElement) {
  const data = new FormData(form);
  const out: Record<string, unknown> = {};
  for (const field of def.fields) {
    if (field.readOnly) continue;
    const raw = data.get(field.name);
    switch (field.type) {
      case "boolean": out[field.name] = raw === "on"; break;
      case "multiselect": out[field.name] = data.getAll(field.name).map(String); break;
      case "money": {
        const text = String(raw ?? "").trim();
        if (!text) { if (field.required) throw new Error(`${field.label} é obrigatório.`); out[field.name] = null; break; }
        try { out[field.name] = parseMoney(text); } catch (e) { throw new Error(`${field.label}: ${(e as Error).message}`); }
        break;
      }
      case "integer": { const text = String(raw ?? "").trim(); out[field.name] = text === "" ? null : Number(text); break; }
      default: out[field.name] = String(raw ?? "").trim();
    }
  }
  return out;
}

export type ResourceManagerProps = {
  resourceKey: string;
  /** Ações extras por registro (ex.: solicitar baixa). */
  rowActions?: (row: Row, reload: () => Promise<void>) => ReactNode;
  /** Conteúdo acima da tabela (KPIs do módulo). */
  header?: (rows: Row[]) => ReactNode;
  /** Colunas calculadas extras. */
  extraColumns?: { label: string; render: (row: Row) => ReactNode }[];
};

export function ResourceManager({ resourceKey, rowActions, header, extraColumns = [] }: ResourceManagerProps) {
  const def: ResourceDef = RESOURCES[resourceKey];
  const [rows, setRows] = useState<Row[]>([]);
  const [caps, setCaps] = useState<Capabilities>({ create: false, update: false, delete: false });
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [archived, setArchived] = useState("");
  const [editing, setEditing] = useState<{ row: Row | null; edit: boolean } | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pending, setPending] = useState<{ kind: string; file: File }[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [workers, setWorkers] = useState<Option[]>([]);
  const [references, setReferences] = useState<Map<string, Option[]>>(new Map());
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  const needsDepartments = def.fields.some((f) => f.type === "department");
  const workerField = def.fields.find((f): f is Extract<Field, { type: "worker" }> => f.type === "worker");
  const listFields = def.fields.filter((f) => !f.hideInList);
  const referenceFields = useMemo(() => def.fields.filter((f): f is Extract<Field, { type: "reference" }> => f.type === "reference"), [def]);
  const lookups = useMemo(() => ({
    departments: new Map(departments.map((d) => [d.key, d.label])),
    workers: new Map(workers.map((w) => [w.key, w.label])),
    references: new Map([...references].map(([name, list]) => [name, new Map(list.map((o) => [o.key, o.label]))]))
  }), [departments, workers, references]);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (archived) params.set("archived", archived);
    for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
    const body = await api<{ records: Row[]; capabilities: Capabilities }>(`/api/r/${def.key}?${params}`);
    setRows(body.records);
    setCaps(body.capabilities);
  }, [def.key, q, archived, filters]);

  useEffect(() => { const t = setTimeout(() => void load().catch((e) => setError(e.message)), 200); return () => clearTimeout(t); }, [load]);
  useEffect(() => {
    if (needsDepartments || def.filters?.some((f) => f.name.endsWith("department_key"))) {
      void api<{ departments: Option[] }>("/api/departments").then((b) => setDepartments(b.departments)).catch(() => undefined);
    }
    if (workerField) {
      const url = workerField.department ? `/api/lookup/workers?department=${workerField.department}` : "/api/lookup/workers";
      void api<{ workers: { id: string; name: string }[] }>(url).then((b) => setWorkers(b.workers.map((w) => ({ key: w.id, label: w.name })))).catch(() => undefined);
    }
  }, [needsDepartments, workerField, def.filters]);
  useEffect(() => {
    if (!referenceFields.length) return;
    void Promise.all(referenceFields.map(async (field) => {
      const other = RESOURCES[field.resource];
      const body = await api<{ records: Record<string, unknown>[] }>(`/api/r/${field.resource}?archived=all`);
      const label = (row: Record<string, unknown>) => other.fields.slice(0, 2).map((f) => fieldDisplay(f, row[f.name])).filter((v) => v !== "—").join(" — ");
      return [field.name, body.records.map((row) => ({ key: String(row.id), label: label(row) }))] as const;
    })).then((entries) => setReferences(new Map(entries))).catch(() => undefined);
  }, [referenceFields]);

  async function openRecord(row: Row | null, edit: boolean) {
    if (dirty && !window.confirm("Há alterações não salvas neste formulário. Descartar?")) return;
    setError(""); setMessage(""); setPending([]); setAttachments([]); setHistory([]); setDirty(false);
    setEditing({ row, edit });
    if (row) {
      if (def.attachments) {
        const body = await api<{ attachments: Attachment[] }>(`/api/attachments?ownerType=${def.attachments.ownerType}&ownerId=${row.id}&includeRemoved=1`).catch(() => ({ attachments: [] }));
        setAttachments(body.attachments);
      }
      const h = await api<{ history: HistoryEntry[] }>(`/api/r/${def.key}/${row.id}/history`).catch(() => ({ history: [] }));
      setHistory(h.history);
    }
  }

  async function run(work: () => Promise<string>) {
    setBusy(true); setError(""); setMessage("");
    try { setMessage(await work()); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Falha na operação."); }
    finally { setBusy(false); }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    void run(async () => {
      const values = readForm(def, form);
      let id = editing!.row?.id;
      if (id) {
        await api(`/api/r/${def.key}/${id}`, { method: "PATCH", body: JSON.stringify({ ...values, version: editing!.row!.version }) });
      } else {
        id = (await api<{ id: string }>(`/api/r/${def.key}`, { method: "POST", body: JSON.stringify(values) })).id;
      }
      const failures: string[] = [];
      for (const item of pending) {
        try { await uploadAttachment(item.file, def.attachments!.ownerType, id, undefined, item.kind); }
        catch (e) { failures.push(`${item.file.name}: ${(e as Error).message}`); }
      }
      setEditing(null); setPending([]); setDirty(false);
      if (failures.length) throw new Error(`${def.singular} salvo, mas ${failures.length} anexo(s) falharam: ${failures.join("; ")}`);
      return `${def.singular} salvo${pending.length ? ` com ${pending.length} anexo(s) inspecionado(s)` : ""}.`;
    });
  }

  function archive(row: Row, restore: boolean) {
    const reason = restore ? "" : window.prompt(`Motivo para ${def.archiveLabel?.toLowerCase() ?? "arquivar"}:`) ?? "";
    if (!restore && reason.trim().length < 3) return;
    void run(async () => {
      await api(`/api/r/${def.key}/${row.id}`, { method: "DELETE", body: JSON.stringify({ version: row.version, reason, restore }) });
      return restore ? "Registro restaurado." : "Registro arquivado. Ele continua disponível no histórico.";
    });
  }

  function attachmentState(file: Attachment, action: "remove" | "restore") {
    const reason = action === "remove" ? window.prompt("Motivo da retirada do anexo:") ?? "" : "";
    if (action === "remove" && reason.trim().length < 3) return;
    void run(async () => {
      await api(`/api/attachments/${file.id}/state`, { method: "POST", body: JSON.stringify({ action, reason }) });
      if (editing?.row) await openRecord(editing.row, editing.edit);
      return action === "remove" ? "Anexo retirado do cadastro (continua no histórico)." : "Anexo restaurado.";
    });
  }

  function addFiles(kind: string, files: FileList | null) {
    if (!files || !def.attachments) return;
    const spec = def.attachments.kinds.find((k) => k.key === kind)!;
    const list = [...files];
    const invalid = list.find((f) => !spec.mimes.includes(f.type as never) || f.size > 15 * 1024 * 1024);
    if (invalid) { setError(`${invalid.name}: tipo não permitido ou maior que 15 MB.`); return; }
    const active = attachments.filter((a) => a.status !== "deleted").length;
    if (active + pending.length + list.length > def.attachments.maxPerRecord) { setError(`Limite de ${def.attachments.maxPerRecord} anexos por registro.`); return; }
    setPending((current) => [...current, ...list.map((file) => ({ kind, file }))]);
  }

  const row = editing?.row ?? null;
  const canWrite = editing ? (row ? editing.edit && caps.update && !row.archived_at : caps.create) : false;
  const filterOptions = (name: string): Option[] => {
    const field = def.fields.find((f) => f.name === name);
    if (field?.type === "select") return field.options.map((o) => ({ key: o, label: o }));
    if (field?.type === "department") return departments;
    if (field?.type === "reference") return references.get(name) ?? [];
    return [];
  };

  return (
    <div className="grid">
      {def.intro ? <p className="small muted no-print">{def.intro}</p> : null}
      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}
      {header ? header(rows) : null}

      {editing ? (
        <section className="card" aria-label={row ? `${def.singular}` : `Novo ${def.singular}`}>
          <div className="toolbar">
            <h2>{row ? `${canWrite ? "Editar" : "Consultar"} — ${String(row[def.fields[0].name] ?? def.singular)}` : `Novo: ${def.singular}`}</h2>
            <button type="button" className="button" onClick={() => { if (!dirty || window.confirm("Há alterações não salvas. Fechar mesmo assim?")) { setEditing(null); setDirty(false); } }}>Fechar</button>
          </div>
          {row?.archived_at ? <div className="notice">Arquivado em {brDate(row.archived_at as string)} — {row.archive_reason}</div> : null}
          <form className="form-stack" onSubmit={save} onChange={() => setDirty(true)} key={`${row?.id ?? "new"}-${row?.version ?? 0}`}>
            <div className="form-row">
              {def.fields.map((field) => (
                <FieldInput key={field.name} field={field} value={row?.[field.name]} disabled={!canWrite || busy} departments={departments} workers={workers} references={references} />
              ))}
            </div>
            {def.attachments ? (
              <div className="grid">
                {def.attachments.kinds.map((kind) => {
                  const saved = attachments.filter((a) => (a.kind ?? def.attachments!.kinds[0].key) === kind.key);
                  return (
                    <section key={kind.key} className="card">
                      <h3>{kind.label}</h3>
                      {saved.map((a) => (
                        <div key={a.id} className="toolbar small" style={a.status === "deleted" ? { opacity: 0.6 } : undefined}>
                          <span><strong>{a.filename}</strong> · {Math.ceil(Number(a.size_bytes) / 1024)} KB · {a.status === "deleted" ? `retirado em ${brDate(a.removed_at)}` : a.status === "active" ? `enviado por ${a.uploaded_by_name}` : a.status === "quarantined" ? "bloqueado pela inspeção" : "em inspeção"}</span>
                          <span className="row-actions">
                            {a.status === "active" ? <>
                              <a className="button" href={`/api/attachments/${a.id}/download?inline=1`} target="_blank" rel="noreferrer">Visualizar</a>
                              <a className="button" href={`/api/attachments/${a.id}/download`}>Baixar</a>
                              {canWrite ? <button type="button" className="button danger" onClick={() => attachmentState(a, "remove")}>Retirar</button> : null}
                            </> : null}
                            {a.status === "deleted" && canWrite ? <button type="button" className="button" onClick={() => attachmentState(a, "restore")}>Restaurar vínculo</button> : null}
                          </span>
                        </div>
                      ))}
                      {pending.filter((p) => p.kind === kind.key).map((p, i) => (
                        <div key={`${p.file.name}-${i}`} className="toolbar small">
                          <span>{p.file.name} · aguardando salvar</span>
                          <button type="button" className="button" onClick={() => setPending((c) => c.filter((x) => x !== p))}>Retirar seleção</button>
                        </div>
                      ))}
                      {!saved.length && !pending.some((p) => p.kind === kind.key) ? <p className="small muted">Nenhum arquivo anexado.</p> : null}
                      {canWrite ? <label className="small">Adicionar {kind.label.toLowerCase()}<input type="file" multiple accept={kind.accept} onChange={(e) => { addFiles(kind.key, e.target.files); e.target.value = ""; }} /></label> : null}
                    </section>
                  );
                })}
                <p className="small muted">Até 15 MB por arquivo e {def.attachments.maxPerRecord} por registro. Os arquivos passam pela inspeção antimalware ao salvar.</p>
              </div>
            ) : null}
            {canWrite ? (
              <div className="row-actions">
                <button className="button primary" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</button>
                {dirty ? <span className="small muted" role="status">Alterações ainda não salvas.</span> : null}
              </div>
            ) : null}
          </form>
          {row ? (
            <details style={{ marginTop: 12 }}>
              <summary>Histórico do cadastro</summary>
              <div className="history-list">
                {history.map((h, i) => (
                  <article key={i}>
                    <strong>{new Date(h.occurred_at).toLocaleString("pt-BR")} · {h.actor}</strong>
                    <p className="small">{h.action}</p>
                    {h.after_json && h.before_json ? (
                      <ul className="small">
                        {Object.keys(h.after_json).map((k) => {
                          const field = def.fields.find((f) => f.name === k);
                          if (!field) return null;
                          return <li key={k}>{field.label}: {fieldDisplay(field, h.before_json?.[k], lookups)} → {fieldDisplay(field, h.after_json?.[k], lookups)}</li>;
                        })}
                      </ul>
                    ) : h.details ? <p className="small muted">{h.details}</p> : null}
                  </article>
                ))}
                {!history.length ? <p className="small muted">Sem registros.</p> : null}
              </div>
            </details>
          ) : null}
        </section>
      ) : null}

      <section className="card">
        <div className="toolbar">
          <h2>{def.title}</h2>
          <div className="row-actions no-print">
            <button type="button" className="button" onClick={() => window.print()}>⎙ Imprimir</button>
            {caps.create ? <button type="button" className="button primary" onClick={() => void openRecord(null, true)}>+ Novo</button> : null}
          </div>
        </div>
        <div className="filters no-print">
          <label>Buscar<input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar" /></label>
          {(def.filters ?? []).map((f) => (
            <label key={f.name}>{f.label}
              <select value={filters[f.name] ?? ""} onChange={(e) => setFilters((c) => ({ ...c, [f.name]: e.target.value }))}>
                <option value="">Todos</option>
                {filterOptions(f.name).map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </label>
          ))}
          {def.archiveLabel ? (
            <label>Situação do registro
              <select value={archived} onChange={(e) => setArchived(e.target.value)}>
                <option value="">Ativos</option><option value="only">Arquivados</option><option value="all">Todos</option>
              </select>
            </label>
          ) : null}
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr>{listFields.map((f) => <th key={f.name}>{f.label}</th>)}{extraColumns.map((c) => <th key={c.label}>{c.label}</th>)}<th className="no-print">Ações</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={r.archived_at ? { opacity: 0.6 } : undefined}>
                  {listFields.map((f, i) => <td key={f.name}>{i === 0 ? <strong>{fieldDisplay(f, r[f.name], lookups)}</strong> : fieldDisplay(f, r[f.name], lookups)}</td>)}
                  {extraColumns.map((c) => <td key={c.label}>{c.render(r)}</td>)}
                  <td className="no-print">
                    <div className="row-actions">
                      <button type="button" className="button" onClick={() => void openRecord(r, false)}>Consultar</button>
                      {caps.update && !r.archived_at ? <button type="button" className="button" onClick={() => void openRecord(r, true)}>Editar</button> : null}
                      {def.archiveLabel && caps.delete ? <button type="button" className={`button${r.archived_at ? "" : " danger"}`} onClick={() => archive(r, Boolean(r.archived_at))}>{r.archived_at ? "Restaurar" : def.archiveLabel}</button> : null}
                      {rowActions ? rowActions(r, load) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length ? <tr><td colSpan={listFields.length + extraColumns.length + 1}>Nenhum registro encontrado.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <p className="small muted">{rows.length} registro(s){def.fields.some((f) => f.type === "money") ? ` · total ${formatMoney(rows.reduce((s, r) => s + Number(def.fields.filter((f) => f.type === "money").map((f) => r[f.name] ?? 0)[0] ?? 0), 0))}` : ""}</p>
      </section>
    </div>
  );
}

export type { Row as ResourceRow };
