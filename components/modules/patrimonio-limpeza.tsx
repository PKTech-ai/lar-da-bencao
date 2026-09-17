"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, postJson, todayLocal } from "@/lib/client-api";
import { brDate, formatMoney } from "@/lib/resources/types";

const MESSAGE = "Cuidar da nossa Casa é também um gesto de amor. Agradecemos sua presença na limpeza de domingo; se você optar por não realizar a limpeza na sua escala, a taxa de serviço de R$ 50,00 ajuda a custear esse cuidado. Com união e carinho, mantemos nosso Lar acolhedor para todos.";
const STATUS: Record<string, string> = { scheduled: "Escalado", done: "Limpeza realizada", fee: "Optou pela taxa de serviço", cancelled: "Cancelado" };
const METHODS = ["PIX", "Dinheiro", "Transferência", "Cartão"];

type Row = {
  id: string; clean_date: string; worker_id: string; worker_snapshot: { id: string; name: string; departments: string[] };
  phone: string; status: keyof typeof STATUS; fee_cents: number; payment_status: "pending" | "paid" | null;
  payment_date: string | null; payment_method: string | null; payment_reference: string; notes: string; cancel_reason: string; version: number;
};
type Conflict = { year: number; worker_id: string; name: string; ids: string[]; dates: string[]; decided: boolean };
type Worker = { id: string; name: string; departments: string[] };

export function CleaningPanel() {
  const year = new Date().getFullYear();
  const [start, setStart] = useState(`${year}-01`);
  const [end, setEnd] = useState(`${year}-12`);
  const [rows, setRows] = useState<Row[]>([]);
  const [sundays, setSundays] = useState<string[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [q, setQ] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showConflicts, setShowConflicts] = useState(false);
  const [teamSize, setTeamSize] = useState("2");
  const [form, setForm] = useState<{ row: Row | null; date: string; status: string; payment: string; selected: string[] } | null>(null);
  const [workerSearch, setWorkerSearch] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const today = todayLocal();

  const load = useCallback(async () => {
    const body = await api<{ rows: Row[]; conflicts: Conflict[]; sundays: string[]; capabilities: { edit: boolean } }>(
      `/api/patrimonio/limpeza?start=${start}&end=${end}`
    );
    setRows(body.rows); setConflicts(body.conflicts); setSundays(body.sundays); setCanEdit(body.capabilities.edit);
  }, [start, end]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load().catch((e) => setError(e.message)); }, [load]);
  useEffect(() => { void api<{ workers: Worker[] }>("/api/lookup/workers?department=patrimonio").catch(() => api<{ workers: Worker[] }>("/api/lookup/workers")).then((b) => setWorkers(b.workers)).catch(() => undefined); }, []);

  const visible = useMemo(() => {
    const needle = q.trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    return rows.filter((r) => (!filterStatus || r.status === filterStatus)
      && (!needle || [r.worker_snapshot?.name, ...(r.worker_snapshot?.departments ?? [])].join(" ").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(needle)));
  }, [rows, q, filterStatus]);

  const openConflicts = conflicts.filter((c) => !c.decided);
  const totals = {
    people: visible.filter((r) => r.status !== "cancelled").length,
    done: visible.filter((r) => r.status === "done").length,
    fee: visible.filter((r) => r.status === "fee").length,
    paid: visible.filter((r) => r.payment_status === "paid").reduce((s, r) => s + r.fee_cents, 0),
    pending: visible.filter((r) => r.payment_status === "pending").reduce((s, r) => s + r.fee_cents, 0)
  };

  async function run(work: () => Promise<string>, onRepeat?: () => void) {
    setBusy(true); setError(""); setMessage("");
    try { setMessage(await work()); await load(); }
    catch (caught) {
      const e = caught as Error & { code?: string };
      setError(e.message);
      if (e.code === "CLEANING_REPEAT" && onRepeat) onRepeat();
    }
    finally { setBusy(false); }
  }

  function openForm(row: Row | null, date = "") {
    setError(""); setMessage(""); setWorkerSearch("");
    setForm({
      row,
      date: row?.clean_date ?? date ?? sundays.find((d) => d >= today) ?? sundays[0] ?? "",
      status: row?.status ?? "scheduled",
      payment: row?.payment_status ?? "pending",
      selected: row ? [row.worker_id] : []
    });
  }

  function save(formEl: HTMLFormElement, keepRepeats = false) {
    const data = new FormData(formEl);
    const state = form!;
    const payload = {
      clean_date: state.date, status: state.status, notes: data.get("notes"), reason: data.get("reason") ?? "",
      payment_status: state.status === "fee" ? state.payment : undefined,
      payment_date: state.payment === "paid" ? data.get("payment_date") : "",
      payment_method: state.payment === "paid" ? data.get("payment_method") : "",
      payment_reference: data.get("payment_reference") ?? "",
      keep_repeats: keepRepeats
    };
    void run(async () => {
      if (!state.selected.length) throw new Error("Selecione ao menos um trabalhador ativo.");
      if (state.row) {
        await postJson(`/api/patrimonio/limpeza/${state.row.id}`, { ...payload, worker_id: state.selected[0], version: state.row.version }, "PATCH");
      } else {
        await postJson("/api/patrimonio/limpeza", { ...payload, worker_ids: state.selected });
      }
      setForm(null);
      return `${state.selected.length} registro(s) salvo(s) para ${brDate(state.date)}.${keepRepeats ? " Repetição mantida por sua escolha." : ""}`;
    });
  }

  function generate() {
    void run(async () => {
      const result = await postJson<{ added: number; missing: number; conflicts: number }>("/api/patrimonio/limpeza/gerar", { start, end, team_size: Number(teamSize) });
      return `${result.added} registro(s) incluído(s).${result.missing ? ` ${result.missing} vaga(s) sem trabalhador disponível no ano.` : ""}${result.conflicts ? ` ${result.conflicts} repetição(ões) a conferir.` : ""}`;
    });
  }

  function keepConflict(c: Conflict) {
    void run(async () => {
      await postJson("/api/patrimonio/limpeza/conflitos", { year: c.year, worker_id: c.worker_id });
      return `Repetição de ${c.name} mantida e registrada no Dedo-duro.`;
    });
  }

  const dayCount = (date: string) => rows.filter((r) => r.clean_date === date && r.status !== "cancelled").length;
  const filteredWorkers = workers.filter((w) => {
    const needle = workerSearch.trim().toLowerCase();
    return !needle || [w.name, ...w.departments].join(" ").toLowerCase().includes(needle);
  });

  return (
    <div className="grid">
      <p className="small muted">Organização pelo Departamento de Patrimônio · Somente aos domingos · Trabalhadores ativos aprovados pela Diretoria.</p>
      <p className="notice no-print">{MESSAGE}</p>
      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}

      <section className="card no-print">
        <div className="filters">
          <label>De<input type="month" value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label>Até<input type="month" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
          <label>Buscar trabalhador / departamento<input type="search" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <label>Situação
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">Todas</option>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <button type="button" className="button" onClick={() => setShowConflicts((v) => !v)}>Conferir conflitos{openConflicts.length ? ` (${openConflicts.length})` : ""}</button>
          <button type="button" className="button" onClick={() => window.print()}>⎙ Imprimir escala do período</button>
          {canEdit ? <button type="button" className="button primary" onClick={() => openForm(null)} disabled={!sundays.length}>Escalar trabalhadores</button> : null}
        </div>
        {!sundays.length ? <p className="notice">Recesso: a escala começa no primeiro domingo de março. Escolha um período com domingos de março a dezembro.</p> : null}
        {canEdit ? (
          <div className="filters">
            <label>Pessoas por domingo<input type="number" min={1} max={500} value={teamSize} onChange={(e) => setTeamSize(e.target.value)} /></label>
            <button type="button" className="button primary" onClick={generate} disabled={busy || !sundays.length}>Gerar escala automática do período</button>
            <p className="small muted">A geração usa trabalhadores ainda não escalados no ano. Se faltarem pessoas, as vagas restantes são informadas.</p>
          </div>
        ) : null}
      </section>

      {showConflicts ? (
        <section className="card no-print">
          <div className="toolbar"><h3>Conferência de conflitos</h3><button type="button" className="button" onClick={() => setShowConflicts(false)}>Fechar conferência</button></div>
          <p role="status">{openConflicts.length ? `${openConflicts.length} trabalhador(es) com mais de uma escala no ano.` : "Nenhuma repetição pendente de conferência no período."}</p>
          {conflicts.map((c) => (
            <div key={`${c.year}-${c.worker_id}`} className="toolbar small">
              <span>{c.name} · {c.year} · {c.dates.map(brDate).join(", ")}{c.decided ? " · repetição mantida" : ""}</span>
              {!c.decided && canEdit ? <button type="button" className="button" onClick={() => keepConflict(c)} disabled={busy}>Manter repetição</button> : null}
            </div>
          ))}
        </section>
      ) : null}

      <div className="grid cards">
        <article className="card kpi"><span className="small">Escalas no período</span><b>{totals.people}</b></article>
        <article className="card kpi"><span className="small">Limpezas realizadas</span><b>{totals.done}</b></article>
        <article className="card kpi"><span className="small">Optaram pela taxa</span><b>{totals.fee}</b></article>
        <article className="card kpi"><span className="small">Taxas recebidas</span><b>{formatMoney(totals.paid)}</b></article>
        <article className="card kpi"><span className="small">Taxas pendentes</span><b>{formatMoney(totals.pending)}</b></article>
      </div>

      {form ? (
        <section className="card no-print" aria-label={form.row ? "Registro de limpeza" : "Escalar trabalhadores"}>
          <div className="toolbar">
            <h2>{form.row ? (canEdit ? "Editar registro de limpeza" : "Consultar registro") : "Escalar trabalhadores"}</h2>
            <button type="button" className="button" onClick={() => setForm(null)}>Fechar</button>
          </div>
          <form className="form-stack" onSubmit={(e) => { e.preventDefault(); save(e.currentTarget); }} id="cleaning-form">
            <div className="form-row">
              <label>Data da limpeza (domingo) *
                <select value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required disabled={!canEdit || form.row?.payment_status === "paid"}>
                  {[...new Set([...(form.row ? [form.row.clean_date] : []), ...sundays])].sort().map((d) => <option key={d} value={d}>{brDate(d)}{dayCount(d) ? ` · ${dayCount(d)} escalado(s)` : ""}</option>)}
                </select>
              </label>
              <label>Situação *
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} required disabled={!canEdit || form.row?.payment_status === "paid"}>
                  {Object.entries(STATUS).filter(([k]) => k !== "cancelled" || form.row).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
            </div>
            <fieldset>
              <legend>Consulta ao cadastro de trabalhadores ativos</legend>
              {canEdit ? <label>Buscar por nome ou departamento<input type="search" value={workerSearch} onChange={(e) => setWorkerSearch(e.target.value)} /></label> : null}
              <div className="check-grid" style={{ maxHeight: 220, overflow: "auto" }}>
                {filteredWorkers.map((w) => (
                  <label key={w.id}>
                    <input type={form.row ? "radio" : "checkbox"} name="worker" value={w.id} disabled={!canEdit || form.row?.payment_status === "paid"}
                      checked={form.selected.includes(w.id)}
                      onChange={(e) => setForm({ ...form, selected: form.row ? [w.id] : e.target.checked ? [...form.selected, w.id] : form.selected.filter((x) => x !== w.id) })} />
                    {w.name}<small> {w.departments.join(" / ") || "Departamento não informado"}</small>
                  </label>
                ))}
                {!filteredWorkers.length ? <p className="small muted">Nenhum trabalhador ativo aprovado encontrado.</p> : null}
              </div>
              <p className="small"><strong>{form.selected.length} trabalhador(es) selecionado(s)</strong>{form.row && !workers.some((w) => w.id === form.row!.worker_id) ? ` · ${form.row.worker_snapshot.name} — vínculo histórico; não está ativo` : ""}</p>
            </fieldset>
            {form.status === "fee" ? (
              <fieldset>
                <legend>Taxa de serviço: R$ 50,00 por trabalhador</legend>
                <div className="form-row">
                  <label>Pagamento da taxa
                    <select value={form.payment} onChange={(e) => setForm({ ...form, payment: e.target.value })} disabled={!canEdit}>
                      <option value="pending">Pendente</option><option value="paid">Recebido</option>
                    </select>
                  </label>
                  {form.payment === "paid" ? <>
                    <label>Data do recebimento *<input type="date" name="payment_date" required max={today} defaultValue={form.row?.payment_date ?? today} /></label>
                    <label>Forma de pagamento *<select name="payment_method" required defaultValue={form.row?.payment_method ?? ""}><option value="">Selecione</option>{METHODS.map((m) => <option key={m}>{m}</option>)}</select></label>
                    <label>Referência do recebimento<input name="payment_reference" maxLength={150} defaultValue={form.row?.payment_reference ?? ""} placeholder="Ex.: identificação do PIX ou recibo" /></label>
                  </> : null}
                </div>
                <p className="small muted">Registre “Recebido” somente após confirmar o pagamento. Este controle não gera lançamento automático no caixa da Tesouraria.</p>
              </fieldset>
            ) : null}
            <div className="form-row">
              <label style={{ gridColumn: "1 / -1" }}>Observações<textarea name="notes" maxLength={1500} rows={2} defaultValue={form.row?.notes ?? ""} /></label>
              {form.row ? <label style={{ gridColumn: "1 / -1" }}>Motivo do cancelamento / correção {form.status === "cancelled" ? "*" : ""}<textarea name="reason" maxLength={1000} rows={2} required={form.status === "cancelled"} /></label> : null}
            </div>
            {canEdit ? (
              <div className="row-actions">
                <button className="button primary" disabled={busy}>{form.row ? "Salvar registro" : "Salvar escala"}</button>
                <button type="button" className="button" disabled={busy} onClick={(e) => {
                  const formEl = e.currentTarget.closest("form") as HTMLFormElement;
                  if (formEl.reportValidity()) save(formEl, true);
                }}>Salvar mantendo repetição no ano</button>
              </div>
            ) : null}
          </form>
        </section>
      ) : null}

      <section className="card">
        <h3>Escala de {start.split("-").reverse().join("/")} a {end.split("-").reverse().join("/")}</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Domingo</th><th>Trabalhador / departamentos</th><th>Situação</th><th>Taxa</th><th>Pagamento</th><th>Observações</th><th className="no-print">Ações</th></tr></thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} style={r.status === "cancelled" ? { opacity: 0.6 } : undefined}>
                  <td>{brDate(r.clean_date)}</td>
                  <td><strong>{r.worker_snapshot?.name}</strong><br /><span className="small">{(r.worker_snapshot?.departments ?? []).join(" / ") || "Departamento não informado"}</span></td>
                  <td>{STATUS[r.status]}</td>
                  <td>{r.fee_cents ? formatMoney(r.fee_cents) : "—"}</td>
                  <td>{r.payment_status === "paid" ? `Recebido em ${brDate(r.payment_date)} · ${r.payment_method}` : r.payment_status === "pending" ? "Pendente" : "—"}</td>
                  <td className="small">{r.notes || r.cancel_reason || "—"}</td>
                  <td className="no-print"><button type="button" className="button" onClick={() => openForm(r)}>{canEdit ? "Editar" : "Consultar"}</button></td>
                </tr>
              ))}
              {!visible.length ? <tr><td colSpan={7}>Nenhum registro no período.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <p className="small muted">{visible.length} registro(s) · domingos disponíveis no período: {sundays.length}</p>
      </section>
    </div>
  );
}
