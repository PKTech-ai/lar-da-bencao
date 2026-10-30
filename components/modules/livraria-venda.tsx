"use client";

import { useEffect, useState } from "react";
import { ResourceManager } from "@/components/resources/resource-manager";
import { api, postJson, todayLocal } from "@/lib/client-api";
import { formatMoney } from "@/lib/resources/types";

type Book = { id: string; code: string; title: string; purpose: string; active: string; price_cents: string | null; available: number };
const METHODS = ["PIX", "Dinheiro", "Cartão", "Transferência"] as const;

/**
 * Venda rápida da Livraria: procurar a obra, tocar, escolher a quantidade e a forma de pagamento.
 * Grava no mesmo cadastro de Vendas (com a mesma conferência de estoque); a lista completa fica logo abaixo.
 */
export function LivrariaVendas() {
  const [books, setBooks] = useState<Book[]>([]);
  const [q, setQ] = useState("");
  const [book, setBook] = useState<Book | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [method, setMethod] = useState<(typeof METHODS)[number]>("PIX");
  const [buyer, setBuyer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [round, setRound] = useState(0);

  useEffect(() => {
    api<{ books: Book[] }>("/api/divulgacao/resumo").then((b) => setBooks(b.books)).catch((e: Error) => setError(e.message));
  }, [round]);

  const term = q.trim().toLocaleLowerCase("pt-BR");
  const forSale = books.filter((b) => b.purpose === "Revenda" && b.active !== "Inativo" && b.available > 0 && b.price_cents);
  const found = term ? forSale.filter((b) => `${b.code} ${b.title}`.toLocaleLowerCase("pt-BR").includes(term)).slice(0, 8) : forSale.slice(0, 6);
  const price = Number(book?.price_cents ?? 0);

  async function sell() {
    if (!book) return;
    setBusy(true); setError(""); setOk("");
    try {
      await postJson("/api/r/divulgacao-vendas", {
        book_id: book.id, quantity, unit_price_cents: price, sale_date: todayLocal(), payment_method: method, buyer: buyer.trim(), notes: ""
      });
      setOk(`Venda registrada: ${quantity} × ${book.title} · ${formatMoney(price * quantity)} em ${method}.`);
      setBook(null); setQuantity(1); setBuyer(""); setQ("");
      setRound((r) => r + 1);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="grid">
      <section className="card quick-sale">
        <h2>Venda rápida</h2>
        {!book ? (
          <>
            <label>Procurar obra<input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Título ou código" /></label>
            <div className="quick-list">
              {found.map((b) => (
                <button key={b.id} type="button" className="quick-item" onClick={() => { setBook(b); setQuantity(1); setOk(""); }}>
                  <span><strong>{b.title}</strong><small>{b.code} · {b.available} em estoque</small></span>
                  <b>{formatMoney(Number(b.price_cents))}</b>
                </button>
              ))}
              {!found.length ? <p className="small muted">{forSale.length ? "Nenhuma obra com esse nome." : "Nenhuma obra de revenda com estoque."}</p> : null}
            </div>
          </>
        ) : (
          <div className="form-stack">
            <div className="quick-item" style={{ cursor: "default" }}>
              <span><strong>{book.title}</strong><small>{book.code} · {book.available} em estoque</small></span>
              <button type="button" className="button" onClick={() => setBook(null)}>Trocar</button>
            </div>
            <div className="quick-qty" role="group" aria-label="Quantidade">
              <button type="button" className="button" disabled={quantity <= 1} onClick={() => setQuantity(quantity - 1)} aria-label="Menos um">−</button>
              <b>{quantity}</b>
              <button type="button" className="button" disabled={quantity >= book.available} onClick={() => setQuantity(quantity + 1)} aria-label="Mais um">+</button>
              <span>{formatMoney(price * quantity)}</span>
            </div>
            <div className="day-picker" style={{ display: "flex", flexWrap: "wrap" }} role="group" aria-label="Forma de pagamento">
              {METHODS.map((m) => <button key={m} type="button" aria-pressed={m === method} onClick={() => setMethod(m)}>{m}</button>)}
            </div>
            <label>Comprador (opcional)<input value={buyer} maxLength={180} onChange={(e) => setBuyer(e.target.value)} /></label>
            <button type="button" className="button primary" disabled={busy} onClick={() => void sell()}>{busy ? "Gravando…" : `Registrar venda de ${formatMoney(price * quantity)}`}</button>
          </div>
        )}
        {error ? <div className="error" role="alert">{error}</div> : null}
        {ok ? <div className="success" role="status">{ok}</div> : null}
      </section>
      <ResourceManager key={round} resourceKey="divulgacao-vendas" />
    </div>
  );
}
