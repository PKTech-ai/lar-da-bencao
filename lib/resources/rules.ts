import type { PoolClient } from "pg";
import type { Actor } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import type { ResourceDef } from "@/lib/resources/types";

export type RuleContext = {
  client: PoolClient;
  actor: Actor;
  def: ResourceDef;
  input: Record<string, unknown>;
  before: Record<string, unknown> | null;
  mode: "create" | "update" | "archive" | "restore";
};

/** Regras específicas por cadastro (chave em `ResourceDef.rules`). Lançam AppError com mensagem ao usuário. */
export const RULES: Record<string, (ctx: RuleContext) => Promise<void>> = {};

/** Evento só é “Realizado” com a data efetiva informada, até hoje. */
RULES["eventos-agenda"] = async ({ input }) => {
  const status = String(input.status ?? "");
  const date = String(input.event_date ?? "");
  if (status !== "Realizado") return;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  if (!date || date > today) throw new AppError("Para marcar como Realizado, informe a data efetiva do evento, até hoje.");
};

const bookAvailability = async (ctx: RuleContext, purpose: string) => {
  const { availableCopies, bookPurpose } = await import("@/lib/bookshop");
  const bookId = String(ctx.input.book_id);
  const book = await bookPurpose(ctx.client, bookId);
  if (book.purpose !== purpose) throw new AppError(`Selecione uma obra com destinação “${purpose}”.`);
  if (book.active !== "Ativo") throw new AppError("Esta obra está inativa no cadastro.");
  const quantity = Number(ctx.input.quantity ?? 0);
  const available = await availableCopies(ctx.client, bookId, ctx.mode === "update" ? String(ctx.before?.id ?? "") : undefined);
  if (quantity > available) throw new AppError(`Disponível: ${available} exemplar(es) desta obra.`);
};

/** Baixa de estoque não pode passar do disponível. */
RULES["divulgacao-estoque"] = async (ctx) => {
  if (ctx.input.direction !== "Baixa") return;
  const { availableCopies } = await import("@/lib/bookshop");
  const available = await availableCopies(ctx.client, String(ctx.input.book_id));
  const before = ctx.mode === "update" && ctx.before?.direction === "Baixa" ? Number(ctx.before.quantity) : 0;
  if (Number(ctx.input.quantity ?? 0) > available + before) throw new AppError(`Disponível: ${available} exemplar(es) desta obra.`);
};

RULES["divulgacao-emprestimos"] = (ctx) => bookAvailability(ctx, "Empréstimos");
RULES["divulgacao-vendas"] = (ctx) => bookAvailability(ctx, "Revenda");

/** Entrega de rancho: a família precisa estar em acompanhamento na data. */
RULES["assistencia-rancho"] = async ({ client, input }) => {
  const family = await client.query<{ status: string; start_date: string | null }>(
    "select status, to_char(start_date,'YYYY-MM-DD') as start_date from app.social_families where id = $1",
    [String(input.family_id)]
  );
  const row = family.rows[0];
  if (!row) throw new AppError("Família: cadastro não encontrado.");
  if (row.status === "Encerrado" && input.status !== "Cancelada") throw new AppError("Esta família está com o acompanhamento encerrado.");
  const date = String(input.delivery_date ?? "");
  if (date && row.start_date && date < row.start_date) throw new AppError("A entrega não pode ser anterior ao início do acompanhamento.");
};

/** Lançamento do caixa: conta analítica ativa e mês aberto (também no mês de origem, ao mudar a data). */
RULES["tesouraria-lancamentos"] = async ({ client, input, before }) => {
  const { assertMonthOpen, assertPostingAccount } = await import("@/lib/treasury");
  await assertPostingAccount(client, String(input.account_code));
  await assertMonthOpen(client, String(input.entry_date).slice(0, 7));
  if (before?.entry_date) await assertMonthOpen(client, String(before.entry_date).slice(0, 7));
};

/** Contribuição: o mês de referência precisa estar aberto. */
RULES["tesouraria-contribuicoes"] = async ({ client, input, before }) => {
  const { assertMonthOpen } = await import("@/lib/treasury");
  await assertMonthOpen(client, String(input.reference_month));
  if (before?.reference_month && before.reference_month !== input.reference_month) await assertMonthOpen(client, String(before.reference_month));
};

/** Doação recebida: mantenedor ativo e mês aberto. */
RULES["tesouraria-doacoes"] = async ({ client, input }) => {
  const { assertMonthOpen } = await import("@/lib/treasury");
  const supporter = await client.query<{ status: string }>("select status from app.treasury_supporters where id = $1", [String(input.supporter_id)]);
  if (!supporter.rows[0]) throw new AppError("Mantenedor não encontrado.");
  if (supporter.rows[0].status === "Encerrado") throw new AppError("Este mantenedor está com a colaboração encerrada.");
  await assertMonthOpen(client, String(input.received_at).slice(0, 7));
};

/** Análise do Conselho Fiscal: só sobre competência fechada (liberada) e um parecer por mês. */
RULES["conselho-analises"] = async ({ client, input, before }) => {
  if (before?.locked_at) throw new AppError("Esta decisão foi arquivada pelo Conselho Fiscal e não pode mais ser alterada.", 409, "COUNCIL_ARCHIVED");
  const month = String(input.reference_month);
  const released = await client.query<{ status: string }>("select status from app.treasury_months where reference_month = $1", [month]);
  if (released.rows[0]?.status !== "Fechado") {
    throw new AppError("Esta competência ainda não foi fechada pela Tesouraria, então não está na pauta do Conselho Fiscal.");
  }
  const duplicated = await client.query(
    "select 1 from app.fiscal_reviews where reference_month = $1 and archived_at is null and ($2::uuid is null or id <> $2)",
    [month, before?.id ?? null]
  );
  if (duplicated.rowCount) throw new AppError("Já existe uma análise registrada para este mês.", 409, "DUPLICATE");
};
