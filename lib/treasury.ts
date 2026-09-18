import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import type { Actor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { dbPool, query, transaction } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { todayInSaoPaulo } from "@/lib/workers";
import { requireFlag } from "@/lib/feature-flags";
import { assertPermission, hasPermission, type PermissionAction } from "@/lib/permissions";
import { PAYMENT_METHODS as PAYMENT_METHOD_VALUES } from "@/lib/resources/defs/tesouraria";

export const TREASURY_FLAG = "module_tesouraria";
const MODULE = "Tesouraria";
export const monthSchema = z.string().regex(/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/, "Mês inválido.");

export async function requireTreasury(actor: Actor, action: PermissionAction) {
  await requireFlag(TREASURY_FLAG);
  await assertPermission(actor, "tesouraria", action);
}

/** Situação do mês: o caixa fechado não aceita lançamento novo nem alteração. */
export async function monthStatus(client: Pick<PoolClient, "query">, month: string) {
  const result = await client.query<{ status: string }>("select status from app.treasury_months where reference_month = $1", [month]);
  return result.rows[0]?.status ?? "Aberto";
}

export async function assertMonthOpen(client: Pick<PoolClient, "query">, month: string) {
  const status = await monthStatus(client, month);
  if (status !== "Aberto") {
    throw new AppError(
      `O caixa de ${month.split("-").reverse().join("/")} está fechado e já foi liberado ao Conselho Fiscal. Reabra o mês para alterar lançamentos.`,
      409, "MONTH_CLOSED"
    );
  }
}

export async function assertPostingAccount(client: Pick<PoolClient, "query">, code: string) {
  const account = await client.query<{ is_parent: boolean; active: boolean; nature: string; name: string }>(
    "select is_parent, active, nature, name from app.financial_accounts where code = $1",
    [code]
  );
  const row = account.rows[0];
  if (!row) throw new AppError("Conta do plano de contas não encontrada.");
  if (row.is_parent) throw new AppError("Use uma conta analítica (o nível sintético não recebe lançamento).");
  if (!row.active) throw new AppError("Esta conta está inativa no plano de contas.");
  return row;
}

export async function listAccounts() {
  const result = await query("select code, name, nature, account_group, is_parent, active from app.financial_accounts order by code");
  return result.rows;
}

/** Resumo do mês: totais por natureza, grupo e centro de custo, com saldo anterior acumulado. */
export async function monthSummary(month: string) {
  monthSchema.parse(month);
  const first = `${month}-01`;
  const [totals, byGroup, byCenter, previous, statusRow, contributions] = await Promise.all([
    query<{ income: string; expense: string; transfers: string; entries: number }>(
      `select coalesce(sum(amount_cents) filter (where a.nature = 'Receita'), 0)::text as income,
              coalesce(sum(amount_cents) filter (where a.nature = 'Despesa'), 0)::text as expense,
              coalesce(sum(amount_cents) filter (where a.nature = 'Transferência'), 0)::text as transfers,
              count(*)::int as entries
         from app.treasury_entries e join app.financial_accounts a on a.code = e.account_code
        where e.archived_at is null and e.entry_date >= $1::date and e.entry_date < ($1::date + interval '1 month')`,
      [first]
    ),
    query(
      `select a.nature, a.account_group, a.code, a.name, coalesce(sum(e.amount_cents), 0)::text as total, count(*)::int as entries
         from app.treasury_entries e join app.financial_accounts a on a.code = e.account_code
        where e.archived_at is null and e.entry_date >= $1::date and e.entry_date < ($1::date + interval '1 month')
        group by 1, 2, 3, 4 order by a.code`,
      [first]
    ),
    query(
      `select e.cost_center, a.nature, coalesce(sum(e.amount_cents), 0)::text as total
         from app.treasury_entries e join app.financial_accounts a on a.code = e.account_code
        where e.archived_at is null and e.entry_date >= $1::date and e.entry_date < ($1::date + interval '1 month')
        group by 1, 2 order by 1`,
      [first]
    ),
    query<{ balance: string }>(
      `select (coalesce((select sum(case when a.nature = 'Receita' then e.amount_cents when a.nature = 'Despesa' then -e.amount_cents else 0 end)
                          from app.treasury_entries e join app.financial_accounts a on a.code = e.account_code
                         where e.archived_at is null and e.entry_date < $1::date), 0)
            + coalesce((select sum(c.paid_cents) from app.treasury_contributions c where c.reference_month < to_char($1::date, 'YYYY-MM')), 0))::text as balance`,
      [first]
    ),
    query("select * from app.treasury_months where reference_month = $1", [month]),
    query<{ total: string; count: number; expected: string; paid_count: number }>(
      `select coalesce(sum(paid_cents), 0)::text as total, count(*)::int as count,
              coalesce(sum(expected_cents), 0)::text as expected,
              count(*) filter (where paid_cents > 0)::int as paid_count
         from app.treasury_contributions where reference_month = $1`,
      [month]
    )
  ]);
  // A contribuição recebida entra como receita do mês (conta 1.01.01), sem lançamento manual — regra do mock.
  const contributionsPaid = Number(contributions.rows[0].total);
  const income = Number(totals.rows[0].income) + contributionsPaid;
  const expense = Number(totals.rows[0].expense);
  const opening = Number(previous.rows[0].balance);
  return {
    month,
    status: (statusRow.rows[0]?.status as string) ?? "Aberto",
    monthRecord: statusRow.rows[0] ?? null,
    totals: { income, expense, transfers: Number(totals.rows[0].transfers), entries: totals.rows[0].entries, opening, closing: opening + income - expense },
    byGroup: contributionsPaid
      ? [{ nature: "Receita", account_group: "Contribuições", code: "1.01.01", name: "Contribuição Mensal (automático)", total: String(contributionsPaid), entries: contributions.rows[0].paid_count }, ...byGroup.rows]
      : byGroup.rows,
    byCenter: contributionsPaid
      ? [{ cost_center: "Institucional / Administração", nature: "Receita", total: String(contributionsPaid) }, ...byCenter.rows]
      : byCenter.rows,
    contributions: {
      total: contributionsPaid, count: contributions.rows[0].count,
      expected: Number(contributions.rows[0].expected), paidCount: contributions.rows[0].paid_count
    }
  };
}

const closeSchema = z.object({ month: monthSchema, action: z.enum(["close", "reopen"]), notes: z.string().trim().max(2000).optional().default("") });

/**
 * Fecha ou reabre o mês (regra do mock v215):
 * fechar libera o relatório ao Conselho Fiscal na mesma hora; reabrir só é possível enquanto o
 * Conselho não decidiu, e tira o relatório da análise — o parecer em andamento vai para o histórico.
 */
export async function changeMonthStatus(actor: Actor, body: unknown) {
  const input = closeSchema.parse(body);
  const summary = await monthSummary(input.month);
  return transaction(async (client) => {
    const current = await monthStatus(client, input.month);
    const next = input.action === "close" ? "Fechado" : "Aberto";
    if (input.action === "close" && current !== "Aberto") throw new AppError("Este mês já foi fechado.", 409, "ALREADY_CLOSED");
    if (input.action === "reopen") {
      if (current === "Aberto") throw new AppError("Este mês já está aberto.", 409, "ALREADY_OPEN");
      if (input.notes.trim().length < 3) throw new AppError("Informe o motivo da reabertura do caixa.");
      const decided = await client.query<{ status: string; locked_at: string | null }>(
        "select status, locked_at from app.fiscal_reviews where reference_month = $1 and archived_at is null",
        [input.month]
      );
      const review = decided.rows[0];
      if (review?.locked_at) throw new AppError("Esta competência já foi arquivada após decisão do Conselho Fiscal e não pode ser reaberta.", 409, "COUNCIL_ARCHIVED");
      if (review && ["Deferido", "Indeferido"].includes(review.status)) {
        throw new AppError("Esta competência já recebeu decisão do Conselho Fiscal. Para preservar o histórico, o caixa não pode ser reaberto.", 409, "COUNCIL_DECIDED");
      }
    }
    // Parecer ainda em análise sai da pauta do Conselho quando o caixa muda de situação.
    const pulled = await client.query<{ id: string }>(
      `update app.fiscal_reviews set archived_at = now(), archived_by = $2,
              archive_reason = 'Caixa da competência reaberto ou fechado novamente pela Tesouraria.', version = version + 1
        where reference_month = $1 and archived_at is null and status = 'Em análise' returning id`,
      [input.month, actor.id]
    );
    await client.query(
      `insert into app.treasury_months (reference_month, status, opening_cents, closing_cents, income_cents, expense_cents, notes,
                                        closed_by, closed_at, released_by, released_at, reopened_at, reopen_reason)
       values ($1, $2, $3, $4, $5, $6, $7,
               case when $2 = 'Fechado' then $8::uuid end, case when $2 = 'Fechado' then now() end,
               case when $2 = 'Fechado' then $8::uuid end, case when $2 = 'Fechado' then now() end,
               case when $2 = 'Aberto' then now() end, case when $2 = 'Aberto' then $7 else '' end)
       on conflict (reference_month) do update set status = excluded.status, opening_cents = excluded.opening_cents, closing_cents = excluded.closing_cents,
            income_cents = excluded.income_cents, expense_cents = excluded.expense_cents,
            notes = case when excluded.notes = '' then app.treasury_months.notes else excluded.notes end,
            closed_by = excluded.closed_by, closed_at = excluded.closed_at,
            released_by = excluded.released_by, released_at = excluded.released_at,
            reopened_at = excluded.reopened_at, reopen_reason = excluded.reopen_reason,
            version = app.treasury_months.version + 1`,
      [input.month, next, summary.totals.opening, summary.totals.closing, summary.totals.income, summary.totals.expense, input.notes, actor.id]
    );
    await appendAudit(actor, {
      category: "Edição",
      action: input.action === "close" ? "Fechamento do caixa mensal e liberação ao Conselho Fiscal" : "Reabertura do caixa mensal",
      module: MODULE, section: "Caixa Mensal", entityType: "tesouraria-mes", entityId: input.month,
      details: `${input.month} · entradas ${summary.totals.income / 100} · saídas ${summary.totals.expense / 100} · saldo ${summary.totals.closing / 100}`
        + `${input.notes ? ` · ${input.notes}` : ""}${pulled.rowCount ? " · parecer em análise retirado da pauta" : ""}`,
      before: { status: current }, after: { status: next }
    }, client);
    return { status: next, pulledReview: Boolean(pulled.rowCount) };
  });
}

/** Arquiva a decisão do Conselho Fiscal: trava alterações e impede reabrir o caixa. */
export async function lockFiscalReview(actor: Actor, id: string) {
  return transaction(async (client) => {
    const found = await client.query<{ reference_month: string; status: string; locked_at: string | null }>(
      "select reference_month, status, locked_at from app.fiscal_reviews where id = $1 and archived_at is null for update",
      [id]
    );
    const review = found.rows[0];
    if (!review) throw new AppError("Parecer não encontrado.", 404, "NOT_FOUND");
    if (review.locked_at) throw new AppError("Esta decisão já está arquivada.", 409, "ALREADY_ARCHIVED");
    if (!["Deferido", "Indeferido"].includes(review.status)) throw new AppError("Registre a decisão (deferido ou indeferido) antes de arquivar.", 409, "NOT_DECIDED");
    await client.query("update app.fiscal_reviews set locked_at = now(), locked_by = $2, version = version + 1 where id = $1", [id, actor.id]);
    await appendAudit(actor, {
      category: "Edição", action: "Decisão do Conselho Fiscal arquivada", module: "Conselho Fiscal", section: "Análise mensal",
      entityType: "conselho-analises", entityId: id, details: `${review.reference_month} · ${review.status}`
    }, client);
  });
}

/**
 * Grade do mês: todo trabalhador ativo aparece, com o valor combinado na ficha e o que já entrou.
 * (No mock, a grade nasce dos trabalhadores aprovados e ativos.)
 */
export async function contributionsForMonth(month: string) {
  monthSchema.parse(month);
  const result = await query(
    `select w.id as worker_id, w.full_name, w.contribution_cents::text as ficha_cents, w.contribution_due_day,
            c.id, coalesce(c.expected_cents, w.contribution_cents)::text as expected_cents,
            coalesce(c.paid_cents, 0)::text as paid_cents, to_char(c.paid_date,'YYYY-MM-DD') as paid_date,
            c.payment_method, c.reference, c.notes, coalesce(c.version, 0) as version
       from app.workers w
       left join app.treasury_contributions c on c.worker_id = w.id and c.reference_month = $1
      where w.status = 'active'
      order by w.full_name`,
    [month]
  );
  return { month, status: await monthStatus(dbPool(), month), rows: result.rows };
}

export const contributionSchema = z.object({
  reference_month: monthSchema,
  worker_id: z.string().uuid(),
  expected_cents: z.number().int().min(0).max(99_999_999_999),
  paid_cents: z.number().int().min(0).max(99_999_999_999),
  paid_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  payment_method: z.enum(PAYMENT_METHOD_VALUES).optional().or(z.literal("")),
  reference: z.string().trim().max(120).optional().default(""),
  notes: z.string().trim().max(1000).optional().default("")
});

/** Registra (ou corrige) o recebimento da contribuição de uma pessoa no mês. */
export async function saveContribution(actor: Actor, body: unknown) {
  const input = contributionSchema.parse(body);
  const today = todayInSaoPaulo();
  if (input.paid_cents > 0) {
    if (!input.paid_date || input.paid_date > today) throw new AppError("Informe a data do recebimento, até hoje.");
    if (!input.payment_method) throw new AppError("Informe a forma de recebimento.");
  }
  return transaction(async (client) => {
    await assertMonthOpen(client, input.reference_month);
    const worker = await client.query<{ full_name: string; status: string }>(
      "select full_name, status from app.workers where id = $1", [input.worker_id]
    );
    if (!worker.rows[0]) throw new AppError("Trabalhador não encontrado.", 404, "NOT_FOUND");
    if (worker.rows[0].status !== "active") throw new AppError("Só trabalhador ativo entra na grade de contribuições.");
    const before = await client.query<{ paid_cents: string }>(
      "select paid_cents::text from app.treasury_contributions where reference_month = $1 and worker_id = $2",
      [input.reference_month, input.worker_id]
    );
    await client.query(
      `insert into app.treasury_contributions (reference_month, worker_id, expected_cents, paid_cents, paid_date, payment_method, reference, notes, created_by, updated_by)
       values ($1,$2,$3,$4,nullif($5,'')::date,nullif($6,''),$7,$8,$9,$9)
       on conflict (reference_month, worker_id) do update set expected_cents = excluded.expected_cents, paid_cents = excluded.paid_cents,
            paid_date = excluded.paid_date, payment_method = excluded.payment_method, reference = excluded.reference,
            notes = excluded.notes, updated_by = excluded.updated_by, updated_at = now(), version = app.treasury_contributions.version + 1`,
      [input.reference_month, input.worker_id, input.expected_cents, input.paid_cents, input.paid_date ?? "", input.payment_method ?? "",
        input.reference, input.notes, actor.id]
    );
    await appendAudit(actor, {
      category: before.rowCount ? "Edição" : "Inclusão",
      action: input.paid_cents > 0 ? "Contribuição recebida" : "Contribuição sem recebimento no mês",
      module: MODULE, section: "Contribuições", entityType: "tesouraria-contribuicao", entityId: `${input.reference_month}:${input.worker_id}`,
      details: `${worker.rows[0].full_name} · ${input.reference_month} · combinado ${input.expected_cents / 100} · recebido ${input.paid_cents / 100}`,
      before: before.rowCount ? { paid_cents: Number(before.rows[0].paid_cents) } : null,
      after: { paid_cents: input.paid_cents, paid_date: input.paid_date || null, payment_method: input.payment_method || null }
    }, client);
  });
}

// --------------------------------------------------- Extrato bancário

export type StatementLine = { line_date: string; description: string; amount_cents: number; document: string };

const money = (value: string) => {
  const normalized = value.trim().replace(/\s/g, "").replace("R$", "");
  const negative = /^-/.test(normalized) || /\)$/.test(normalized);
  const digits = normalized.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const cents = Math.round(Number(digits.replace("-", "")) * 100);
  if (!/\d/.test(digits) || !Number.isFinite(cents)) throw new AppError("Valor inválido no extrato.");
  return negative ? -cents : cents;
};

const isoFrom = (value: string) => {
  const digits = value.trim();
  if (/^\d{8}/.test(digits)) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  const br = digits.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(digits)) return digits.slice(0, 10);
  throw new AppError("Data inválida no extrato.");
};

/** Lê um extrato OFX (tags STMTTRN) ou CSV com data, descrição e valor. */
export function parseStatement(text: string, format: "OFX" | "CSV"): StatementLine[] {
  if (format === "OFX") {
    return [...text.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)].map((match) => {
      const field = (tag: string) => (match[1].match(new RegExp(`<${tag}>([^<\\r\\n]*)`, "i"))?.[1] ?? "").trim();
      return {
        line_date: isoFrom(field("DTPOSTED")),
        description: (field("MEMO") || field("NAME")).slice(0, 300),
        amount_cents: money(field("TRNAMT")),
        document: (field("FITID") || field("CHECKNUM")).slice(0, 120)
      };
    });
  }
  const rows = text.split(/\r?\n/).filter((line) => line.trim());
  const separator = (rows[0].match(/;/g)?.length ?? 0) >= (rows[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const cells = (line: string) => line.split(separator).map((cell) => cell.trim().replace(/^"|"$/g, ""));
  const header = cells(rows[0]).map((cell) => cell.toLowerCase());
  const hasHeader = header.some((cell) => cell.includes("data")) && header.some((cell) => cell.includes("valor"));
  const index = {
    date: hasHeader ? header.findIndex((c) => c.includes("data")) : 0,
    description: hasHeader ? header.findIndex((c) => c.includes("hist") || c.includes("descri")) : 1,
    amount: hasHeader ? header.findIndex((c) => c.includes("valor")) : 2,
    document: hasHeader ? header.findIndex((c) => c.includes("doc")) : -1
  };
  return rows.slice(hasHeader ? 1 : 0).map((line) => {
    const cell = cells(line);
    return {
      line_date: isoFrom(cell[index.date] ?? ""),
      description: (cell[index.description] ?? "").slice(0, 300),
      amount_cents: money(cell[index.amount] ?? "0"),
      document: index.document >= 0 ? (cell[index.document] ?? "").slice(0, 120) : ""
    };
  });
}

export const importSchema = z.object({
  reference_month: monthSchema,
  filename: z.string().trim().min(1).max(240),
  format: z.enum(["OFX", "CSV"]),
  content: z.string().min(1).max(4_000_000)
});

export function lineFingerprint(month: string, line: StatementLine) {
  return createHash("sha256").update(`${month}|${line.line_date}|${line.amount_cents}|${line.description}|${line.document}`).digest("hex");
}

/** Importa o extrato do mês; linhas repetidas (mesmo dia, valor e histórico) não entram duas vezes. */
export async function importStatement(actor: Actor, body: unknown) {
  const input = importSchema.parse(body);
  const lines = parseStatement(input.content, input.format);
  if (!lines.length) throw new AppError("Nenhum lançamento foi encontrado no arquivo.");
  const outside = lines.filter((line) => !line.line_date.startsWith(input.reference_month));
  if (outside.length === lines.length) throw new AppError("As datas do arquivo não pertencem ao mês selecionado.");
  return transaction(async (client) => {
    const statement = await client.query<{ id: string }>(
      "insert into app.bank_statements (reference_month, filename, format, line_count, imported_by) values ($1,$2,$3,$4,$5) returning id",
      [input.reference_month, input.filename, input.format, lines.length, actor.id]
    );
    let imported = 0;
    let repeated = 0;
    for (const line of lines) {
      const result = await client.query(
        `insert into app.bank_statement_lines (statement_id, line_date, description, amount_cents, document, fingerprint)
         values ($1,$2,$3,$4,$5,$6) on conflict (fingerprint) do nothing`,
        [statement.rows[0].id, line.line_date, line.description, line.amount_cents, line.document, lineFingerprint(input.reference_month, line)]
      );
      if (result.rowCount) imported += 1; else repeated += 1;
    }
    await appendAudit(actor, {
      category: "Inclusão", action: "Importação de extrato bancário", module: MODULE, section: "Extrato e Conciliação",
      entityType: "tesouraria-extrato", entityId: statement.rows[0].id,
      details: `${input.filename} · ${input.reference_month} · ${imported} linha(s) importada(s) · ${repeated} repetida(s) · ${outside.length} fora do mês`
    }, client);
    return { id: statement.rows[0].id, imported, repeated, outside: outside.length };
  });
}

/** Linhas do extrato do mês com sugestão de conciliação (mesmo valor e data próxima). */
export async function statementLines(month: string) {
  monthSchema.parse(month);
  const lines = await query(
    `select l.id, to_char(l.line_date,'YYYY-MM-DD') as line_date, l.description, l.amount_cents::text, l.document, l.status, l.entry_id, l.reason,
            s.filename, s.format,
            (select jsonb_agg(jsonb_build_object('id', e.id, 'entry_date', to_char(e.entry_date,'YYYY-MM-DD'), 'description', e.description, 'amount_cents', e.amount_cents::text, 'nature', a.nature))
               from app.treasury_entries e
               join app.financial_accounts a on a.code = e.account_code
              where e.archived_at is null and e.fund_source = 'Banco'
                and abs(e.amount_cents) = abs(l.amount_cents)
                and e.entry_date between l.line_date - 5 and l.line_date + 5
                and not exists (select 1 from app.bank_statement_lines x where x.entry_id = e.id and x.id <> l.id)) as suggestions
       from app.bank_statement_lines l join app.bank_statements s on s.id = l.statement_id
      where s.reference_month = $1 order by l.line_date, l.id`,
    [month]
  );
  return lines.rows;
}

const reconcileSchema = z.object({
  line_id: z.string().uuid(),
  action: z.enum(["match", "ignore", "undo"]),
  entry_id: z.string().uuid().optional(),
  reason: z.string().trim().max(500).optional().default("")
});

export async function reconcileLine(actor: Actor, body: unknown) {
  const input = reconcileSchema.parse(body);
  return transaction(async (client) => {
    const line = await client.query<{ id: string; status: string; amount_cents: string; line_date: string; description: string }>(
      "select id, status, amount_cents::text, to_char(line_date,'YYYY-MM-DD') as line_date, description from app.bank_statement_lines where id = $1 for update",
      [input.line_id]
    );
    if (!line.rows[0]) throw new AppError("Linha do extrato não encontrada.", 404, "NOT_FOUND");
    if (input.action === "match") {
      if (!input.entry_id) throw new AppError("Selecione o lançamento correspondente.");
      const entry = await client.query<{ amount_cents: string; description: string }>(
        "select amount_cents::text, description from app.treasury_entries e where e.id = $1 and e.archived_at is null",
        [input.entry_id]
      );
      if (!entry.rows[0]) throw new AppError("Lançamento não encontrado.");
      if (Number(entry.rows[0].amount_cents) !== Math.abs(Number(line.rows[0].amount_cents))) {
        throw new AppError("O valor do lançamento não confere com a linha do extrato.");
      }
      await client.query(
        "update app.bank_statement_lines set status = 'matched', entry_id = $2, decided_by = $3, decided_at = now(), reason = '' where id = $1",
        [input.line_id, input.entry_id, actor.id]
      );
    } else if (input.action === "ignore") {
      if (input.reason.length < 3) throw new AppError("Informe o motivo para deixar a linha fora da conciliação.");
      await client.query(
        "update app.bank_statement_lines set status = 'ignored', entry_id = null, decided_by = $3, decided_at = now(), reason = $2 where id = $1",
        [input.line_id, input.reason, actor.id]
      );
    } else {
      await client.query(
        "update app.bank_statement_lines set status = 'pending', entry_id = null, decided_by = $2, decided_at = now(), reason = '' where id = $1",
        [input.line_id, actor.id]
      );
    }
    await appendAudit(actor, {
      category: "Edição",
      action: input.action === "match" ? "Conciliação de extrato bancário" : input.action === "ignore" ? "Linha do extrato fora da conciliação" : "Conciliação desfeita",
      module: MODULE, section: "Extrato e Conciliação", entityType: "tesouraria-extrato-linha", entityId: input.line_id,
      details: `${line.rows[0].line_date} · ${line.rows[0].description} · ${Number(line.rows[0].amount_cents) / 100}${input.reason ? ` · ${input.reason}` : ""}`
    }, client);
  });
}

/** Relatório anual: totais por mês e por grupo do plano de contas. */
export async function treasuryReport(year: number) {
  const [months, groups] = await Promise.all([
    query(
      `select to_char(e.entry_date, 'YYYY-MM') as month,
              coalesce(sum(e.amount_cents) filter (where a.nature = 'Receita'), 0)::text as income,
              coalesce(sum(e.amount_cents) filter (where a.nature = 'Despesa'), 0)::text as expense
         from app.treasury_entries e join app.financial_accounts a on a.code = e.account_code
        where e.archived_at is null and extract(year from e.entry_date) = $1
        group by 1 order by 1`,
      [year]
    ),
    query(
      `select a.nature, a.account_group, coalesce(sum(e.amount_cents), 0)::text as total
         from app.treasury_entries e join app.financial_accounts a on a.code = e.account_code
        where e.archived_at is null and extract(year from e.entry_date) = $1
        group by 1, 2 order by 1, 2`,
      [year]
    )
  ]);
  return { year, months: months.rows, groups: groups.rows };
}

export async function canCloseMonth(actor: Actor) {
  return hasPermission(actor, "tesouraria", "update");
}
