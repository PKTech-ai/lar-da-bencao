import type { PoolClient } from "pg";
import { z } from "zod";
import type { Actor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { query, transaction } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireFlag } from "@/lib/feature-flags";
import { assertPermission } from "@/lib/permissions";
import { todayInSaoPaulo } from "@/lib/workers";

export const BOOKSHOP_FLAG = "module_divulgacao";

/** Exemplares disponíveis: entradas − baixas − emprestados em aberto − vendidos. */
export async function availableCopies(client: Pick<PoolClient, "query">, bookId: string, ignoreLoan?: string) {
  const result = await client.query<{ available: string }>(
    `select coalesce((select sum(case when direction = 'Entrada' then quantity else -quantity end) from app.book_stock_moves where book_id = $1 and archived_at is null), 0)
          - coalesce((select sum(l.quantity) - coalesce((select sum(r.quantity) from app.book_loan_returns r where r.loan_id = l.id), 0)
                        from app.book_loans l where l.book_id = $1 and l.archived_at is null and ($2::uuid is null or l.id <> $2)), 0)
          - coalesce((select sum(quantity) from app.book_sales where book_id = $1 and archived_at is null), 0) as available`,
    [bookId, ignoreLoan ?? null]
  );
  return Number(result.rows[0].available);
}

export async function bookPurpose(client: Pick<PoolClient, "query">, bookId: string) {
  const result = await client.query<{ purpose: string; active: string; title: string }>("select purpose, active, title from app.books where id = $1", [bookId]);
  if (!result.rows[0]) throw new AppError("Obra não encontrada.", 404, "NOT_FOUND");
  return result.rows[0];
}

export const returnSchema = z.object({
  quantity: z.number().int().min(1).max(1000),
  return_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  notes: z.string().trim().max(500).optional().default("")
});

/** Devolução de exemplares emprestados; libera o inventário de empréstimos. */
export async function registerReturn(actor: Actor, loanId: string, body: unknown) {
  await requireFlag(BOOKSHOP_FLAG);
  await assertPermission(actor, "department", "update", "divulgacao");
  const input = returnSchema.parse(body);
  const today = todayInSaoPaulo();
  return transaction(async (client) => {
    const loan = await client.query<{ id: string; book_id: string; quantity: number; borrower: string; loan_date: string; returned: string }>(
      `select l.id, l.book_id, l.quantity, l.borrower, to_char(l.loan_date,'YYYY-MM-DD') as loan_date,
              coalesce((select sum(r.quantity) from app.book_loan_returns r where r.loan_id = l.id), 0) as returned
         from app.book_loans l where l.id = $1 and l.archived_at is null for update`,
      [loanId]
    );
    const row = loan.rows[0];
    if (!row) throw new AppError("Empréstimo não encontrado.", 404, "NOT_FOUND");
    const open = row.quantity - Number(row.returned);
    if (input.quantity > open) throw new AppError(`Há ${open} exemplar(es) em aberto neste empréstimo.`);
    if (input.return_date < row.loan_date || input.return_date > today) throw new AppError("Informe a data da devolução entre o empréstimo e hoje.");
    await client.query(
      "insert into app.book_loan_returns (loan_id, return_date, quantity, notes, created_by) values ($1,$2,$3,$4,$5)",
      [loanId, input.return_date, input.quantity, input.notes, actor.id]
    );
    const title = (await bookPurpose(client, row.book_id)).title;
    await appendAudit(actor, {
      category: "Edição", action: "Devolução de empréstimo da Livraria", module: "Divulgação", section: "Livraria",
      entityType: "divulgacao-emprestimos", entityId: loanId,
      details: `${title} · ${row.borrower} · ${input.quantity} exemplar(es) em ${input.return_date.split("-").reverse().join("/")}`
    }, client);
    return { open: open - input.quantity };
  });
}

/** Situação dos empréstimos e disponibilidade por obra (para o painel e o relatório). */
export async function bookshopSummary() {
  const [stock, loans] = await Promise.all([
    query(
      `select b.id, b.code, b.title, b.purpose, b.active, b.price_cents,
              coalesce((select sum(case when m.direction = 'Entrada' then m.quantity else -m.quantity end) from app.book_stock_moves m where m.book_id = b.id and m.archived_at is null), 0)::int as in_stock,
              coalesce((select sum(l.quantity) - coalesce((select sum(r.quantity) from app.book_loan_returns r where r.loan_id = l.id), 0) from app.book_loans l where l.book_id = b.id and l.archived_at is null), 0)::int as on_loan,
              coalesce((select sum(s.quantity) from app.book_sales s where s.book_id = b.id and s.archived_at is null), 0)::int as sold
         from app.books b where b.archived_at is null order by b.title`
    ),
    query(
      `select l.id, b.title, l.borrower, to_char(l.loan_date,'YYYY-MM-DD') as loan_date, to_char(l.due_date,'YYYY-MM-DD') as due_date,
              l.quantity, coalesce((select sum(r.quantity) from app.book_loan_returns r where r.loan_id = l.id), 0)::int as returned
         from app.book_loans l join app.books b on b.id = l.book_id
        where l.archived_at is null order by l.due_date`
    )
  ]);
  return {
    books: stock.rows.map((b) => ({ ...b, available: Number(b.in_stock) - Number(b.on_loan) - Number(b.sold) })),
    loans: loans.rows.map((l) => ({ ...l, open: Number(l.quantity) - Number(l.returned), overdue: Number(l.quantity) - Number(l.returned) > 0 && String(l.due_date) < todayInSaoPaulo() }))
  };
}
