"use client";

import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { api, postJson } from "@/lib/client-api";
import { brDate, formatMoney } from "@/lib/resources/types";
import { uploadAttachment } from "@/lib/upload-client";

type Summary = {
  month: string; status: string;
  totals: { income: number; expense: number; transfers: number; entries: number; opening: number; closing: number };
  byGroup: { nature: string; account_group: string; code: string; name: string; total: string; entries: number }[];
  byCenter: { cost_center: string; nature: string; total: string }[];
  contributions: { total: number; count: number };
  capabilities: { close: boolean };
};
type Line = {
  id: string; line_date: string; description: string; amount_cents: string; document: string; status: string;
  entry_id: string | null; reason: string; filename: string; format: string;
  suggestions: { id: string; entry_date: string; description: string; amount_cents: string; nature: string }[] | null;
};
type Account = { code: string; name: string; nature: string; account_group: string; is_parent: boolean; active: boolean };

const thisMonth = () => new Date().toISOString().slice(0, 7);
const monthLabel = (month: string) => month.split("-").reverse().join("/");

/** Caixa mensal: totais, fechamento e envio ao Conselho Fiscal. */
export function TreasuryMonthPanel() {
  const [month, setMonth] = useState(thisMonth());
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api<Summary>(`/api/tesouraria/mes?month=${month}`).then(setData).catch((e: Error) => setError(e.message)), [month]);
  useEffect(() => { void load(); }, [load]);

  function act(action: "close" | "reopen" | "send") {
    const notes = action === "reopen" ? window.prompt("Motivo da reabertura do mês:") ?? "" : "";
    if (action === "reopen" && notes.trim().length < 3) return;
    setBusy(true); setError(""); setMessage("");
    void postJson<{ status: string }>("/api/tesouraria/mes", { month, action, notes })
      .then(async (result) => { await load(); setMessage(`Mês ${monthLabel(month)}: ${result.status.toLowerCase()}.`); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  }

  const nature = (list: { nature: string; total: string }[], value: string) => list.filter((r) => r.nature === value);

  return (
    <div className="grid">
      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}
      <section className="card no-print">
        <div className="filters">
          <label>Mês do caixa<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
          <p role="status"><strong>{data?.status ?? "—"}</strong></p>
          <button type="button" className="button" onClick={() => window.print()}>⎙ Imprimir</button>
          {data?.capabilities.close ? (
            <div className="row-actions">
              {data.status === "Aberto" ? <button type="button" className="button primary" onClick={() => act("close")} disabled={busy}>Fechar o mês</button> : null}
              {data.status === "Fechado" ? <>
                <button type="button" className="button primary" onClick={() => act("send")} disabled={busy}>Enviar ao Conselho Fiscal</button>
                <button type="button" className="button" onClick={() => act("reopen")} disabled={busy}>Reabrir</button>
              </> : null}
            </div>
          ) : null}
        </div>
        {data?.status !== "Aberto" ? <p className="notice">Mês {data?.status?.toLowerCase()}: os lançamentos ficam preservados e não podem ser alterados.</p> : null}
      </section>
      <div className="grid cards">
        <article className="card kpi"><span className="small">Saldo anterior</span><b>{formatMoney(data?.totals.opening ?? 0)}</b></article>
        <article className="card kpi"><span className="small">Entradas</span><b>{formatMoney(data?.totals.income ?? 0)}</b></article>
        <article className="card kpi"><span className="small">Saídas</span><b>{formatMoney(data?.totals.expense ?? 0)}</b></article>
        <article className="card kpi"><span className="small">Saldo final</span><b>{formatMoney(data?.totals.closing ?? 0)}</b></article>
        <article className="card kpi"><span className="small">Contribuições do mês</span><b>{formatMoney(data?.contributions.total ?? 0)}</b></article>
        <article className="card kpi"><span className="small">Lançamentos</span><b>{data?.totals.entries ?? 0}</b></article>
      </div>
      {["Receita", "Despesa", "Transferência"].map((kind) => (
        <section key={kind} className="card">
          <h3>{kind === "Receita" ? "Receitas" : kind === "Despesa" ? "Despesas" : "Movimentações financeiras"} por conta</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Conta</th><th>Grupo</th><th>Lançamentos</th><th>Total</th></tr></thead>
              <tbody>
                {(data?.byGroup ?? []).filter((r) => r.nature === kind).map((r) => (
                  <tr key={r.code}><td>{r.code} — {r.name}</td><td>{r.account_group}</td><td>{r.entries}</td><td>{formatMoney(r.total)}</td></tr>
                ))}
                {!(data?.byGroup ?? []).some((r) => r.nature === kind) ? <tr><td colSpan={4}>Nenhum lançamento no mês.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <section className="card">
        <h3>Por centro de custo</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Centro de custo</th><th>Entradas</th><th>Saídas</th></tr></thead>
            <tbody>
              {[...new Set((data?.byCenter ?? []).map((r) => r.cost_center))].map((center) => (
                <tr key={center}>
                  <td>{center}</td>
                  <td>{formatMoney(nature((data?.byCenter ?? []).filter((r) => r.cost_center === center), "Receita")[0]?.total ?? 0)}</td>
                  <td>{formatMoney(nature((data?.byCenter ?? []).filter((r) => r.cost_center === center), "Despesa")[0]?.total ?? 0)}</td>
                </tr>
              ))}
              {!data?.byCenter.length ? <tr><td colSpan={3}>Nenhum lançamento no mês.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/** Extrato bancário importado e conciliação com os lançamentos. */
export function TreasuryStatementPanel() {
  const [month, setMonth] = useState(thisMonth());
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api<{ lines: Line[] }>(`/api/tesouraria/extrato?month=${month}`).then((b) => setLines(b.lines)).catch((e: Error) => setError(e.message)), [month]);
  useEffect(() => { void load(); }, [load]);

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const format = /\.ofx$/i.test(file.name) ? "OFX" : "CSV";
      const content = await file.text();
      const result = await postJson<{ id: string; imported: number; repeated: number; outside: number }>("/api/tesouraria/extrato", {
        reference_month: month, filename: file.name, format, content
      });
      // O arquivo original fica guardado como anexo do extrato importado.
      const kept = await uploadAttachment(
        new File([content], file.name, { type: format === "OFX" ? "application/x-ofx" : "text/csv" }),
        "bank_statement", result.id, undefined, "statement"
      ).then(() => true).catch(() => false);
      await load();
      setMessage(`${result.imported} linha(s) importada(s); ${result.repeated} repetida(s) foram ignoradas${result.outside ? `; ${result.outside} fora do mês` : ""}.${kept ? "" : " O arquivo original não pôde ser anexado."}`);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function decide(line: Line, action: "match" | "ignore" | "undo", entryId?: string) {
    const reason = action === "ignore" ? window.prompt("Motivo para deixar esta linha fora da conciliação:") ?? "" : "";
    if (action === "ignore" && reason.trim().length < 3) return;
    setBusy(true); setError(""); setMessage("");
    void postJson("/api/tesouraria/conciliacao", { line_id: line.id, action, entry_id: entryId, reason })
      .then(async () => { await load(); setMessage("Conciliação atualizada."); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  }

  const pending = lines.filter((l) => l.status === "pending").length;

  return (
    <div className="grid">
      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}
      <section className="card no-print">
        <div className="filters">
          <label>Mês<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
          <label>Importar extrato (OFX ou CSV)<input type="file" accept=".ofx,.csv,text/csv" onChange={(e) => void importFile(e)} disabled={busy} /></label>
          <button type="button" className="button" onClick={() => window.print()}>⎙ Imprimir</button>
        </div>
        <p className="small muted">Linhas repetidas (mesmo dia, valor e histórico) não entram duas vezes. A conciliação sugere lançamentos do banco com o mesmo valor, até cinco dias de diferença.</p>
      </section>
      <div className="grid cards">
        <article className="card kpi"><span className="small">Linhas do mês</span><b>{lines.length}</b></article>
        <article className="card kpi"><span className="small">A conciliar</span><b>{pending}</b></article>
        <article className="card kpi"><span className="small">Conciliadas</span><b>{lines.filter((l) => l.status === "matched").length}</b></article>
        <article className="card kpi"><span className="small">Fora da conciliação</span><b>{lines.filter((l) => l.status === "ignored").length}</b></article>
      </div>
      <section className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Histórico</th><th>Valor</th><th>Situação</th><th className="no-print">Conciliação</th></tr></thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id}>
                  <td>{brDate(line.line_date)}</td>
                  <td>{line.description}<br /><span className="small muted">{line.filename}{line.document ? ` · ${line.document}` : ""}</span></td>
                  <td>{formatMoney(Math.abs(Number(line.amount_cents)))}<br /><span className="small">{Number(line.amount_cents) < 0 ? "saída" : "entrada"}</span></td>
                  <td>{line.status === "matched" ? "Conciliada" : line.status === "ignored" ? `Fora: ${line.reason}` : "A conciliar"}</td>
                  <td className="no-print">
                    {line.status === "pending" ? (
                      <div className="row-actions">
                        {(line.suggestions ?? []).map((s) => (
                          <button key={s.id} type="button" className="button" disabled={busy} onClick={() => decide(line, "match", s.id)}>
                            Conciliar com {brDate(s.entry_date)} — {s.description.slice(0, 30)}
                          </button>
                        ))}
                        {!(line.suggestions ?? []).length ? <span className="small muted">Sem lançamento equivalente</span> : null}
                        <button type="button" className="button" disabled={busy} onClick={() => decide(line, "ignore")}>Deixar fora</button>
                      </div>
                    ) : <button type="button" className="button" disabled={busy} onClick={() => decide(line, "undo")}>Desfazer</button>}
                  </td>
                </tr>
              ))}
              {!lines.length ? <tr><td colSpan={5}>Nenhuma linha importada para o mês.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/** Plano de contas do mock (consulta). */
export function TreasuryAccountsPanel() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { void api<{ accounts: Account[] }>("/api/tesouraria/contas").then((b) => setAccounts(b.accounts)).catch((e: Error) => setError(e.message)); }, []);
  return (
    <div className="grid">
      {error ? <div className="error" role="alert">{error}</div> : null}
      <section className="card">
        <div className="toolbar"><h3>Plano de contas</h3><button type="button" className="button no-print" onClick={() => window.print()}>⎙ Imprimir</button></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Código</th><th>Conta</th><th>Natureza</th><th>Grupo</th><th>Recebe lançamento</th></tr></thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.code} style={a.is_parent ? { fontWeight: 700 } : undefined}>
                  <td>{a.code}</td><td>{a.name}</td><td>{a.nature}</td><td>{a.account_group}</td><td>{a.is_parent ? "Não (sintética)" : "Sim"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/** Relatório anual da Tesouraria. */
export function TreasuryReportPanel() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [report, setReport] = useState<{ months: { month: string; income: string; expense: string }[]; groups: { nature: string; account_group: string; total: string }[] } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { void api<typeof report>(`/api/tesouraria/relatorio?year=${year}`).then(setReport).catch((e: Error) => setError(e.message)); }, [year]);
  const income = report?.months.reduce((s, m) => s + Number(m.income), 0) ?? 0;
  const expense = report?.months.reduce((s, m) => s + Number(m.expense), 0) ?? 0;
  return (
    <div className="grid">
      {error ? <div className="error" role="alert">{error}</div> : null}
      <div className="filters no-print">
        <label>Ano<input type="number" min={1900} max={2199} value={year} onChange={(e) => setYear(e.target.value)} /></label>
        <button type="button" className="button" onClick={() => window.print()}>⎙ Imprimir relatório</button>
      </div>
      <div className="grid cards">
        <article className="card kpi"><span className="small">Entradas no ano</span><b>{formatMoney(income)}</b></article>
        <article className="card kpi"><span className="small">Saídas no ano</span><b>{formatMoney(expense)}</b></article>
        <article className="card kpi"><span className="small">Resultado</span><b>{formatMoney(income - expense)}</b></article>
      </div>
      <section className="card">
        <h3>Por mês</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Mês</th><th>Entradas</th><th>Saídas</th><th>Resultado</th></tr></thead>
            <tbody>
              {(report?.months ?? []).map((m) => (
                <tr key={m.month}><td>{monthLabel(m.month)}</td><td>{formatMoney(m.income)}</td><td>{formatMoney(m.expense)}</td><td>{formatMoney(Number(m.income) - Number(m.expense))}</td></tr>
              ))}
              {!report?.months.length ? <tr><td colSpan={4}>Nenhum lançamento no ano.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <h3>Por grupo do plano de contas</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Natureza</th><th>Grupo</th><th>Total</th></tr></thead>
            <tbody>
              {(report?.groups ?? []).map((g) => <tr key={`${g.nature}-${g.account_group}`}><td>{g.nature}</td><td>{g.account_group}</td><td>{formatMoney(g.total)}</td></tr>)}
              {!report?.groups.length ? <tr><td colSpan={3}>Nenhum lançamento no ano.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
