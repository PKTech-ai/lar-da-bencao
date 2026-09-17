"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, postJson, todayLocal } from "@/lib/client-api";
import { brDate, formatMoney } from "@/lib/resources/types";

type Snapshot = Record<string, string>;
type Request = {
  id: string; number: string; asset_id: string; asset_snapshot: Snapshot; request_date: string; reason: string; destination: string;
  status: "pending" | "approved" | "rejected" | "cancelled"; requested_by_name: string; requested_at: string;
  decision_date: string | null; disposal_date: string | null; decision_reference: string; decision_notes: string;
  decided_by_name: string | null; decided_at: string | null; cancel_reason: string; cancelled_by_name: string | null; cancelled_at: string | null;
  version: number; snapshot_changed: boolean;
};
type Asset = { id: string; tombamento: string; description: string; version: number; entry_date: string };

const STATUS: Record<Request["status"], string> = { pending: "Pendente", approved: "Autorizada", rejected: "Recusada", cancelled: "Cancelada" };
const STATUS_CLASS: Record<Request["status"], string> = { pending: "building", approved: "ready", rejected: "blocked", cancelled: "" };

function AssetDetails({ a }: { a: Snapshot }) {
  const rows: [string, string][] = [
    ["Número de tombamento", a.tombamento], ["Descrição do bem", a.description], ["Departamento", a.department_key],
    ["Data da entrada", brDate(a.entry_date)], ["Valor cadastrado", formatMoney(a.value_cents)], ["Novo / usado", a.condition],
    ["Localização", a.location], ["Responsável pelo bem", a.responsible]
  ];
  return <dl className="details-grid">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || "Não informado"}</dd></div>)}</dl>;
}

export function DisposalsPanel({ area }: { area: "patrimonio" | "diretoria" }) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [caps, setCaps] = useState({ request: false, decide: false });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const [assetId, setAssetId] = useState("");
  const [open, setOpen] = useState<Request | null>(null);
  const [decision, setDecision] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const today = todayLocal();

  const load = useCallback(async () => {
    const params = new URLSearchParams({ q, status });
    const body = await api<{ requests: Request[]; assets: Asset[]; capabilities: typeof caps }>(`/api/patrimonio/baixas?${params}`);
    setRequests(body.requests);
    setAssets(body.assets);
    setCaps(body.capabilities);
    return body.requests;
  }, [q, status]);

  useEffect(() => { const t = setTimeout(() => void load().catch((e) => setError(e.message)), 200); return () => clearTimeout(t); }, [load]);

  async function run(work: () => Promise<string>) {
    setBusy(true); setError(""); setMessage("");
    try { setMessage(await work()); }
    catch (e) { setError((e as Error).message); await load().catch(() => undefined); }
    finally { setBusy(false); }
  }

  const canRequest = area === "patrimonio" && caps.request;
  const canDecide = area === "diretoria" && caps.decide;
  const selectedAsset = assets.find((a) => a.id === assetId);
  const pending = requests.filter((r) => r.status === "pending").length;

  function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void run(async () => {
      if (!selectedAsset) throw new Error("Selecione o bem.");
      const saved = await postJson<{ id: string; number: string }>("/api/patrimonio/baixas", {
        asset_id: selectedAsset.id, asset_version: selectedAsset.version, request_date: data.get("request_date"),
        reason: data.get("reason"), destination: data.get("destination")
      });
      setCreating(false); setAssetId("");
      const list = await load();
      setOpen(list.find((r) => r.id === saved.id) ?? null);
      return `Memorando ${saved.number} gerado e encaminhado à Diretoria. A baixa aguarda autorização.`;
    });
  }

  function submitDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const target = open!;
    void run(async () => {
      await postJson(`/api/patrimonio/baixas/${target.id}`, {
        action: "decide", version: target.version, decision: data.get("decision"), decision_date: data.get("decision_date"),
        disposal_date: data.get("disposal_date") ?? "", reference: data.get("reference"), notes: data.get("notes")
      });
      const list = await load();
      setOpen(list.find((r) => r.id === target.id) ?? null);
      setDecision("");
      return data.get("decision") === "approved" ? "Baixa autorizada e registrada na ficha do bem." : "Recusa registrada. O bem continua no patrimônio.";
    });
  }

  function submitCancel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const target = open!;
    void run(async () => {
      await postJson(`/api/patrimonio/baixas/${target.id}`, { action: "cancel", version: target.version, reason: data.get("reason") });
      const list = await load();
      setOpen(list.find((r) => r.id === target.id) ?? null);
      return "Solicitação cancelada. O memorando continua no histórico.";
    });
  }

  function printMemo(r: Request) {
    setOpen(r);
    setTimeout(() => window.print(), 50);
  }

  return (
    <div className="grid">
      <div className="toolbar">
        <p className="small muted">
          {area === "patrimonio"
            ? "Encaminhe um memorando à Diretoria para solicitar a baixa de um bem e acompanhe a decisão."
            : "Analise os memorandos do Patrimônio. Ao autorizar, a baixa é registrada automaticamente na ficha do bem."}
        </p>
        {canRequest ? <button type="button" className="button primary no-print" onClick={() => { setCreating(true); setOpen(null); }} disabled={!assets.length}>Solicitar baixa</button> : null}
      </div>
      {area === "diretoria" && !caps.decide ? <p className="notice">Consulta. A decisão é registrada pelo Presidente ou pelo Administrador com acesso completo à Diretoria.</p> : null}
      {canRequest && !assets.length ? <p className="notice">Cadastre um bem sem baixa e sem solicitação pendente antes de gerar o memorando.</p> : null}
      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}
      <div className="grid cards">
        <article className="card kpi"><span className="small">Pendentes</span><b>{pending}</b></article>
        <article className="card kpi"><span className="small">Autorizadas</span><b>{requests.filter((r) => r.status === "approved").length}</b></article>
        <article className="card kpi"><span className="small">Recusadas</span><b>{requests.filter((r) => r.status === "rejected").length}</b></article>
      </div>

      {creating ? (
        <section className="card no-print" aria-label="Solicitar autorização de baixa">
          <h2>Solicitar autorização de baixa</h2>
          <p className="small muted">O memorando será numerado e ficará disponível para a Diretoria. O bem permanece no patrimônio enquanto aguarda a decisão.</p>
          <form className="form-stack" onSubmit={submitRequest}>
            <div className="form-row">
              <label style={{ gridColumn: "1 / -1" }}>Bem a baixar *
                <select required value={assetId} onChange={(e) => setAssetId(e.target.value)}>
                  <option value="">Selecione o bem</option>
                  {assets.map((a) => <option key={a.id} value={a.id}>{a.tombamento} — {a.description}</option>)}
                </select>
              </label>
              <label>Data do memorando *<input type="date" name="request_date" required defaultValue={today} max={today} min={selectedAsset?.entry_date} /></label>
              <label>Destinação proposta<input name="destination" maxLength={250} placeholder="Ex.: descarte, doação ou venda" /></label>
              <label style={{ gridColumn: "1 / -1" }}>Motivo / justificativa da baixa *<textarea name="reason" required maxLength={2000} rows={4} /></label>
            </div>
            <div className="row-actions">
              <button type="button" className="button" onClick={() => setCreating(false)}>Cancelar</button>
              <button className="button primary" disabled={busy}>Gerar memorando e encaminhar</button>
            </div>
          </form>
        </section>
      ) : null}

      {open ? (
        <section className="card" aria-label={`Memorando ${open.number}`}>
          <div className="toolbar">
            <h2>Memorando {open.number}</h2>
            <div className="row-actions no-print">
              <button type="button" className="button" onClick={() => window.print()}>⎙ Imprimir memorando</button>
              {area === "patrimonio" ? <Link className="button" href="/sistema/patrimonio">Consultar ficha e anexos do bem</Link> : null}
              <button type="button" className="button" onClick={() => setOpen(null)}>Fechar</button>
            </div>
          </div>
          <p><span className={`status ${STATUS_CLASS[open.status]}`}>{STATUS[open.status]}</span></p>
          <p className="small">De: Departamento de Patrimônio · Para: Diretoria<br />Data: {brDate(open.request_date)} · Solicitante: {open.requested_by_name}</p>
          <AssetDetails a={open.asset_snapshot} />
          <h3>Motivo da solicitação</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{open.reason}</p>
          {open.destination ? <><h3>Destinação proposta</h3><p>{open.destination}</p></> : null}
          {open.decision_date ? (
            <section className="card">
              <h3>Decisão registrada — {STATUS[open.status]}</h3>
              <p>Diretoria · {brDate(open.decision_date)} · {open.decided_by_name}</p>
              {open.disposal_date ? <p><strong>Baixa registrada em {brDate(open.disposal_date)}.</strong></p> : null}
              {open.decision_reference ? <p>Ata / reunião: {open.decision_reference}</p> : null}
              {open.decision_notes ? <p style={{ whiteSpace: "pre-wrap" }}>{open.decision_notes}</p> : null}
              <p className="small muted">Registro no sistema: {open.decided_at ? new Date(open.decided_at).toLocaleString("pt-BR") : ""}</p>
            </section>
          ) : open.status === "cancelled" ? (
            <section className="card"><h3>Solicitação cancelada</h3><p>{open.cancelled_by_name} · {open.cancelled_at ? new Date(open.cancelled_at).toLocaleString("pt-BR") : ""}</p><p>{open.cancel_reason}</p></section>
          ) : <p className="notice">Aguardando decisão da Diretoria. O bem continua no patrimônio.</p>}

          {canDecide && open.status === "pending" ? (
            <form className="form-stack no-print" onSubmit={submitDecision}>
              <h3>Decisão da Diretoria</h3>
              {open.snapshot_changed ? <div className="error" role="alert">O cadastro do bem mudou após o memorando. A autorização está bloqueada; o Patrimônio deve cancelar e encaminhar um novo pedido com os dados atuais.</div> : null}
              <div className="form-row">
                <label>Decisão *
                  <select name="decision" required value={decision} onChange={(e) => setDecision(e.target.value)}>
                    <option value="">Selecione</option>
                    <option value="approved" disabled={open.snapshot_changed}>Autorizar baixa</option>
                    <option value="rejected">Recusar solicitação</option>
                  </select>
                </label>
                <label>Data da decisão *<input type="date" name="decision_date" required defaultValue={today} min={open.request_date} max={today} /></label>
                {decision === "approved" ? <label>Data da baixa autorizada *<input type="date" name="disposal_date" required defaultValue={today} min={open.request_date} max={today} /></label> : null}
                <label>Ata / referência da reunião<input name="reference" maxLength={200} /></label>
                <label style={{ gridColumn: "1 / -1" }}>{decision === "rejected" ? "Motivo da recusa *" : "Observações da decisão"}<textarea name="notes" maxLength={2000} required={decision === "rejected"} rows={3} /></label>
              </div>
              {decision === "approved" ? <p className="small muted">Ao registrar a autorização, o sistema baixa o bem na data informada e vincula esta decisão à ficha.</p> : null}
              <div><button className="button primary" disabled={busy || !decision}>Registrar decisão</button></div>
            </form>
          ) : null}

          {canRequest && open.status === "pending" ? (
            <form className="form-stack no-print" onSubmit={submitCancel}>
              <h3>Cancelar solicitação pendente</h3>
              <p className="small muted">O memorando fica no histórico. Depois do cancelamento, corrija o cadastro e gere um novo pedido.</p>
              <label>Motivo do cancelamento *<textarea name="reason" required minLength={3} maxLength={1000} rows={2} /></label>
              <div><button className="button" disabled={busy}>Registrar cancelamento</button></div>
            </form>
          ) : null}
        </section>
      ) : null}

      <section className="card no-print">
        <div className="filters">
          <label>Buscar memorando ou bem<input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Número, tombamento, descrição ou solicitante" /></label>
          <label>Situação
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todas</option>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Memorando / data</th><th>Bem / valor</th><th>Solicitante</th><th>Situação</th><th>Decisão / baixa</th><th>Ações</th></tr></thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.number}</strong><br /><span className="small">{brDate(r.request_date)}</span></td>
                  <td>{r.asset_snapshot.tombamento} — {r.asset_snapshot.description}<br /><span className="small">{formatMoney(r.asset_snapshot.value_cents)}</span></td>
                  <td>{r.requested_by_name}</td>
                  <td><span className={`status ${STATUS_CLASS[r.status]}`}>{STATUS[r.status]}</span>{r.snapshot_changed ? <><br /><span className="small">Cadastro alterado</span></> : null}</td>
                  <td>{r.decision_date ? `${brDate(r.decision_date)}${r.disposal_date ? ` · baixa ${brDate(r.disposal_date)}` : ""}` : "—"}</td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="button" onClick={() => { setOpen(r); setCreating(false); setDecision(""); }}>{canDecide && r.status === "pending" ? "Analisar" : "Consultar"}</button>
                      <button type="button" className="button" onClick={() => printMemo(r)}>Imprimir</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!requests.length ? <tr><td colSpan={6}>Nenhum memorando encontrado.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
