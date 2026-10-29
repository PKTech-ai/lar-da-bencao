import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import type { Actor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { query, transaction } from "@/lib/db";
import { AppError, AuthorizationError } from "@/lib/errors";
import { MODULE, SECTION, assertCan, author, can, newToken, sha256hex, type Operator } from "@/lib/ingressos/acesso";
import {
  SALE_SELECT, appUrl, db, loadEvent, loadSaleFor, messageEvent, operatorEvent, saleView, type EventRow, type SaleRow, type SaleView
} from "@/lib/ingressos/dados";
import {
  DEFAULT_DUE_DAYS, MAX_TICKETS_PER_SALE, NAME_ERROR, PAYMENT_METHODS, UNDO_SECONDS, WHATSAPP_ERROR,
  addDays, chargeMessage, codeFromBytes, formatBRL, normalizeBuyerName, normalizeWhatsapp, ticketsMessage, todayManaus, waLink
} from "@/lib/ingressos/regras";

const uuid = z.string().uuid();

// ---------- vendedor do usuário logado ----------

/** Linha de vendedor do usuário (reaproveita a ficha de trabalhador vinculada à conta, se houver). */
export async function ensureUserSeller(client: Pick<PoolClient, "query">, actor: Actor) {
  const own = await client.query<{ id: string }>("select id from app.ticket_sellers where user_id = $1", [actor.id]);
  if (own.rows[0]) return own.rows[0].id;
  const linked = await client.query<{ id: string }>(
    `update app.ticket_sellers s set user_id = $1
      where s.user_id is null and s.worker_id = (select worker_id from app.users where id = $1) returning s.id`,
    [actor.id]
  );
  if (linked.rows[0]) return linked.rows[0].id;
  const created = await client.query<{ id: string }>(
    `insert into app.ticket_sellers (name, whatsapp, worker_id, user_id, created_by)
     select $2, null, u.worker_id, u.id, u.id from app.users u where u.id = $1
     on conflict do nothing returning id`,
    [actor.id, actor.name.slice(0, 120)]
  );
  if (created.rows[0]) return created.rows[0].id;
  const again = await client.query<{ id: string }>("select id from app.ticket_sellers where user_id = $1", [actor.id]);
  return again.rows[0].id;
}

export async function userSellerId(actor: Actor) {
  const result = await query<{ id: string }>("select id from app.ticket_sellers where user_id = $1", [actor.id]);
  return result.rows[0]?.id ?? null;
}

async function operatorSellerId(op: Operator, client?: Pick<PoolClient, "query">) {
  if (op.kind === "seller") return op.sellerId;
  return client ? ensureUserSeller(client, op.actor) : userSellerId(op.actor);
}

/** Quem pode ver/cobrar/dar baixa nesta venda: Equipe/Coordenação, ou o próprio vendedor (trabalhador). */
function assertSaleWrite(op: Operator) {
  if (op.kind === "user") assertCan(op, "pagamento.registrar");
}

// ---------- comprador (RF-17) ----------

export async function findBuyerByWhatsapp(op: Operator, raw: string) {
  if (op.kind === "user") assertCan(op, "venda.criar");
  const whatsapp = normalizeWhatsapp(raw);
  if (!whatsapp) throw new AppError(WHATSAPP_ERROR);
  const result = await query<{ id: string; name: string }>("select id, name from app.ticket_buyers where whatsapp = $1", [whatsapp]);
  return { buyer: result.rows[0] ?? null, whatsapp };
}

/** "Compraram com você": últimos 10 compradores distintos do vendedor. */
export async function recentBuyers(op: Operator) {
  if (op.kind === "user" && !can(op, "venda.criar")) return [];
  const sellerId = await operatorSellerId(op);
  if (!sellerId) return [];
  const result = await query<{ id: string; name: string; whatsapp: string | null }>(
    `select b.id, b.name, b.whatsapp from app.ticket_buyers b
       join (select buyer_id, max(created_at) as last_at from app.ticket_sales
              where seller_id = $1 and cancelled_at is null group by buyer_id) r on r.buyer_id = b.id
      order by r.last_at desc limit 10`,
    [sellerId]
  );
  return result.rows;
}

const buyerEditSchema = z.object({ name: z.string().max(160), whatsapp: z.string().max(40).optional().default("") });

export async function updateBuyer(op: Operator, buyerId: string, body: unknown) {
  assertCan(op, "venda.cancelar"); // Coordenação
  if (!uuid.safeParse(buyerId).success) throw new AppError("Comprador não encontrado.", 404, "NOT_FOUND");
  const input = buyerEditSchema.parse(body);
  const name = normalizeBuyerName(input.name);
  if (!name) throw new AppError(NAME_ERROR);
  const whatsapp = input.whatsapp.trim() ? normalizeWhatsapp(input.whatsapp) : null;
  if (input.whatsapp.trim() && !whatsapp) throw new AppError(WHATSAPP_ERROR);
  return transaction(async (client) => {
    const before = await client.query<{ name: string; whatsapp: string | null }>("select name, whatsapp from app.ticket_buyers where id = $1 for update", [buyerId]);
    if (!before.rows[0]) throw new AppError("Comprador não encontrado.", 404, "NOT_FOUND");
    if (whatsapp) {
      const other = await client.query("select 1 from app.ticket_buyers where whatsapp = $1 and id <> $2", [whatsapp, buyerId]);
      if (other.rowCount) throw new AppError("Este WhatsApp já é de outro comprador.", 409, "DUPLICATE");
    }
    if (!whatsapp) {
      const credit = await client.query("select 1 from app.ticket_sales where buyer_id = $1 and cancelled_at is null and due_date is not null", [buyerId]);
      if (credit.rowCount) throw new AppError("Comprador com venda a prazo precisa de WhatsApp.");
    }
    await client.query("update app.ticket_buyers set name=$2, whatsapp=$3, updated_at=now(), updated_by=$4 where id=$1",
      [buyerId, name, whatsapp, op.kind === "user" ? op.actor.id : null]);
    await appendAudit(author(op), {
      category: "Edição", action: "Comprador corrigido", module: MODULE, section: SECTION, entityType: "ticket_buyer", entityId: buyerId,
      before: before.rows[0], after: { name, whatsapp }
    }, client);
    return { ok: true };
  });
}

// ---------- venda (RF-04) ----------

export const saleCreateSchema = z.object({
  quantity: z.number().int().min(1, "Escolha a quantidade.").max(MAX_TICKETS_PER_SALE, `No máximo ${MAX_TICKETS_PER_SALE} ingressos por venda.`),
  payment: z.enum(["pix", "dinheiro", "prazo"], { message: "Escolha como vai pagar." }),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  buyer_id: z.string().uuid().optional(),
  whatsapp: z.string().max(40).optional(),
  name: z.string().max(160).optional(),
  no_whatsapp: z.boolean().optional().default(false),
  seller_id: z.string().uuid().optional()
});

async function newTickets(client: PoolClient, saleId: string, eventId: string, quantity: number) {
  const tickets: { id: string; number: number; code: string; token: string }[] = [];
  for (let number = 1; number <= quantity; number++) {
    for (let attempt = 0; ; attempt++) {
      if (attempt > 40) throw new AppError("Não foi possível gerar os códigos. Tente de novo.", 503, "CODE_EXHAUSTED");
      const code = codeFromBytes(randomBytes(12));
      if (!code) continue;
      const token = newToken(18);
      const inserted = await client.query<{ id: string }>(
        `insert into app.ticket_tickets (sale_id, event_id, number, code, token) values ($1,$2,$3,$4,$5)
         on conflict do nothing returning id`,
        [saleId, eventId, number, code, token]
      );
      if (inserted.rows[0]) { tickets.push({ id: inserted.rows[0].id, number, code, token }); break; }
    }
  }
  return tickets;
}

/** Novo link público (RF-16). Só o hash fica no banco; os links anteriores continuam valendo. */
async function newSaleLink(client: Pick<PoolClient, "query">, saleId: string) {
  const token = newToken(18);
  await client.query("insert into app.ticket_sale_links (sale_id, token_hash) values ($1, $2)", [saleId, sha256hex(token)]);
  return appUrl(`/i/${token}`);
}

async function saleCodes(client: Pick<PoolClient, "query">, saleId: string) {
  const result = await client.query<{ code: string }>("select code from app.ticket_tickets where sale_id = $1 order by number", [saleId]);
  return result.rows.map((row) => row.code);
}

function sendPayload(event: EventRow, sale: Pick<SaleView, "buyer_name" | "buyer_whatsapp" | "balance_cents" | "due_date">, codes: string[], link: string) {
  const message = ticketsMessage({ event: messageEvent(event), buyerName: sale.buyer_name, codes, link, balanceCents: sale.balance_cents, dueDate: sale.due_date });
  return { message, wa_url: sale.buyer_whatsapp ? waLink(sale.buyer_whatsapp, message) : null, link };
}

export async function createSale(op: Operator, body: unknown) {
  if (op.kind === "user") assertCan(op, "venda.criar");
  const input = saleCreateSchema.parse(body);
  if (input.payment === "prazo" && (input.no_whatsapp || (!input.whatsapp && !input.buyer_id))) {
    throw new AppError("Venda a prazo precisa do WhatsApp do comprador.");
  }
  if (input.seller_id && op.kind === "seller") throw new AuthorizationError();

  return transaction(async (client) => {
    const event = await operatorEvent(op, client);
    if (!event || (op.kind === "user" && event.status !== "active")) throw new AppError("Nenhum evento ativo. Peça à coordenação para criar um.", 409, "NO_ACTIVE_EVENT");
    if (event.status !== "active") throw new AppError("As vendas deste evento estão encerradas.", 409, "EVENT_CLOSED");
    await client.query("select id from app.ticket_events where id = $1 for share", [event.id]);

    const ownSeller = await operatorSellerId(op, client) as string;
    let sellerId = ownSeller;
    if (input.seller_id && input.seller_id !== ownSeller) {
      const exists = await client.query("select 1 from app.ticket_sellers where id = $1", [input.seller_id]);
      if (!exists.rowCount) throw new AppError("Vendedor não encontrado.", 404, "NOT_FOUND");
      sellerId = input.seller_id;
    }

    // Comprador: pela lista "Compraram com você", pelo WhatsApp (único na Casa) ou só nome ("Sem WhatsApp").
    let buyerId: string;
    let buyerName: string;
    let buyerWhatsapp: string | null = null;
    let typedNameDiffers: string | null = null;
    const createdBy = op.kind === "user" ? [op.actor.id, null] : [null, op.sellerId];
    if (input.buyer_id) {
      const found = await client.query<{ id: string; name: string; whatsapp: string | null }>(
        `select b.id, b.name, b.whatsapp from app.ticket_buyers b where b.id = $1
           and ($2::uuid is null or exists (select 1 from app.ticket_sales v where v.buyer_id = b.id and v.seller_id = $2))`,
        [input.buyer_id, op.kind === "seller" ? op.sellerId : null]
      );
      if (!found.rows[0]) throw new AppError("Comprador não encontrado.", 404, "NOT_FOUND");
      ({ id: buyerId, name: buyerName, whatsapp: buyerWhatsapp } = found.rows[0]);
      if (input.payment === "prazo" && !buyerWhatsapp) throw new AppError("Venda a prazo precisa do WhatsApp do comprador.");
    } else if (input.no_whatsapp) {
      const name = normalizeBuyerName(input.name ?? "");
      if (!name) throw new AppError(NAME_ERROR);
      const created = await client.query<{ id: string }>(
        "insert into app.ticket_buyers (name, whatsapp, created_by_user, created_by_seller) values ($1, null, $2, $3) returning id",
        [name, ...createdBy]
      );
      buyerId = created.rows[0].id;
      buyerName = name;
    } else {
      const whatsapp = normalizeWhatsapp(input.whatsapp ?? "");
      if (!whatsapp) throw new AppError(WHATSAPP_ERROR);
      const typed = input.name?.trim() ? normalizeBuyerName(input.name) : null;
      const existing = await client.query<{ id: string; name: string }>("select id, name from app.ticket_buyers where whatsapp = $1", [whatsapp]);
      if (existing.rows[0]) {
        ({ id: buyerId, name: buyerName } = existing.rows[0]);
        if (typed && typed !== buyerName) typedNameDiffers = typed;
      } else {
        if (!typed) throw new AppError(NAME_ERROR);
        const created = await client.query<{ id: string; name: string }>(
          `insert into app.ticket_buyers (name, whatsapp, created_by_user, created_by_seller) values ($1, $2, $3, $4)
           on conflict (whatsapp) do update set whatsapp = excluded.whatsapp returning id, name`,
          [typed, whatsapp, ...createdBy]
        );
        ({ id: buyerId, name: buyerName } = created.rows[0]);
      }
      buyerWhatsapp = whatsapp;
    }

    const today = todayManaus();
    let dueDate: string | null = null;
    if (input.payment === "prazo") {
      dueDate = input.due_date && op.kind === "user" ? input.due_date : addDays(today, DEFAULT_DUE_DAYS);
      if (dueDate < today) throw new AppError("O vencimento não pode ser antes de hoje.");
    }

    const total = input.quantity * event.price_cents;
    const sale = await client.query<{ id: string }>(
      `insert into app.ticket_sales (event_id, buyer_id, seller_id, quantity, unit_price_cents, total_cents, due_date, registered_by_user, registered_by_seller)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [event.id, buyerId, sellerId, input.quantity, event.price_cents, total, dueDate, ...createdBy]
    );
    const saleId = sale.rows[0].id;
    const tickets = await newTickets(client, saleId, event.id, input.quantity);
    if (input.payment !== "prazo") {
      // RN-20: dinheiro recebido pelo trabalhador (ou lançado em nome de outro vendedor) fica "em mãos" dele até o acerto.
      const custody = input.payment === "dinheiro" && (op.kind === "seller" || sellerId !== ownSeller) ? sellerId : null;
      await client.query(
        `insert into app.ticket_payments (sale_id, amount_cents, method, registered_by_user, registered_by_seller, custody_seller_id)
         values ($1,$2,$3,$4,$5,$6)`,
        [saleId, total, input.payment, ...createdBy, custody]
      );
    }
    const link = await newSaleLink(client, saleId);
    await appendAudit(author(op), {
      category: "Inclusão", action: "Venda de ingressos", module: MODULE, section: SECTION, entityType: "ticket_sale", entityId: saleId,
      details: `${input.quantity} ingresso(s) · ${formatBRL(total)} · ${input.payment === "prazo" ? `a prazo até ${dueDate}` : input.payment} · ${buyerName}`,
      after: { event_id: event.id, quantity: input.quantity, payment: input.payment, seller_id: sellerId, buyer_id: buyerId },
      metadata: typedNameDiffers ? { nome_digitado: typedNameDiffers } : undefined
    }, client);

    const balance = input.payment === "prazo" ? total : 0;
    return {
      sale_id: saleId,
      codes: tickets.map((t) => t.code),
      buyer_name: buyerName,
      no_whatsapp: !buyerWhatsapp,
      ...sendPayload(event, { buyer_name: buyerName, buyer_whatsapp: buyerWhatsapp, balance_cents: balance, due_date: dueDate }, tickets.map((t) => t.code), link)
    };
  });
}

// ---------- detalhe, reenvio e cobrança ----------

export async function saleDetail(op: Operator, saleId: string) {
  if (op.kind === "user" && !can(op, "venda.criar") && !can(op, "caixa.ver")) throw new AuthorizationError();
  const sale = await loadSaleFor(op, saleId);
  const [tickets, payments, ownSeller] = await Promise.all([
    query<{ id: string; number: number; code: string; token: string; delivered_at: string | null; delivered_by_name: string | null }>(
      `select t.id, t.number, t.code, t.token, t.delivered_at, u.full_name as delivered_by_name
         from app.ticket_tickets t left join app.users u on u.id = t.delivered_by where t.sale_id = $1 order by t.number`, [saleId]),
    query<{ id: string; amount_cents: number; method: string; received_at: string; registered_by_name: string; custody_name: string | null; reversed_at: string | null; reverse_reason: string | null }>(
      `select p.id, p.amount_cents, p.method, p.received_at,
              coalesce(u.full_name, s.name || ' (trabalhador)') as registered_by_name, cs.name as custody_name, p.reversed_at, p.reverse_reason
         from app.ticket_payments p
         left join app.users u on u.id = p.registered_by_user
         left join app.ticket_sellers s on s.id = p.registered_by_seller
         left join app.ticket_sellers cs on cs.id = p.custody_seller_id
        where p.sale_id = $1 order by p.received_at`, [saleId]),
    operatorSellerId(op)
  ]);
  const isOwn = ownSeller === sale.seller_id;
  return {
    sale,
    tickets: tickets.rows,
    payments: payments.rows,
    can: {
      pay: !sale.cancelled_at && sale.balance_cents > 0 && (op.kind === "seller" || can(op, "pagamento.registrar")),
      reverse: can(op, "pagamento.estornar") && !sale.cancelled_at,
      cancel: can(op, "venda.cancelar") && !sale.cancelled_at,
      undo: isOwn && !sale.cancelled_at && sale.delivered === 0 && sale.undo_seconds_left > 0,
      edit_due: !sale.cancelled_at && sale.balance_cents > 0 && (op.kind === "seller" || can(op, "pagamento.registrar")),
      edit_buyer: can(op, "venda.cancelar"),
      undo_delivery: can(op, "ticket.desfazer_entrega")
    }
  };
}

export async function resendSale(op: Operator, saleId: string) {
  if (op.kind === "user" && !can(op, "venda.criar") && !can(op, "pagamento.registrar")) throw new AuthorizationError();
  return transaction(async (client) => {
    const sale = await loadSaleFor(op, saleId, client);
    if (sale.cancelled_at) throw new AppError("Ingressos cancelados.", 409, "CANCELLED");
    const event = await loadEvent(sale.event_id, client);
    if (!event) throw new AppError("Evento não encontrado.", 404, "NOT_FOUND");
    const link = await newSaleLink(client, saleId);
    return sendPayload(event, sale, await saleCodes(client, saleId), link);
  });
}

export async function chargeSale(op: Operator, saleId: string) {
  assertSaleWrite(op);
  const sale = await loadSaleFor(op, saleId);
  if (sale.cancelled_at || sale.balance_cents === 0) throw new AppError("Esta venda não tem valor em aberto.");
  if (!sale.buyer_whatsapp) throw new AppError("Comprador sem WhatsApp.");
  const event = await loadEvent(sale.event_id);
  if (!event) throw new AppError("Evento não encontrado.", 404, "NOT_FOUND");
  const message = chargeMessage({ event: messageEvent(event), buyerName: sale.buyer_name, quantity: sale.quantity, balanceCents: sale.balance_cents, dueDate: sale.due_date });
  return { message, wa_url: waLink(sale.buyer_whatsapp, message) };
}

// ---------- desfazer e cancelar (RF-06, RN-10, RN-25) ----------

export async function undoSale(op: Operator, saleId: string) {
  return transaction(async (client) => {
    const sale = await loadSaleFor(op, saleId, client, true);
    const ownSeller = await operatorSellerId(op);
    if (ownSeller !== sale.seller_id) throw new AuthorizationError("Só quem vendeu pode desfazer a venda.");
    if (sale.cancelled_at) throw new AppError("Esta venda já foi cancelada.", 409, "CANCELLED");
    const updated = await client.query(
      `update app.ticket_sales v set cancelled_at = now(), cancel_reason = 'desfeita pelo vendedor', undone = true,
              cancelled_by_user = $2, cancelled_by_seller = $3
        where v.id = $1 and v.cancelled_at is null and v.created_at > now() - make_interval(secs => $4)
          and not exists (select 1 from app.ticket_tickets t where t.sale_id = v.id and t.delivered_at is not null)`,
      [saleId, op.kind === "user" ? op.actor.id : null, op.kind === "seller" ? op.sellerId : null, UNDO_SECONDS]
    );
    if (!updated.rowCount) throw new AppError("O prazo de 2 minutos para desfazer acabou. Peça à coordenação para cancelar.", 409, "UNDO_EXPIRED");
    await client.query(
      "update app.ticket_payments set reversed_at = now(), reverse_reason = 'venda desfeita pelo vendedor' where sale_id = $1 and reversed_at is null", [saleId]);
    await appendAudit(author(op), {
      category: "Exclusão", action: "Venda desfeita pelo vendedor", module: MODULE, section: SECTION, entityType: "ticket_sale", entityId: saleId,
      details: `${sale.quantity} ingresso(s) · ${sale.buyer_name}`
    }, client);
    return { ok: true };
  });
}

const reasonSchema = z.object({ reason: z.string().trim().min(3, "Informe o motivo.").max(200) });

export async function cancelSale(op: Operator, saleId: string, body: unknown) {
  assertCan(op, "venda.cancelar");
  const { reason } = reasonSchema.parse(body);
  return transaction(async (client) => {
    const sale = await loadSaleFor(op, saleId, client, true);
    if (sale.cancelled_at) throw new AppError("Esta venda já foi cancelada.", 409, "CANCELLED");
    await client.query("update app.ticket_sales set cancelled_at = now(), cancelled_by_user = $2, cancel_reason = $3 where id = $1",
      [saleId, op.kind === "user" ? op.actor.id : null, reason]);
    await appendAudit(author(op), {
      category: "Exclusão", action: "Venda de ingressos cancelada", module: MODULE, section: SECTION, entityType: "ticket_sale", entityId: saleId,
      details: `${sale.quantity} ingresso(s) · ${sale.buyer_name} · motivo: ${reason}`
    }, client);
    return { ok: true };
  });
}

// ---------- pagamentos (RF-07) ----------

const paymentSchema = z.object({
  amount_cents: z.number().int().positive("Informe o valor recebido."),
  method: z.enum(PAYMENT_METHODS, { message: "Escolha Pix ou Dinheiro." })
});

export async function addPayment(op: Operator, saleId: string, body: unknown) {
  assertSaleWrite(op);
  const input = paymentSchema.parse(body);
  return transaction(async (client) => {
    const sale = await loadSaleFor(op, saleId, client, true);
    if (sale.cancelled_at) throw new AppError("Venda cancelada não recebe pagamento.", 409, "CANCELLED");
    if (input.amount_cents > sale.balance_cents) throw new AppError(`O valor é maior que o saldo de ${formatBRL(sale.balance_cents)}.`);
    const custody = input.method === "dinheiro" && op.kind === "seller" ? op.sellerId : null;
    const inserted = await client.query<{ id: string }>(
      `insert into app.ticket_payments (sale_id, amount_cents, method, registered_by_user, registered_by_seller, custody_seller_id)
       values ($1,$2,$3,$4,$5,$6) returning id`,
      [saleId, input.amount_cents, input.method, op.kind === "user" ? op.actor.id : null, op.kind === "seller" ? op.sellerId : null, custody]
    );
    await appendAudit(author(op), {
      category: "Inclusão", action: "Baixa de pagamento de ingressos", module: MODULE, section: SECTION, entityType: "ticket_payment", entityId: inserted.rows[0].id,
      details: `${formatBRL(input.amount_cents)} em ${input.method} · ${sale.buyer_name}`
    }, client);
    return { ok: true, balance_cents: sale.balance_cents - input.amount_cents };
  });
}

export async function reversePayment(op: Operator, paymentId: string, body: unknown) {
  assertCan(op, "pagamento.estornar");
  if (!uuid.safeParse(paymentId).success) throw new AppError("Pagamento não encontrado.", 404, "NOT_FOUND");
  const { reason } = reasonSchema.parse(body);
  return transaction(async (client) => {
    const updated = await client.query<{ sale_id: string; amount_cents: number; method: string }>(
      `update app.ticket_payments set reversed_at = now(), reversed_by = $2, reverse_reason = $3
        where id = $1 and reversed_at is null returning sale_id, amount_cents, method`,
      [paymentId, op.kind === "user" ? op.actor.id : null, reason]
    );
    const row = updated.rows[0];
    if (!row) throw new AppError("Pagamento não encontrado ou já estornado.", 404, "NOT_FOUND");
    await appendAudit(author(op), {
      category: "Exclusão", action: "Estorno de pagamento de ingressos", module: MODULE, section: SECTION, entityType: "ticket_payment", entityId: paymentId,
      details: `${formatBRL(row.amount_cents)} em ${row.method} · motivo: ${reason}`
    }, client);
    return { ok: true };
  });
}

const dueSchema = z.object({ due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data.") });

export async function setDueDate(op: Operator, saleId: string, body: unknown) {
  assertSaleWrite(op);
  const { due_date } = dueSchema.parse(body);
  if (due_date < todayManaus()) throw new AppError("O vencimento não pode ser antes de hoje.");
  return transaction(async (client) => {
    const sale = await loadSaleFor(op, saleId, client, true);
    if (sale.cancelled_at || sale.balance_cents === 0) throw new AppError("Esta venda não tem valor em aberto.");
    await client.query("update app.ticket_sales set due_date = $2 where id = $1", [saleId, due_date]);
    await appendAudit(author(op), {
      category: "Edição", action: "Vencimento de venda de ingressos alterado", module: MODULE, section: SECTION, entityType: "ticket_sale", entityId: saleId,
      before: { due_date: sale.due_date }, after: { due_date }
    }, client);
    return { ok: true };
  });
}

// ---------- minhas vendas (RF-15) ----------

export async function mySales(op: Operator) {
  const event = await operatorEvent(op);
  const sellerId = await operatorSellerId(op);
  if (!event || !sellerId) return { event: null, sales: [] as SaleView[], totals: { pix_cents: 0, cash_cents: 0, receivable_cents: 0 }, sold: 0, goal: null };
  return { event, ...(await sellerEventSummary(event.id, sellerId)) };
}

export async function sellerEventSummary(eventId: string, sellerId: string, client?: Pick<PoolClient, "query">) {
  const today = todayManaus();
  // Em transação (acerto), as consultas vão em sequência no mesmo cliente.
  const sales = await db(client).query<SaleRow>(`${SALE_SELECT} where v.event_id = $1 and v.seller_id = $2 order by v.created_at desc`, [eventId, sellerId]);
  const money = await db(client).query<{ pix_cents: number; cash_cents: number; settled_cents: number }>(
      `select coalesce(sum(p.amount_cents) filter (where p.method = 'pix'), 0)::int as pix_cents,
              coalesce(sum(p.amount_cents) filter (where p.custody_seller_id = $2), 0)::int as cash_cents,
              (select coalesce(sum(amount_cents), 0) from app.ticket_settlements where event_id = $1 and seller_id = $2)::int as settled_cents
         from app.ticket_payments p join app.ticket_sales v on v.id = p.sale_id
        where v.event_id = $1 and v.seller_id = $2 and v.cancelled_at is null and p.reversed_at is null`, [eventId, sellerId]);
  const goal = await db(client).query<{ goal: number }>("select goal from app.ticket_goals where event_id = $1 and seller_id = $2", [eventId, sellerId]);
  const views = sales.rows.map((row) => saleView(row, today));
  const active = views.filter((s) => !s.cancelled_at);
  const m = money.rows[0];
  return {
    sales: views,
    sold: active.reduce((sum, s) => sum + s.quantity, 0),
    goal: goal.rows[0]?.goal ?? null,
    totals: {
      pix_cents: m.pix_cents,
      cash_cents: Math.max(0, m.cash_cents - m.settled_cents),
      settled_cents: m.settled_cents,
      receivable_cents: active.reduce((sum, s) => sum + s.balance_cents, 0)
    }
  };
}
