"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ResourceManager, type ResourceRow } from "@/components/resources/resource-manager";
import { api, postJson, todayLocal } from "@/lib/client-api";
import { brDate, formatMoney } from "@/lib/resources/types";

type Book = { id: string; code: string; title: string; purpose: string; active: string; price_cents: string | null; in_stock: number; on_loan: number; sold: number; available: number };
type Loan = { id: string; title: string; borrower: string; loan_date: string; due_date: string; quantity: number; returned: number; open: number; overdue: boolean };

function useSummary() {
  const [data, setData] = useState<{ books: Book[]; loans: Loan[] }>({ books: [], loans: [] });
  const [error, setError] = useState("");
  const reload = () => api<{ books: Book[]; loans: Loan[] }>("/api/divulgacao/resumo").then(setData).catch((e) => setError(e.message));
  useEffect(() => { void reload(); }, []);
  return { data, error, reload };
}

/** Painel da Livraria: disponibilidade por obra e empréstimos em aberto. */
export function BookshopSummary() {
  const { data, error } = useSummary();
  const overdue = data.loans.filter((l) => l.overdue);
  return (
    <div className="grid">
      {error ? <div className="error" role="alert">{error}</div> : null}
      <div className="grid cards">
        <article className="card kpi"><span className="small">Obras cadastradas</span><b>{data.books.length}</b></article>
        <article className="card kpi"><span className="small">Exemplares disponíveis</span><b>{data.books.reduce((s, b) => s + b.available, 0)}</b></article>
        <article className="card kpi"><span className="small">Emprestados em aberto</span><b>{data.loans.reduce((s, l) => s + l.open, 0)}</b></article>
        <article className="card kpi"><span className="small">Empréstimos atrasados</span><b>{overdue.length}</b></article>
      </div>
      <section className="card">
        <div className="toolbar"><h3>Disponibilidade por obra</h3><button type="button" className="button no-print" onClick={() => window.print()}>⎙ Imprimir</button></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Código</th><th>Obra</th><th>Destinação</th><th>Em estoque</th><th>Emprestados</th><th>Vendidos</th><th>Disponível</th><th>Preço</th></tr></thead>
            <tbody>
              {data.books.map((b) => (
                <tr key={b.id} style={b.active === "Inativo" ? { opacity: 0.6 } : undefined}>
                  <td>{b.code}</td><td><strong>{b.title}</strong></td><td>{b.purpose}</td>
                  <td>{b.in_stock}</td><td>{b.on_loan}</td><td>{b.sold}</td><td><strong>{b.available}</strong></td>
                  <td>{b.purpose === "Revenda" ? formatMoney(b.price_cents) : "—"}</td>
                </tr>
              ))}
              {!data.books.length ? <tr><td colSpan={8}>Nenhuma obra cadastrada.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <h3>Empréstimos em aberto</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Obra</th><th>Pessoa</th><th>Saída</th><th>Previsão</th><th>Em aberto</th></tr></thead>
            <tbody>
              {data.loans.filter((l) => l.open > 0).map((l) => (
                <tr key={l.id}><td>{l.title}</td><td>{l.borrower}</td><td>{brDate(l.loan_date)}</td>
                  <td>{brDate(l.due_date)}{l.overdue ? " · atrasado" : ""}</td><td>{l.open}</td></tr>
              ))}
              {!data.loans.some((l) => l.open > 0) ? <tr><td colSpan={5}>Nenhum empréstimo em aberto.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/** Empréstimos com registro de devolução. */
export function BookLoansPanel() {
  const { data, reload } = useSummary();
  const [target, setTarget] = useState<Loan | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const byId = new Map(data.loans.map((l) => [l.id, l]));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const loan = target!;
    setError(""); setMessage("");
    void postJson(`/api/divulgacao/emprestimos/${loan.id}/devolucao`, {
      quantity: Number(form.get("quantity")), return_date: form.get("return_date"), notes: form.get("notes")
    })
      .then(async (result) => {
        setTarget(null);
        await reload();
        setMessage(`Devolução registrada. ${(result as { open: number }).open} exemplar(es) ainda em aberto.`);
      })
      .catch((e: Error) => setError(e.message));
  }

  return (
    <div className="grid">
      {error ? <div className="error" role="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}
      {target ? (
        <section className="card no-print" aria-label="Registrar devolução">
          <h3>Registrar devolução — {target.title}</h3>
          <p className="small muted">{target.borrower} · {target.open} exemplar(es) em aberto · emprestado em {brDate(target.loan_date)}.</p>
          <form className="form-stack" onSubmit={submit}>
            <div className="form-row">
              <label>Exemplares devolvidos *<input type="number" name="quantity" min={1} max={target.open} defaultValue={target.open} required /></label>
              <label>Data da devolução *<input type="date" name="return_date" required defaultValue={todayLocal()} max={todayLocal()} min={target.loan_date} /></label>
              <label style={{ gridColumn: "1 / -1" }}>Observações<textarea name="notes" maxLength={500} rows={2} /></label>
            </div>
            <div className="row-actions">
              <button type="button" className="button" onClick={() => setTarget(null)}>Cancelar</button>
              <button className="button primary">Registrar devolução</button>
            </div>
          </form>
        </section>
      ) : null}
      <ResourceManager
        resourceKey="divulgacao-emprestimos"
        extraColumns={[{ label: "Em aberto", render: (row: ResourceRow) => String(byId.get(row.id)?.open ?? "—") }]}
        rowActions={(row) => {
          const loan = byId.get(row.id);
          return loan && loan.open > 0 ? <button type="button" className="button" onClick={() => setTarget(loan)}>Devolução</button> : null;
        }}
      />
    </div>
  );
}
