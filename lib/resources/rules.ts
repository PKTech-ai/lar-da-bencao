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
