"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, postJson, todayLocal } from "@/lib/client-api";
import { PAYMENT_METHODS } from "@/lib/resources/defs/tesouraria";
import { brDate, formatMoney, parseMoney } from "@/lib/resources/types";

type Row = {
  worker_id: string; full_name: string; ficha_cents: string; contribution_due_day: number | null;
  id: string | null; expected_cents: string; paid_cents: string; paid_date: string | null;
  payment_method: string | null; reference: string; notes: string; version: number;
};

const thisMonth = () => new Date().toISOString().slice(0, 7);

/**
 * Grade do mês, como no mock: cada trabalhador ativo com o valor combinado na ficha
 * e o que entrou. O recebido vira receita do caixa (conta 1.01.01) sem lançamento manual.
 */
export function ContributionsPanel() {
  const [month, setMonth] = useState(thisMonth());
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState("Aberto");
  const [canEdit, setCanEdit] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api<{ rows: Row[]; status: string; capabilities: { edit: boolean } }>(`/api/tesouraria/contribuicoes?month=${month}`)
    .then((b) => { setRows(b.rows); setStatus(b.status); setCanEdit(b.capabilities.edit); })
    .catch((e: Error) => setError(e.message)), [month]);
  useEffect(() => { void load(); }, [load]);

  const visible = rows.filter((row) => !q.trim() || row.full_name.toLowerCase().includes(q.trim().toLowerCase()));
  const expected = visible.reduce((sum, row) => sum + Number(row.expected_cents), 0);
  const paid = visible.reduce((sum, row) => sum + Number(row.paid_cents), 0);
  const paidCount = visible.filter((row) => Number(row.paid_cents) > 0).length;

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const row = editing!;
    setBusy(true); setError(""); setMessage("");
    try {
      const paidText = String(data.get("paid") ?? "").trim();
      const expectedText = String(data.get("expected") ?? "").trim();
      void postJson("/api/tesouraria/contribuicoes", {
        reference_month: month, worker_id: row.worker_id,
        expected_cents: expectedText ? parseMoney(expectedText) : 0,
        paid_cents: paidText ? parseMoney(paidText) : 0,
        paid_date: paidText ? data.get("paid_date") : "",
        payment_method: paidText ? data.get("payment_method") : "",
        reference: data.get("reference"), notes: data.get("notes")
      })
        .then(async () => { setEditing(null); await load(); setMessage(`Contribuição de ${row.full_name} registrada.`); })
        .catch((e: Error) => setError(e.message))
        .finally(() => setBusy(false));
    } catch (caught) {
      setError((caught as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="grid">
      <p className="small muted">
        A grade nasce dos trabalhadores ativos, com o valor combinado na ficha de cada um. O que for marcado como recebido
        entra no caixa do mês como receita (Contribuição Mensal), sem precisar de lançamento manual.
      </p>
      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}
      <section className="card no-print">
        <div className="filters">
          <label>Mês<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
          <label>Buscar pessoa<input type="search" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <button type="button" className="button" onClick={() => window.print()}>⎙ Imprimir</button>
        </div>
        {status !== "Aberto" ? <p className="notice">Competência fechada: para alterar um recebimento, reabra o caixa.</p> : null}
      </section>
      <div className="grid cards">
        <article className="card kpi"><span className="small">Combinado no mês</span><b>{formatMoney(expected)}</b></article>
        <article className="card kpi"><span className="small">Recebido</span><b>{formatMoney(paid)}</b></article>
        <article className="card kpi"><span className="small">A receber</span><b>{formatMoney(Math.max(0, expected - paid))}</b></article>
        <article className="card kpi"><span className="small">Pessoas que contribuíram</span><b>{paidCount} de {visible.length}</b></article>
      </div>

      {editing ? (
        <section className="card no-print">
          <div className="toolbar"><h3>{editing.full_name}</h3><button type="button" className="button" onClick={() => setEditing(null)}>Fechar</button></div>
          <form className="form-stack" onSubmit={save} key={editing.worker_id}>
            <div className="form-row">
              <label>Combinado no mês
                <input name="expected" inputMode="decimal" maxLength={20}
                  defaultValue={Number(editing.expected_cents) ? (Number(editing.expected_cents) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : ""} />
              </label>
              <label>Recebido
                <input name="paid" inputMode="decimal" maxLength={20}
                  defaultValue={Number(editing.paid_cents) ? (Number(editing.paid_cents) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : ""} />
                <span className="small muted">Em branco ou zero = não recebido neste mês.</span>
              </label>
              <label>Data do recebimento<input type="date" name="paid_date" max={todayLocal()} defaultValue={editing.paid_date ?? todayLocal()} /></label>
              <label>Forma
                <select name="payment_method" defaultValue={editing.payment_method ?? "Não informado"}>
                  {PAYMENT_METHODS.map((method) => <option key={method}>{method}</option>)}
                </select>
              </label>
              <label>Documento / referência<input name="reference" maxLength={120} defaultValue={editing.reference} /></label>
              <label style={{ gridColumn: "1 / -1" }}>Observações<textarea name="notes" maxLength={1000} rows={2} defaultValue={editing.notes} /></label>
            </div>
            <div><button className="button primary" disabled={busy}>Salvar</button></div>
          </form>
        </section>
      ) : null}

      <section className="card">
        <h3>Contribuições de {month.split("-").reverse().join("/")}</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Pessoa</th><th>Dia previsto</th><th>Combinado</th><th>Recebido</th><th>Data / forma</th><th className="no-print">Ação</th></tr></thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.worker_id}>
                  <td><strong>{row.full_name}</strong></td>
                  <td>{row.contribution_due_day ?? "—"}</td>
                  <td>{formatMoney(row.expected_cents)}</td>
                  <td>{Number(row.paid_cents) ? formatMoney(row.paid_cents) : "—"}</td>
                  <td className="small">{Number(row.paid_cents) ? `${brDate(row.paid_date)} · ${row.payment_method}` : "—"}</td>
                  <td className="no-print">
                    {canEdit && status === "Aberto"
                      ? <button type="button" className="button" onClick={() => setEditing(row)}>{Number(row.paid_cents) ? "Corrigir" : "Registrar"}</button>
                      : null}
                  </td>
                </tr>
              ))}
              {!visible.length ? <tr><td colSpan={6}>Nenhum trabalhador ativo encontrado.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
