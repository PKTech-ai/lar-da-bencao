"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { readFicha, WorkerFichaForm, type FichaValues, type Option } from "@/components/worker-ficha-form";
import { workerStatusLabel, workerStatusTone, type WorkerStatus } from "@/lib/worker-constants";

type WorkerRow = {
  id: string; full_name: string; phone: string | null; status: WorkerStatus; functions: string[];
  departments: string[]; origin_department: string | null; requested_at: string; version: number;
};
type WorkerDetail = FichaValues & { id: string; status: WorkerStatus; version: number };

export function WorkersClient({ departments, originOptions, updateScope }: {
  departments: Option[]; originOptions: Option[]; updateScope: string[] | null; canDecide: boolean;
}) {
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [status, setStatus] = useState("");
  const [department, setDepartment] = useState("");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<WorkerDetail | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const label = (key: string) => departments.find((d) => d.key === key)?.label ?? key;
  const canEdit = (w: WorkerRow) => updateScope === null || w.departments.some((d) => updateScope.includes(d));

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (department) params.set("department", department);
    const response = await fetch(`/api/workers?${params}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setWorkers(body.workers);
  }, [status, department]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load().catch((e) => setError(e.message)); }, [load]);

  async function send(url: string, method: string, payload: unknown) {
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

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const origin = String(new FormData(form).get("origin_department") ?? "");
    void run(async () => {
      await send("/api/workers", "POST", { ...readFicha(form), origin_department: origin || undefined });
      setCreating(false);
      return "Ficha enviada. O trabalhador fica PENDENTE — AGUARDANDO DIRETORIA e não pode ser escalado antes da aprovação.";
    });
  }

  async function openEdit(id: string) {
    setError("");
    const response = await fetch(`/api/workers/${id}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) { setError(body.error); return; }
    setCreating(false);
    setEditing(body.worker);
  }

  function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = event.currentTarget;
    void run(async () => {
      const body = await send(`/api/workers/${editing.id}`, "PATCH", { ...readFicha(form), version: editing.version });
      setEditing(null);
      return body.resubmitted ? "Ficha atualizada e encaminhada para nova análise da Diretoria." : "Ficha atualizada.";
    });
  }

  function setActive(worker: WorkerRow, active: boolean) {
    if (!active && !window.confirm(`Afastar ${worker.full_name}? Ele deixa de aparecer nas escalas.`)) return;
    void run(async () => {
      const detail = await (await fetch(`/api/workers/${worker.id}`, { cache: "no-store" })).json();
      const w = detail.worker as WorkerDetail;
      await send(`/api/workers/${worker.id}`, "PATCH", {
        ...w, email: w.email ?? "", phone: w.phone ?? "", birth_date: w.birth_date?.slice(0, 10) ?? "",
        naturality: w.naturality ?? "", marital_status: w.marital_status ?? "", profession: w.profession ?? "",
        address: w.address ?? "", filled_date: w.filled_date?.slice(0, 10) ?? "", active, version: w.version
      });
      return active ? "Trabalhador reativado." : "Trabalhador afastado.";
    });
  }

  const term = search.trim().toLocaleLowerCase("pt-BR");
  const visible = workers.filter((w) => !term || [w.full_name, ...w.departments.map(label), ...w.functions].join(" ").toLocaleLowerCase("pt-BR").includes(term));
  const editNotice = editing?.status === "active" || editing?.status === "inactive"
    ? "Ficha aprovada: você pode corrigir os dados. Se alterar departamentos ou funções, a ficha volta para PENDENTE — AGUARDANDO DIRETORIA."
    : editing?.status === "rejected"
      ? "Ficha reprovada: ao salvar, ela será reenviada para nova análise da Diretoria."
      : undefined;

  return (
    <div className="grid">
      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}
      {creating ? (
        <section className="card">
          <h2>Nova ficha de trabalhador</h2>
          <WorkerFichaForm departments={departments} originOptions={originOptions} busy={busy} submitLabel="Enviar para aprovação" onSubmit={create} onCancel={() => setCreating(false)}
            notice="Ao salvar, o trabalhador ficará PENDENTE — AGUARDANDO DIRETORIA. Ele não poderá ser escalado nem considerado ativo antes da aprovação." />
        </section>
      ) : null}
      {editing ? (
        <section className="card">
          <h2>Editar ficha — {editing.full_name}</h2>
          <WorkerFichaForm key={editing.id} departments={departments} initial={editing} busy={busy} notice={editNotice}
            submitLabel="Salvar ficha" onSubmit={update} onCancel={() => setEditing(null)} />
        </section>
      ) : null}
      <section className="card">
        <div className="toolbar">
          <h2>Fichas</h2>
          {originOptions.length && !creating ? <button className="button primary" onClick={() => { setEditing(null); setCreating(true); }}>Nova ficha</button> : null}
        </div>
        <div className="filters">
          <label>Buscar<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, departamento ou função" /></label>
          <label>Situação
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todas</option>
              {(Object.keys(workerStatusLabel) as WorkerStatus[]).map((key) => <option key={key} value={key}>{workerStatusLabel[key]}</option>)}
            </select>
          </label>
          <label>Departamento
            <select value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">Todos</option>
              {departments.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nome</th><th>Departamentos</th><th>Funções (Doutrina)</th><th>Situação</th><th>Ações</th></tr></thead>
            <tbody>
              {visible.map((w) => (
                <tr key={w.id}>
                  <td><strong>{w.full_name}</strong><br /><span className="muted small">{w.phone || "—"}</span></td>
                  <td>{w.departments.map(label).join(", ")}<br /><span className="muted small">Solicitante: {w.origin_department ? label(w.origin_department) : "—"}</span></td>
                  <td>{w.functions.join(", ") || "—"}</td>
                  <td><span className={`status ${workerStatusTone[w.status]}`}>{workerStatusLabel[w.status]}</span></td>
                  <td>
                    <div className="row-actions">
                      {canEdit(w) ? <button className="button" disabled={busy} onClick={() => void openEdit(w.id)}>Editar ficha</button> : null}
                      {canEdit(w) && w.status === "active" ? <button className="button danger" disabled={busy} onClick={() => setActive(w, false)}>Afastar</button> : null}
                      {canEdit(w) && w.status === "inactive" ? <button className="button" disabled={busy} onClick={() => setActive(w, true)}>Reativar</button> : null}
                      {w.status === "active" || w.status === "inactive" ? <Link className="button" href={`/sistema/trabalhadores/${w.id}/ficha`}>⎙ Ficha</Link> : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!visible.length ? <tr><td colSpan={5}>Nenhuma ficha encontrada neste filtro.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
