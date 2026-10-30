"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ResourceManager, type ResourceRow } from "@/components/resources/resource-manager";
import { useShowMore } from "@/components/show-more";
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

/** Abaixo dos números do Painel da Livraria: disponibilidade por obra e empréstimos em aberto. */
export function BookshopSummary() {
  const { data, error } = useSummary();
  const more = useShowMore(data.books.length, "livros");
  return (
    <div className="grid">
      {error ? <div className="error" role="alert">{error}</div> : null}
      <section className="card">
        <div className="toolbar"><h3>Disponibilidade por obra</h3><button type="button" className="button no-print" onClick={() => window.print()}>⎙ Imprimir</button></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Código</th><th>Obra</th><th>Destinação</th><th>Em estoque</th><th>Emprestados</th><th>Vendidos</th><th>Disponível</th><th>Preço</th></tr></thead>
            <tbody>
              {data.books.map((b, i) => (
                <tr key={b.id} {...more.extra(i)} style={b.active === "Inativo" ? { opacity: 0.6 } : undefined}>
                  <td>{b.code}</td><td><strong>{b.title}</strong></td><td>{b.purpose}</td>
                  <td>{b.in_stock}</td><td>{b.on_loan}</td><td>{b.sold}</td><td><strong>{b.available}</strong></td>
                  <td>{b.purpose === "Revenda" ? formatMoney(b.price_cents) : "—"}</td>
                </tr>
              ))}
              {!data.books.length ? <tr><td colSpan={8}>Nenhuma obra cadastrada.</td></tr> : null}
            </tbody>
          </table>
        </div>
        {more.button}
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

/** Prazo padrão do empréstimo rápido: duas semanas. */
const plusDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * Empréstimos: emprestar (procurar a obra, nome, quantidade) e devolver (procurar a pessoa, "Devolveu tudo")
 * em poucos toques. A lista completa, com a devolução parcial, fica logo abaixo.
 */
export function BookLoansPanel() {
  const { data, reload } = useSummary();
  const [target, setTarget] = useState<Loan | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"emprestar" | "devolver">("emprestar");
  const [q, setQ] = useState("");
  const [book, setBook] = useState<Book | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [borrower, setBorrower] = useState("");
  const [due, setDue] = useState(() => plusDays(todayLocal(), 14));
  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState(0);
  const byId = new Map(data.loans.map((l) => [l.id, l]));

  const term = q.trim().toLocaleLowerCase("pt-BR");
  const lendable = data.books.filter((b) => b.purpose === "Empréstimos" && b.active === "Ativo" && b.available > 0);
  const foundBooks = (term ? lendable.filter((b) => `${b.code} ${b.title}`.toLocaleLowerCase("pt-BR").includes(term)) : lendable).slice(0, 8);
  const openLoans = data.loans.filter((l) => l.open > 0);
  const foundLoans = (term ? openLoans.filter((l) => `${l.borrower} ${l.title}`.toLocaleLowerCase("pt-BR").includes(term)) : openLoans)
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.due_date.localeCompare(b.due_date)).slice(0, 8);

  async function done(text: string) {
    await reload();
    setRound((r) => r + 1);
    setMessage(text);
  }

  async function lend() {
    if (!book) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await postJson("/api/r/divulgacao-emprestimos", {
        book_id: book.id, borrower: borrower.trim(), quantity, contact: "", loan_date: todayLocal(), due_date: due, notes: ""
      });
      const text = `Empréstimo registrado: ${quantity} × ${book.title} para ${borrower.trim()}, devolução até ${brDate(due)}.`;
      setBook(null); setQuantity(1); setBorrower(""); setQ(""); setDue(plusDays(todayLocal(), 14));
      await done(text);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function returnAll(loan: Loan) {
    if (!window.confirm(`Confirmar a devolução de ${loan.open} × ${loan.title} por ${loan.borrower}, hoje?`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await postJson(`/api/divulgacao/emprestimos/${loan.id}/devolucao`, { quantity: loan.open, return_date: todayLocal(), notes: "" });
      await done(`Devolução registrada: ${loan.open} × ${loan.title} (${loan.borrower}).`);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

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
        await done(`Devolução registrada. ${(result as { open: number }).open} exemplar(es) ainda em aberto.`);
      })
      .catch((e: Error) => setError(e.message));
  }

  return (
    <div className="grid">
      <section className="card quick-sale no-print">
        <div className="day-picker" role="group" aria-label="O que fazer" style={{ display: "flex", marginBottom: 0 }}>
          <button type="button" aria-pressed={mode === "emprestar"} onClick={() => { setMode("emprestar"); setQ(""); }}>Emprestar</button>
          <button type="button" aria-pressed={mode === "devolver"} onClick={() => { setMode("devolver"); setQ(""); setBook(null); }}>Devolver ({openLoans.length})</button>
        </div>
        {mode === "emprestar" && book ? (
          <div className="form-stack">
            <div className="quick-item" style={{ cursor: "default" }}>
              <span><strong>{book.title}</strong><small>{book.code} · {book.available} disponível(is)</small></span>
              <button type="button" className="button" onClick={() => setBook(null)}>Trocar</button>
            </div>
            <label>Pessoa que recebe o livro<input value={borrower} maxLength={180} onChange={(e) => setBorrower(e.target.value)} autoComplete="off" /></label>
            <div className="quick-qty" role="group" aria-label="Exemplares">
              <button type="button" className="button" disabled={quantity <= 1} onClick={() => setQuantity(quantity - 1)} aria-label="Menos um">−</button>
              <b>{quantity}</b>
              <button type="button" className="button" disabled={quantity >= book.available} onClick={() => setQuantity(quantity + 1)} aria-label="Mais um">+</button>
            </div>
            <label>Devolver até<input type="date" value={due} min={todayLocal()} onChange={(e) => setDue(e.target.value)} /></label>
            <button type="button" className="button primary" disabled={busy || !borrower.trim() || !due} onClick={() => void lend()}>{busy ? "Gravando…" : "Registrar empréstimo"}</button>
          </div>
        ) : (
          <>
            <label>{mode === "emprestar" ? "Procurar obra" : "Procurar pessoa ou obra"}
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={mode === "emprestar" ? "Título ou código" : "Nome de quem levou ou título"} />
            </label>
            <div className="quick-list">
              {mode === "emprestar" ? foundBooks.map((b) => (
                <button key={b.id} type="button" className="quick-item" onClick={() => { setBook(b); setQuantity(1); setMessage(""); }}>
                  <span><strong>{b.title}</strong><small>{b.code}</small></span>
                  <b>{b.available} disp.</b>
                </button>
              )) : foundLoans.map((l) => (
                <div key={l.id} className="quick-item quick-loan">
                  <span><strong>{l.borrower}</strong><small>{l.open} × {l.title} · até {brDate(l.due_date)}{l.overdue ? " · atrasado" : ""}</small></span>
                  <span className="quick-loan-actions">
                    <button type="button" className="button primary" disabled={busy} onClick={() => void returnAll(l)}>Devolveu</button>
                    {l.open > 1 ? <button type="button" className="button" onClick={() => setTarget(l)}>Parcial</button> : null}
                  </span>
                </div>
              ))}
              {mode === "emprestar" && !foundBooks.length ? <p className="small muted">{lendable.length ? "Nenhuma obra com esse nome." : "Nenhuma obra de empréstimo disponível."}</p> : null}
              {mode === "devolver" && !foundLoans.length ? <p className="small muted">{openLoans.length ? "Ninguém com esse nome." : "Nenhum empréstimo em aberto."}</p> : null}
            </div>
          </>
        )}
      </section>
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
        key={round}
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
