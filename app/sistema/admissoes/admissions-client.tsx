"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { readFicha, WorkerFichaForm, type FichaValues, type Option } from "@/components/worker-ficha-form";
import { WEEKDAYS, workerStatusLabel, workerStatusTone, type WorkerStatus } from "@/lib/worker-constants";

type Row = {
  id: string; full_name: string; status: WorkerStatus; departments: string[]; origin_department: string | null;
  requested_at: string; version: number; last_decision: { decision: string; meeting_date: string; decided_by_name: string } | null;
};
type Detail = FichaValues & {
  id: string; full_name: string; status: WorkerStatus; version: number;
  origin_department?: string | null; requested_at?: string;
};
type Decision = {
  id: string; decision: "approved" | "rejected"; authority: string; meeting_date: string; minute_ref: string; reason: string;
  decided_at: string; decided_by_name: string; decided_by_role: string;
};

const br = (value: unknown) => {
  if (!value) return "Não informado";
  const text = String(value);
  return /^\d{4}-\d{2}-\d{2}/.test(text) && text.length <= 10 ? text.split("-").reverse().join("/") : new Date(text).toLocaleString("pt-BR");
};
const dateOnly = (value: unknown) => (value ? new Date(String(value)).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "Não informado");
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

export function AdmissionsClient({ departments, canDecide, canEditFicha }: { departments: Option[]; canDecide: boolean; canEditFicha: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<string>("pending");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{ worker: Detail; history: Decision[]; decision: string } | null>(null);
  const [editing, setEditing] = useState<Detail | null>(null);
  const [reject, setReject] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const label = (key: string) => departments.find((d) => d.key === key)?.label ?? key;

  const load = useCallback(async () => {
    const response = await fetch(`/api/workers${status ? `?status=${status}` : ""}`, { cache: "no-store" });
    const body = await response.json().catch(() => ({})) as { error?: string; workers?: Row[] };
    if (!response.ok) throw new Error(body.error || "Não foi possível concluir a operação.");
    setRows(body.workers ?? []);
  }, [status]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load().catch((e) => setError(e instanceof TypeError ? "Sem resposta do sistema. Tente de novo." : e.message)); }, [load]);

  async function open(id: string, decision = "") {
    setError(""); setMessage("");
    try {
      const response = await fetch(`/api/workers/${id}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({})) as { error?: string; worker?: Detail; history?: Decision[] };
      if (!response.ok) {
        setError(body.error || "Não foi possível abrir a ficha.");
        return;
      }
      if (!body.worker) {
        setError("Não foi possível concluir a operação.");
        return;
      }
      setSelected({ worker: body.worker, history: body.history ?? [], decision });
      setReject(decision === "rejected");
    } catch (caught) {
      setError(caught instanceof TypeError ? "Sem resposta do sistema. Tente de novo." : "Não foi possível concluir a operação.");
    }
  }

  function remove(row: Pick<Row, "id" | "full_name">) {
    if (!window.confirm(`Excluir a ficha de ${row.full_name}? O acesso ao sistema, se já existir, continua e só perde o vínculo com esta ficha.`)) return;
    setBusy(true); setError(""); setMessage("");
    void (async () => {
      try {
        const response = await fetch(`/api/workers/${row.id}`, { method: "DELETE" });
        const body = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) throw new Error(body.error || "Não foi possível excluir a ficha.");
        if (selected?.worker.id === row.id) setSelected(null);
        if (editing?.id === row.id) setEditing(null);
        setMessage("Ficha excluída.");
        await load();
      } catch (caught) {
        setError(caught instanceof TypeError ? "Sem resposta do sistema. Tente de novo." : caught instanceof Error ? caught.message : "Não foi possível concluir a operação.");
      } finally {
        setBusy(false);
      }
    })();
  }

  async function startEdit(id: string) {
    setError(""); setMessage("");
    if (selected?.worker.id === id) {
      setEditing(selected.worker);
      setSelected(null);
      return;
    }
    try {
      const response = await fetch(`/api/workers/${id}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({})) as { error?: string; worker?: Detail };
      if (!response.ok || !body.worker) {
        setError(body.error || "Não foi possível abrir a ficha.");
        return;
      }
      setSelected(null);
      setEditing(body.worker);
    } catch (caught) {
      setError(caught instanceof TypeError ? "Sem resposta do sistema. Tente de novo." : "Não foi possível concluir a operação.");
    }
  }

  function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = event.currentTarget;
    const wasUnapproved = editing.status === "pending" || editing.status === "rejected";
    setBusy(true); setError(""); setMessage("");
    void (async () => {
      try {
        const response = await fetch(`/api/workers/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...readFicha(form), version: editing.version })
        });
        const body = await response.json().catch(() => ({})) as { error?: string; approved?: boolean; resubmitted?: boolean; linkedExisting?: boolean };
        if (!response.ok) throw new Error(body.error || "Não foi possível salvar a ficha.");
        setEditing(null);
        setMessage(body.linkedExisting
          ? "Ficha salva e aprovada. Ela foi vinculada ao acesso que este CPF já possui. O login e o perfil permanecem os mesmos."
          : wasUnapproved || body.approved
          ? "Ficha salva e aprovada. O trabalhador fica ativo."
          : body.resubmitted
            ? "Ficha atualizada e encaminhada para nova análise da Diretoria."
            : "Ficha atualizada.");
        await load();
      } catch (caught) {
        setError(caught instanceof TypeError ? "Sem resposta do sistema. Tente de novo." : caught instanceof Error ? caught.message : "Não foi possível concluir a operação.");
      } finally {
        setBusy(false);
      }
    })();
  }

  async function decide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const values = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/workers/${selected.worker.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: values.get("decision"),
          meeting_date: values.get("meeting_date"),
          minute_ref: values.get("minute_ref"),
          reason: values.get("reason"),
          version: selected.worker.version
        })
      });
      const body = await response.json().catch(() => ({})) as { error?: string; name?: string; status?: string; linkedExisting?: boolean };
      if (!response.ok) throw new Error(body.error || "Não foi possível salvar a decisão.");
      setSelected(null);
      setMessage(body.linkedExisting
        ? `${body.name}: ficha aprovada e vinculada ao acesso que este CPF já possui. O login e o perfil permanecem os mesmos.`
        : `${body.name}: ${body.status === "active" ? "aprovado e liberado para atuação" : "reprovado; permanece sem liberação para atuação"}. Decisão da Diretoria salva.`);
      await load();
    } catch (caught) {
      setError(caught instanceof TypeError ? "Sem resposta do sistema. Tente de novo." : caught instanceof Error ? caught.message : "Não foi possível concluir a operação.");
    } finally {
      setBusy(false);
    }
  }

  async function approveRow(row: Row) {
    const response = await fetch(`/api/workers/${row.id}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "approved", meeting_date: today(), minute_ref: "", reason: "", version: row.version })
    });
    const body = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) throw new Error(`${row.full_name}: ${body.error || "não foi possível aprovar."}`);
  }

  /** Aprova direto, sem abrir a ficha; com várias fichas, aprova uma por vez e informa as que falharem. */
  async function approve(list: Row[]) {
    if (!list.length) return;
    if (list.length > 1 && !window.confirm(`Aprovar ${list.length} fichas de uma vez? Todos ficam ativos com a data de hoje.`)) return;
    setBusy(true); setError(""); setMessage("");
    const failures: string[] = [];
    let approved = 0;
    for (const row of list) {
      try {
        await approveRow(row);
        approved += 1;
      } catch (caught) {
        failures.push(caught instanceof TypeError ? `${row.full_name}: sem resposta do sistema.` : caught instanceof Error ? caught.message : `${row.full_name}: não foi possível aprovar.`);
      }
    }
    if (list.some((r) => r.id === selected?.worker.id)) setSelected(null);
    if (approved) setMessage(list.length === 1 ? `${list[0].full_name}: aprovado e liberado para atuação.` : `${approved} ficha(s) aprovada(s) e liberada(s) para atuação.`);
    if (failures.length) setError(failures.join(" "));
    await load().catch(() => undefined);
    setBusy(false);
  }

  const counts = (key: WorkerStatus) => rows.filter((r) => r.status === key).length;
  const term = search.trim().toLocaleLowerCase("pt-BR");
  const visible = rows.filter((r) => !term || [r.full_name, ...r.departments.map(label)].join(" ").toLocaleLowerCase("pt-BR").includes(term));
  const w = selected?.worker;
  const pendingVisible = visible.filter((r) => r.status === "pending");

  return (
    <div className="grid">
      {!canDecide ? <div className="notice">Consulta das fichas e decisões. O registro da decisão é feito pelos perfis Presidente e Administrador.</div> : null}
      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}

      {editing ? (
        <section className="card">
          <h2>Editar ficha — {editing.full_name}</h2>
          <WorkerFichaForm key={editing.id} departments={departments} initial={editing} busy={busy}
            notice={editing.status === "pending" || editing.status === "rejected"
              ? "Esta ficha ainda não está aprovada. Ao salvar, ela é aprovada e o trabalhador fica ativo."
              : "Ficha aprovada: você pode corrigir os dados. Se alterar departamentos ou funções, a ficha volta para PENDENTE — AGUARDANDO DIRETORIA."}
            submitLabel="Salvar ficha" onSubmit={saveEdit} onCancel={() => setEditing(null)} />
        </section>
      ) : null}

      {w && selected && !editing ? (
        <section className="card">
          <div className="toolbar">
            <h2>{w.full_name}</h2>
            <div className="row-actions">
              {canEditFicha ? <button className="button" disabled={busy} onClick={() => void startEdit(w.id)}>Editar ficha</button> : null}
              {canEditFicha ? <button className="button danger" disabled={busy} onClick={() => remove(w)}>Excluir ficha</button> : null}
              <button className="button" onClick={() => setSelected(null)}>Fechar</button>
            </div>
          </div>
          <p><span className={`status ${workerStatusTone[w.status]}`}>{workerStatusLabel[w.status]}</span></p>
          <dl className="details-list">
            {([
              ["Data de nascimento", dateOnly(w.birth_date)], ["Naturalidade", w.naturality], ["Estado civil", w.marital_status],
              ["Profissão", w.profession], ["Endereço", w.address], ["Contato", [w.phone, w.email].filter(Boolean).join(" · ")],
              ["Preenchimento da ficha", dateOnly(w.filled_date)], ["Departamento solicitante", w.origin_department ? label(String(w.origin_department)) : ""],
              ["Departamentos vinculados", w.departments.map(label).join(", ")], ["Funções na Doutrina", w.functions.join(", ")],
              ["Dias disponíveis", w.available_days.map((d) => WEEKDAYS[d]).join(", ")], ["Serviço voluntário", w.volunteer_service],
              ["Termo de voluntariado", w.accepts_volunteer_law ? "Aceite registrado" : "Aceite não registrado"],
              ["Autorização de imagem", w.image_authorization ? "Autorização registrada" : "Autorização não registrada"],
              ["Solicitada em", br(w.requested_at)]
            ] as [string, unknown][]).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value || "Não informado")}</dd></div>)}
          </dl>
          <h3>Histórico de decisões</h3>
          <div className="history-list">
            {selected.history.length ? selected.history.map((d) => (
              <article key={d.id}>
                <strong>{d.decision === "approved" ? "Aprovado" : "Reprovado"} pela {d.authority}</strong>
                <p className="small">Deliberação: {dateOnly(d.meeting_date)} · Registro: {br(d.decided_at)} · Responsável: {d.decided_by_name}</p>
                {d.minute_ref ? <p className="small">Ata/reunião: {d.minute_ref}</p> : null}
                {d.reason ? <p className="small">Justificativa: {d.reason}</p> : null}
              </article>
            )) : <p className="small muted">Nenhuma decisão registrada nesta ficha.</p>}
          </div>
          {canDecide && w.status === "pending" ? (
            <form className="form-stack" onSubmit={decide} style={{ marginTop: 16 }}>
              <h3>Decisão da Diretoria</h3>
              <p className="small">Confira a ficha e os requisitos do Regimento. Para Infância e Juventude, observe a aprovação em reunião da Diretoria e Coordenadorias (art. 65, VI).</p>
              <div className="form-row">
                <label>Decisão *
                  <select name="decision" required defaultValue={selected.decision} onChange={(e) => setReject(e.target.value === "rejected")}>
                    <option value="">Selecione</option><option value="approved">Aprovar</option><option value="rejected">Reprovar</option>
                  </select>
                </label>
                <label>Data da deliberação *<input name="meeting_date" type="date" required max={today()} defaultValue={today()} /></label>
              </div>
              <label>Referência da ata ou reunião<input name="minute_ref" maxLength={200} placeholder="Ex.: Ata da Diretoria nº 08/2026, item 3" /></label>
              <label>{reject ? "Motivo da reprovação *" : "Justificativa / observações"}
                <textarea name="reason" rows={3} maxLength={2000} required={reject} placeholder="Na reprovação, informe o motivo para orientar a revisão da ficha." />
              </label>
              <div className="row-actions"><button className={busy ? "button primary is-loading" : "button primary"} disabled={busy}>{busy ? "Salvando a decisão…" : "Salvar decisão da Diretoria"}</button></div>
            </form>
          ) : w.status !== "pending" ? (
            <p className="notice small">{w.status === "rejected" && canEditFicha
              ? "Ficha reprovada. Edite e salve para aprová-la."
              : "Decisão já registrada. Alterações de departamento ou funções de uma ficha aprovada geram nova análise."}</p>
          ) : null}
        </section>
      ) : null}

      <section className="card">
        {status === "" ? (
          <div className="grid cards" style={{ marginBottom: 12 }}>
            <article className="card kpi"><span className="small muted">Fichas recebidas</span><b>{rows.length}</b></article>
            <article className="card kpi"><span className="small muted">Aguardando Diretoria</span><b>{counts("pending")}</b></article>
            <article className="card kpi"><span className="small muted">Reprovadas</span><b>{counts("rejected")}</b></article>
          </div>
        ) : null}
        {canDecide && pendingVisible.length > 1 ? (
          <div className="toolbar" style={{ marginBottom: 12 }}>
            <span className="small muted">{pendingVisible.length} fichas aguardando a Diretoria nesta lista.</span>
            <button className={busy ? "button primary is-loading" : "button primary"} disabled={busy} onClick={() => void approve(pendingVisible)}>
              {busy ? "Aprovando…" : `Aprovar todos (${pendingVisible.length})`}
            </button>
          </div>
        ) : null}
        <div className="filters">
          <label>Buscar<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome ou departamento" /></label>
          <label>Situação
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todas</option>
              {(Object.keys(workerStatusLabel) as WorkerStatus[]).map((key) => <option key={key} value={key}>{workerStatusLabel[key]}</option>)}
            </select>
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Trabalhador</th><th>Departamentos</th><th>Situação</th><th>Última decisão</th><th>Ações</th></tr></thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.full_name}</strong><br /><span className="small muted">Solicitada em {br(r.requested_at)}</span></td>
                  <td>{r.origin_department ? label(r.origin_department) : "—"}<br /><span className="small muted">{r.departments.map(label).join(", ")}</span></td>
                  <td><span className={`status ${workerStatusTone[r.status]}`}>{workerStatusLabel[r.status]}</span></td>
                  <td>{r.last_decision ? <>Diretoria · {dateOnly(r.last_decision.meeting_date)}<br /><span className="small">Registrada por {r.last_decision.decided_by_name}</span></> : r.status === "pending" ? "Aguardando análise" : "—"}</td>
                  <td>
                    <div className="row-actions">
                      <button className="button" onClick={() => void open(r.id)}>Abrir ficha</button>
                      {r.status === "pending" && canDecide ? <>
                        <button className="button primary" disabled={busy} onClick={() => void approve([r])}>Aprovar</button>
                        <button className="button danger" disabled={busy} onClick={() => void open(r.id, "rejected")}>Reprovar</button>
                      </> : null}
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
