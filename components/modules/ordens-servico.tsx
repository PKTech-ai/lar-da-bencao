"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, postJson } from "@/lib/client-api";

type Status = "open" | "in_progress" | "done" | "rejected" | "cancelled";
type Update = { id: string; kind: "created" | "status" | "note" | "cancel"; status: Status; note: string; created_at: string; created_by_name: string };
type Order = {
  id: string; number: string; department_key: string; department_label: string; kind: string; priority: string; title: string;
  description: string; location: string; status: Status; requested_at: string; requested_by_name: string; updated_at: string;
  closed_at: string | null; version: number; asset_id: string | null; asset_tombamento: string | null; asset_description: string | null;
  updates: Update[];
};
type Department = { key: string; label: string };
type Asset = { id: string; tombamento: string; description: string };
type Capabilities = { open: boolean; execute: boolean; requesterOf: string[] };

const STATUS: Record<Status, string> = { open: "Aberta", in_progress: "Em andamento", done: "Concluída", rejected: "Recusada", cancelled: "Cancelada" };
const STATUS_CLASS: Record<Status, string> = { open: "", in_progress: "building", done: "ready", rejected: "blocked", cancelled: "" };
const KINDS = ["Manutenção", "Conserto", "Instalação", "Limpeza", "Outro"];
const PRIORITIES = ["Baixa", "Normal", "Urgente"];
const ACTIVE: Status[] = ["open", "in_progress"];

const TZ = "America/Sao_Paulo";
const when = (value: string) => new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: TZ });
const day = (value: string) => new Date(value).toLocaleDateString("pt-BR", { timeZone: TZ });

function updateLabel(u: Update) {
  if (u.kind === "created") return "OS aberta";
  if (u.kind === "cancel") return "Cancelada pelo departamento";
  if (u.kind === "status") return STATUS[u.status];
  return "Posição";
}

/**
 * Ordens de Serviço. `area="patrimonio"`: fila de todas as OS para executar.
 * Com `department`: só as OS daquele departamento. Sem nenhum dos dois: as OS dos departamentos do usuário.
 */
export function ServiceOrdersPanel({ area, department }: { area?: "patrimonio"; department?: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [caps, setCaps] = useState<Capabilities>({ open: false, execute: false, requesterOf: [] });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("active");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ q });
    if (department) params.set("department", department);
    const body = await api<{ orders: Order[]; departments: Department[]; assets: Asset[]; capabilities: Capabilities }>(`/api/patrimonio/os?${params}`);
    setOrders(body.orders);
    setDepartments(body.departments);
    setAssets(body.assets);
    setCaps(body.capabilities);
  }, [q, department]);

  useEffect(() => { const t = setTimeout(() => void load().catch((e) => setError(e.message)), 200); return () => clearTimeout(t); }, [load]);

  async function run(work: () => Promise<string>) {
    setBusy(true); setError(""); setMessage("");
    try { setMessage(await work()); }
    catch (e) { setError((e as Error).message); await load().catch(() => undefined); }
    finally { setBusy(false); }
  }

  const openDepartments = department ? departments.filter((d) => d.key === department) : departments;
  const canOpen = caps.open && openDepartments.length > 0;
  const current = orders.find((o) => o.id === openId) ?? null;
  const shown = orders.filter((o) => status === "active" ? ACTIVE.includes(o.status) : !status || o.status === status);
  const count = (s: Status) => orders.filter((o) => o.status === s).length;

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const form = event.currentTarget;
    void run(async () => {
      const saved = await postJson<{ id: string; number: string }>("/api/patrimonio/os", {
        department_key: data.get("department_key"), kind: data.get("kind"), priority: data.get("priority"), title: data.get("title"),
        description: data.get("description"), location: data.get("location"), asset_id: data.get("asset_id") ?? ""
      });
      form.reset();
      setCreating(false);
      await load();
      setOpenId(saved.id);
      return `OS ${saved.number} aberta e enviada ao Patrimônio.`;
    });
  }

  function submitAction(event: FormEvent<HTMLFormElement>, action: "status" | "note" | "cancel") {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const form = event.currentTarget;
    const target = current!;
    void run(async () => {
      const result = await postJson<{ status: Status }>(`/api/patrimonio/os/${target.id}`, {
        action, version: target.version, status: data.get("status") ?? undefined, note: data.get("note") ?? ""
      });
      form.reset();
      await load();
      if (action === "note") return "Posição registrada.";
      if (action === "cancel") return "OS cancelada. Ela continua no histórico.";
      return `OS ${target.number}: ${STATUS[result.status]}.`;
    });
  }

  return (
    <div className="grid">
      <div className="toolbar">
        <p className="small muted">
          {area === "patrimonio"
            ? "Pedidos de serviço de todos os departamentos. Mude a situação e escreva a posição para quem abriu acompanhar."
            : "Peça um serviço ao Patrimônio (conserto, manutenção, instalação) e acompanhe a posição por aqui."}
        </p>
        {canOpen ? <button type="button" className="button primary no-print" onClick={() => { setCreating(true); setOpenId(null); }}>Abrir OS</button> : null}
      </div>
      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}
      <div className="grid cards">
        <article className="card kpi"><span className="small">Abertas</span><b>{count("open")}</b></article>
        <article className="card kpi"><span className="small">Em andamento</span><b>{count("in_progress")}</b></article>
        <article className="card kpi"><span className="small">Urgentes em aberto</span><b>{orders.filter((o) => ACTIVE.includes(o.status) && o.priority === "Urgente").length}</b></article>
        <article className="card kpi"><span className="small">Concluídas</span><b>{count("done")}</b></article>
      </div>

      {creating ? (
        <section className="card no-print" aria-label="Abrir ordem de serviço">
          <h2>Abrir ordem de serviço</h2>
          <p className="small muted">A OS recebe um número e vai direto para o Patrimônio.</p>
          <form className="form-stack" onSubmit={submitCreate}>
            <div className="form-row">
              <label>Departamento *
                <select name="department_key" required defaultValue={openDepartments.length === 1 ? openDepartments[0].key : ""}>
                  {openDepartments.length > 1 ? <option value="">Selecione</option> : null}
                  {openDepartments.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                </select>
              </label>
              <label>Tipo de serviço *
                <select name="kind" required defaultValue="">
                  <option value="">Selecione</option>
                  {KINDS.map((k) => <option key={k}>{k}</option>)}
                </select>
              </label>
              <label>Urgência *
                <select name="priority" required defaultValue="Normal">{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select>
              </label>
              <label style={{ gridColumn: "1 / -1" }}>O que precisa ser feito *<input name="title" required maxLength={150} placeholder="Ex.: Trocar a lâmpada da sala 2" /></label>
              <label>Local<input name="location" maxLength={200} placeholder="Ex.: Salão principal" /></label>
              <label>Bem do patrimônio (se houver)
                <select name="asset_id" defaultValue="">
                  <option value="">Nenhum</option>
                  {assets.map((a) => <option key={a.id} value={a.id}>{a.tombamento} — {a.description}</option>)}
                </select>
              </label>
              <label style={{ gridColumn: "1 / -1" }}>Descrição *<textarea name="description" required maxLength={2000} rows={4} /></label>
            </div>
            <div className="row-actions">
              <button type="button" className="button" onClick={() => setCreating(false)}>Cancelar</button>
              <button className="button primary" disabled={busy}>Abrir OS</button>
            </div>
          </form>
        </section>
      ) : null}

      {current ? (
        <section className="card" aria-label={`OS ${current.number}`}>
          <div className="toolbar">
            <h2>OS {current.number} — {current.title}</h2>
            <div className="row-actions no-print">
              <button type="button" className="button" onClick={() => window.print()}>⎙ Imprimir</button>
              <button type="button" className="button" onClick={() => setOpenId(null)}>Fechar</button>
            </div>
          </div>
          <p><span className={`status ${STATUS_CLASS[current.status]}`}>{STATUS[current.status]}</span>{current.priority === "Urgente" ? <> <span className="status blocked">Urgente</span></> : null}</p>
          <dl className="details-grid">
            {([
              ["Departamento", current.department_label], ["Tipo de serviço", current.kind], ["Urgência", current.priority],
              ["Local", current.location], ["Bem do patrimônio", current.asset_tombamento ? `${current.asset_tombamento} — ${current.asset_description}` : ""],
              ["Aberta por", `${current.requested_by_name} · ${when(current.requested_at)}`]
            ] as [string, string][]).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || "Não informado"}</dd></div>)}
          </dl>
          <h3>Descrição</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{current.description}</p>
          <h3>Posição</h3>
          <ol className="form-stack" style={{ listStyle: "none", padding: 0 }}>
            {current.updates.map((u) => (
              <li key={u.id} className="card">
                <strong>{updateLabel(u)}</strong> <span className="small muted">· {u.created_by_name} · {when(u.created_at)}</span>
                {u.note ? <p style={{ whiteSpace: "pre-wrap", margin: "6px 0 0" }}>{u.note}</p> : null}
              </li>
            ))}
          </ol>

          {ACTIVE.includes(current.status) && caps.execute ? (
            <form className="form-stack no-print" onSubmit={(e) => submitAction(e, "status")}>
              <h3>Mudar a situação</h3>
              <div className="form-row">
                <label>Nova situação *
                  <select name="status" required defaultValue="">
                    <option value="">Selecione</option>
                    {current.status === "open" ? <option value="in_progress">Em andamento</option> : null}
                    <option value="done">Concluída</option>
                    <option value="rejected">Recusada</option>
                  </select>
                </label>
                <label style={{ gridColumn: "1 / -1" }}>Posição (obrigatória para concluir ou recusar)<textarea name="note" maxLength={2000} rows={3} /></label>
              </div>
              <div><button className="button primary" disabled={busy}>Registrar</button></div>
            </form>
          ) : null}

          {ACTIVE.includes(current.status) && (caps.execute || caps.requesterOf.includes(current.department_key)) ? (
            <form className="form-stack no-print" onSubmit={(e) => submitAction(e, "note")}>
              <h3>Escrever uma posição</h3>
              <label>Mensagem *<textarea name="note" required maxLength={2000} rows={2} placeholder="Ex.: Material comprado, serviço na próxima semana." /></label>
              <div><button className="button" disabled={busy}>Registrar posição</button></div>
            </form>
          ) : null}

          {current.status === "open" && caps.requesterOf.includes(current.department_key) ? (
            <form className="form-stack no-print" onSubmit={(e) => submitAction(e, "cancel")}>
              <h3>Cancelar a OS</h3>
              <p className="small muted">Só enquanto o Patrimônio ainda não começou. A OS fica no histórico.</p>
              <label>Motivo do cancelamento *<textarea name="note" required minLength={3} maxLength={2000} rows={2} /></label>
              <div><button className="button" disabled={busy}>Cancelar OS</button></div>
            </form>
          ) : null}
        </section>
      ) : null}

      <section className="card no-print">
        <div className="filters">
          <label>Buscar OS<input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Número, serviço, local ou tombamento" /></label>
          <label>Situação
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">Em aberto</option>
              <option value="">Todas</option>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>OS / data</th><th>Serviço</th>{department ? null : <th>Departamento</th>}<th>Urgência</th><th>Situação</th><th>Última posição</th><th>Ações</th></tr></thead>
            <tbody>
              {shown.map((o) => {
                const last = o.updates[o.updates.length - 1];
                return (
                  <tr key={o.id}>
                    <td><strong>{o.number}</strong><br /><span className="small">{day(o.requested_at)}</span></td>
                    <td>{o.title}<br /><span className="small">{o.kind}{o.location ? ` · ${o.location}` : ""}</span></td>
                    {department ? null : <td>{o.department_label}</td>}
                    <td>{o.priority === "Urgente" ? <span className="status blocked">Urgente</span> : o.priority}</td>
                    <td><span className={`status ${STATUS_CLASS[o.status]}`}>{STATUS[o.status]}</span></td>
                    <td>{last ? <><span className="small">{day(last.created_at)}</span>{last.note ? <><br /><span className="small">{last.note.slice(0, 80)}{last.note.length > 80 ? "…" : ""}</span></> : null}</> : "—"}</td>
                    <td><button type="button" className="button" onClick={() => { setOpenId(o.id); setCreating(false); }}>{caps.execute && ACTIVE.includes(o.status) ? "Atender" : "Consultar"}</button></td>
                  </tr>
                );
              })}
              {!shown.length ? <tr><td colSpan={department ? 6 : 7}>Nenhuma OS encontrada.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
