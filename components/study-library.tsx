"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { uploadAttachment } from "@/lib/upload-client";

type Folder = { id: string; parent_id: string | null; title: string; system: boolean };
type Study = {
  id: string; folder_id: string | null; study_type: string | null; code: string | null; title: string; reference: string | null;
  description: string; active: boolean; version: number; attachment_id: string | null; attachment_name: string | null; attachment_status: string | null;
};
type Department = "doutrina" | "infancia" | "juventude";

const TYPES = [["ESE", "ESE"], ["ESDE", "ESDE"], ["MEP", "MEP"], ["OBRA", "Estudo de Obra"], ["PALESTRA", "Palestra"], ["TREINAMENTO", "Treinamento"], ["OUTRO", "Outro"]];

export function StudyLibrary({ department }: { department: Department }) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [studies, setStudies] = useState<Study[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [search, setSearch] = useState("");
  const [showRetired, setShowRetired] = useState(false);
  const [editing, setEditing] = useState<Study | "new" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const load = useCallback(async () => {
    const response = await fetch(`/api/studies?department=${department}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setFolders(body.folders);
    setStudies(body.studies);
    setCanEdit(body.canEdit);
  }, [department]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load().catch((e) => setError(e.message)); }, [load]);

  const byId = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const path = useCallback((id: string | null) => {
    const parts: string[] = [];
    let current = id ? byId.get(id) : undefined;
    for (let guard = 0; current && guard < 20; guard += 1) {
      parts.unshift(current.title);
      current = current.parent_id ? byId.get(current.parent_id) : undefined;
    }
    return parts.join(" / ") || "Sem pasta";
  }, [byId]);
  const descendants = useCallback((id: string) => {
    const ids = new Set([id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const f of folders) if (f.parent_id && ids.has(f.parent_id) && !ids.has(f.id)) { ids.add(f.id); grew = true; }
    }
    return ids;
  }, [folders]);

  async function send(url: string, method: string, payload?: object) {
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: payload ? JSON.stringify(payload) : undefined });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    return body;
  }
  async function run(work: () => Promise<string | void>) {
    setBusy(true); setError(""); setMessage("");
    try { const text = await work(); if (text) setMessage(text); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Falha na operação."); }
    finally { setBusy(false); setProgress(0); }
  }

  function newFolder(sub: boolean) {
    if (sub && !selected) { setError("Selecione a pasta onde a subpasta será criada."); return; }
    const title = window.prompt(sub ? `Nome da subpasta em “${path(selected)}”:` : "Nome da nova pasta:");
    if (!title?.trim()) return;
    void run(async () => {
      const body = await send("/api/study-folders", "POST", { department_key: department, parent_id: sub ? selected : null, title });
      setSelected(body.id);
      return "Pasta criada.";
    });
  }
  function renameFolder(folder: Folder) {
    const title = window.prompt("Novo nome da pasta:", folder.title);
    if (!title?.trim() || title === folder.title) return;
    void run(async () => { await send(`/api/study-folders/${folder.id}`, "PATCH", { title }); return "Pasta renomeada."; });
  }
  function deleteFolder(folder: Folder) {
    if (!window.confirm(`Excluir a pasta “${folder.title}”? Só é possível se estiver vazia.`)) return;
    void run(async () => { await send(`/api/study-folders/${folder.id}`, "DELETE"); setSelected(folder.parent_id ?? ""); return "Pasta excluída."; });
  }

  function saveStudy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const file = (form.elements.namedItem("file") as HTMLInputElement | null)?.files?.[0];
    const payload = {
      folder_id: String(values.get("folder_id") ?? "") || null,
      study_type: String(values.get("study_type") ?? "") || null,
      code: String(values.get("code") ?? ""),
      title: String(values.get("title") ?? ""),
      reference: String(values.get("reference") ?? ""),
      description: String(values.get("description") ?? "")
    };
    void run(async () => {
      let id: string;
      let version: number;
      if (editing === "new") {
        id = (await send("/api/studies", "POST", { department_key: department, ...payload })).id;
        version = 1;
      } else {
        id = editing!.id;
        await send(`/api/studies/${id}`, "PATCH", { ...payload, version: editing!.version });
        version = editing!.version + 1;
      }
      if (file) {
        const attachmentId = await uploadAttachment(file, `study_material_${department}`, id, setProgress);
        await send(`/api/studies/${id}`, "PATCH", { attachment_id: attachmentId, version });
      }
      setEditing(null);
      return file ? "Estudo salvo e arquivo inspecionado." : "Estudo salvo.";
    });
  }
  function toggleActive(study: Study) {
    if (study.active && !window.confirm(`Retirar “${study.title}” da biblioteca? Ele deixa de aparecer nas escalas; o histórico é mantido.`)) return;
    void run(async () => {
      await send(`/api/studies/${study.id}`, "PATCH", {
        folder_id: study.folder_id, study_type: study.study_type, code: study.code ?? "", title: study.title,
        reference: study.reference ?? "", description: study.description, active: !study.active, version: study.version
      });
      return study.active ? "Estudo retirado." : "Estudo restaurado.";
    });
  }

  const scope = selected ? descendants(selected) : null;
  const term = search.trim().toLocaleLowerCase("pt-BR");
  const visible = studies.filter((s) => (showRetired || s.active) && (!scope || (s.folder_id && scope.has(s.folder_id)))
    && (!term || [s.code, s.title, s.reference, s.study_type].join(" ").toLocaleLowerCase("pt-BR").includes(term)));
  const countIn = (id: string) => { const ids = descendants(id); return studies.filter((s) => s.active && s.folder_id && ids.has(s.folder_id)).length; };
  const tree = (parent: string | null, depth: number): React.ReactNode => folders
    .filter((f) => f.parent_id === parent)
    .map((f) => (
      <div key={f.id} style={{ paddingLeft: depth * 14 }}>
        <button type="button" data-active={selected === f.id} onClick={() => setSelected(f.id)}>
          <span>📁 {f.title}</span><span className="small muted">{countIn(f.id)}</span>
        </button>
        {tree(f.id, depth + 1)}
      </div>
    ));
  const current = selected ? byId.get(selected) : undefined;
  const form = editing === "new" ? null : editing;

  return (
    <div className="grid">
      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}
      {editing ? (
        <section className="card">
          <h2>{editing === "new" ? "Novo estudo" : `Editar — ${editing.title}`}</h2>
          <form className="form-stack" onSubmit={saveStudy} key={form?.id ?? "new"}>
            <div className="form-row">
              <label>Pasta
                <select name="folder_id" defaultValue={form ? form.folder_id ?? "" : selected}>
                  <option value="">Sem pasta</option>
                  {folders.map((f) => <option key={f.id} value={f.id}>{path(f.id)}</option>)}
                </select>
              </label>
              <label>Tipo{department === "doutrina" ? " *" : ""}
                <select name="study_type" defaultValue={form?.study_type ?? ""} required={department === "doutrina"}>
                  <option value="">—</option>
                  {TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>Código<input name="code" maxLength={40} defaultValue={form?.code ?? ""} placeholder="Ex.: ROT. 014" /></label>
            </div>
            <label>Tema *<input name="title" required maxLength={200} defaultValue={form?.title ?? ""} /></label>
            <label>Referência<input name="reference" maxLength={300} defaultValue={form?.reference ?? ""} placeholder="Ex.: ESE Cap. V — itens 12 e 13" /></label>
            <label>Observações<textarea name="description" rows={2} maxLength={4000} defaultValue={form?.description ?? ""} /></label>
            <label>Arquivo (PDF ou imagem, até 15 MB){form?.attachment_name ? ` — atual: ${form.attachment_name}` : ""}<input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png" /></label>
            {busy && progress ? <div className="upload-progress"><span style={{ width: `${progress}%` }} /></div> : null}
            <div className="row-actions">
              <button className="button primary" disabled={busy}>Salvar estudo</button>
              <button type="button" className="button" onClick={() => setEditing(null)}>Cancelar</button>
            </div>
          </form>
        </section>
      ) : null}
      <section className="card">
        <div className="toolbar">
          <div><h2 style={{ marginBottom: 2 }}>Biblioteca de Estudos</h2><span className="small muted">Pastas e subpastas; o tipo do estudo define em qual atividade da escala ele aparece.</span></div>
          {canEdit ? (
            <div className="row-actions">
              <button className="button" disabled={busy} onClick={() => newFolder(false)}>+ Nova pasta</button>
              <button className="button" disabled={busy || !selected} onClick={() => newFolder(true)}>+ Nova subpasta</button>
              <button className="button primary" disabled={busy} onClick={() => setEditing("new")}>+ Novo estudo</button>
            </div>
          ) : null}
        </div>
        <div className="library" style={{ marginTop: 12 }}>
          <aside className="folder-tree">
            <button type="button" data-active={!selected} onClick={() => setSelected("")}><span>📚 Todos os estudos</span><span className="small muted">{studies.filter((s) => s.active).length}</span></button>
            {tree(null, 0)}
          </aside>
          <div>
            <div className="toolbar">
              <div>
                <span className="small muted">Local atual</span><br /><strong>{selected ? path(selected) : "Todos os estudos"}</strong>
                {canEdit && current && !current.system ? (
                  <span className="row-actions" style={{ display: "inline-flex", marginLeft: 8 }}>
                    <button className="link-button" onClick={() => renameFolder(current)}>Renomear</button>
                    <button className="link-button" onClick={() => deleteFolder(current)}>Excluir pasta</button>
                  </span>
                ) : null}
              </div>
              <div className="row-actions">
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar código, tema ou referência" style={{ maxWidth: 320 }} />
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400 }}><input type="checkbox" style={{ width: 18, minHeight: 18 }} checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} />Retirados</label>
              </div>
            </div>
            <div className="table-wrap" style={{ marginTop: 10 }}>
              <table>
                <thead><tr><th>Pasta</th><th>Tipo</th><th>Código</th><th>Tema</th><th>Referência</th><th>Arquivo</th><th>Ações</th></tr></thead>
                <tbody>
                  {visible.map((s) => (
                    <tr key={s.id} style={s.active ? undefined : { opacity: 0.6 }}>
                      <td>{path(s.folder_id)}</td>
                      <td>{s.study_type ?? "—"}</td>
                      <td>{s.code ?? "—"}</td>
                      <td><strong>{s.title}</strong>{s.active ? null : <><br /><span className="small">Retirado</span></>}</td>
                      <td>{s.reference ?? "—"}</td>
                      <td>{s.attachment_id && s.attachment_status === "active"
                        ? <a className="button" href={`/api/attachments/${s.attachment_id}/download`}>Baixar</a>
                        : s.attachment_id ? <span className="small">{s.attachment_status}</span> : "—"}</td>
                      <td>
                        {canEdit ? (
                          <div className="row-actions">
                            <button className="button" disabled={busy} onClick={() => setEditing(s)}>Editar</button>
                            <button className={`button${s.active ? " danger" : ""}`} disabled={busy} onClick={() => toggleActive(s)}>{s.active ? "Retirar" : "Restaurar"}</button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {!visible.length ? <tr><td colSpan={7}>Nenhum estudo neste local.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
