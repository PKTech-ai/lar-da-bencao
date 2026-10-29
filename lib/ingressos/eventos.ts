import { z } from "zod";
import { validateSignature } from "@/lib/attachments";
import { appendAudit } from "@/lib/audit";
import { query, transaction } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { MODULE, SECTION, assertCan, author, can, type Operator } from "@/lib/ingressos/acesso";
import { EVENT_SELECT, loadEvent, logoUrl, operatorEvent, type EventRow } from "@/lib/ingressos/dados";
import {
  EVENT_KINDS, PIX_KEY_TYPES, WHATSAPP_ERROR, cnpjDigits, isValidCnpj, normalizePixKey, normalizeWhatsapp, pixKeyError, pixText
} from "@/lib/ingressos/regras";
import { sellerEventSummary, userSellerId } from "@/lib/ingressos/vendas";

/** Organizador (RF-01) e evento (RF-02). */

const uuid = z.string().uuid();
const LOGO_LIMIT = 1_400_000;

export type OrganizerRow = { id: string; name: string; cnpj: string; whatsapp: string | null; has_logo: boolean; logo_version: string | null; version: number };

export async function listOrganizers(op: Operator) {
  assertCan(op, "evento.gerenciar");
  const result = await query<OrganizerRow>(
    `select id, name, cnpj, whatsapp, logo is not null as has_logo, extract(epoch from logo_updated_at)::bigint::text as logo_version, version
       from app.ticket_organizers order by created_at`);
  const organizers = result.rows.map((o) => ({ ...o, logo_url: logoUrl({ organizer_id: o.id, has_logo: o.has_logo, logo_version: o.logo_version }) }));
  if (organizers.length) return { organizers, suggestion: null };
  // Primeiro organizador: pré-preenchido com os dados da instituição.
  const inst = await query<{ name: string; cnpj: string; phone: string }>("select name, cnpj, phone from app.institution_settings where id");
  const row = inst.rows[0];
  return {
    organizers,
    suggestion: row ? { name: row.name, cnpj: isValidCnpj(row.cnpj) ? cnpjDigits(row.cnpj) : "", whatsapp: normalizeWhatsapp(row.phone) ?? "" } : null
  };
}

const organizerSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do organizador.").max(120),
  cnpj: z.string().trim().max(20),
  whatsapp: z.string().trim().max(40).optional().default(""),
  /** data:image/png;base64,... (já reduzida no navegador); "" remove; ausente mantém. */
  logo: z.string().max(LOGO_LIMIT * 1.4 + 100).optional(),
  version: z.number().int().positive().optional()
});

function decodeLogo(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/png|image\/jpeg);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new AppError("A logo deve ser PNG ou JPG.");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > LOGO_LIMIT) throw new AppError("A logo ficou grande demais. Use uma imagem menor.");
  validateSignature(match[1], bytes);
  return { bytes, mime: match[1] };
}

export async function saveOrganizer(op: Operator, body: unknown, id?: string) {
  assertCan(op, "organizador.gerenciar");
  const input = organizerSchema.parse(body);
  if (!isValidCnpj(input.cnpj)) throw new AppError("CNPJ inválido. Confira os números.");
  const whatsapp = input.whatsapp ? normalizeWhatsapp(input.whatsapp) : null;
  if (input.whatsapp && !whatsapp) throw new AppError(WHATSAPP_ERROR);
  const logo = input.logo ? decodeLogo(input.logo) : null;
  const actorId = op.kind === "user" ? op.actor.id : null;
  return transaction(async (client) => {
    let organizerId = id;
    if (id) {
      if (!uuid.safeParse(id).success) throw new AppError("Organizador não encontrado.", 404, "NOT_FOUND");
      const updated = await client.query(
        `update app.ticket_organizers set name=$2, cnpj=$3, whatsapp=$4, updated_at=now(), updated_by=$5, version=version+1,
                logo = case when $6::boolean then $7::bytea else logo end,
                logo_mime = case when $6::boolean then $8 else logo_mime end,
                logo_updated_at = case when $6::boolean then now() else logo_updated_at end
          where id=$1 and ($9::int is null or version=$9)`,
        [id, input.name, cnpjDigits(input.cnpj), whatsapp, actorId, input.logo !== undefined, logo?.bytes ?? null, logo?.mime ?? null, input.version ?? null]);
      if (!updated.rowCount) throw new AppError("Organizador alterado por outra pessoa. Recarregue a página.", 409, "VERSION_CONFLICT");
    } else {
      const created = await client.query<{ id: string }>(
        `insert into app.ticket_organizers (name, cnpj, whatsapp, logo, logo_mime, logo_updated_at, created_by, updated_by)
         values ($1,$2,$3,$4,$5, case when $4::bytea is null then null else now() end, $6, $6) returning id`,
        [input.name, cnpjDigits(input.cnpj), whatsapp, logo?.bytes ?? null, logo?.mime ?? null, actorId]);
      organizerId = created.rows[0].id;
    }
    await appendAudit(author(op), {
      category: id ? "Edição" : "Inclusão", action: id ? "Organizador de evento alterado" : "Organizador de evento cadastrado",
      module: MODULE, section: SECTION, entityType: "ticket_organizer", entityId: organizerId, details: input.name
    }, client);
    return { id: organizerId };
  });
}

export async function organizerLogo(id: string) {
  if (!uuid.safeParse(id).success) return null;
  const result = await query<{ logo: Buffer | null; logo_mime: string | null }>("select logo, logo_mime from app.ticket_organizers where id = $1", [id]);
  const row = result.rows[0];
  return row?.logo && row.logo_mime ? { bytes: row.logo, mime: row.logo_mime } : null;
}

// ---------- eventos ----------

export async function listEvents(op: Operator) {
  if (!can(op, "evento.gerenciar") && !can(op, "caixa.ver")) assertCan(op, "evento.gerenciar");
  const result = await query<EventRow & { sold: number; sales: number }>(
    `${EVENT_SELECT.replace("from app.ticket_events e", `,
         coalesce((select sum(quantity) from app.ticket_sales v where v.event_id = e.id and v.cancelled_at is null), 0)::int as sold,
         (select count(*) from app.ticket_sales v where v.event_id = e.id)::int as sales
       from app.ticket_events e`)}
      order by (e.status = 'active') desc, e.event_date desc`);
  return { events: result.rows };
}

const eventSchema = z.object({
  organizer_id: z.string().uuid("Escolha o organizador."),
  kind: z.enum(EVENT_KINDS, { message: "Escolha o tipo do evento." }),
  name: z.string().trim().min(2, "Informe o nome do evento.").max(60, "Nome com no máximo 60 caracteres."),
  purpose: z.string().trim().min(3, "Informe a finalidade.").max(140, "Finalidade com no máximo 140 caracteres."),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data."),
  event_time: z.string().trim().regex(/^(([01]\d|2[0-3]):[0-5]\d)?$/, "Horário no formato 12:00.").optional().default(""),
  place: z.string().trim().max(80, "Local com no máximo 80 caracteres.").optional().default(""),
  price_cents: z.number().int().positive("Informe o valor do ticket.").max(10_000_000),
  pix_key_type: z.enum(PIX_KEY_TYPES, { message: "Escolha o tipo da chave Pix." }),
  pix_key: z.string().trim().min(1, "Informe a chave Pix.").max(77),
  pix_receiver: z.string().trim().max(60).optional().default(""),
  pix_city: z.string().trim().max(40).optional().default("MANAUS"),
  reservations_whatsapp: z.string().trim().max(40).optional().default(""),
  goal_tickets: z.number().int().min(1).max(100000).nullable().optional(),
  version: z.number().int().positive().optional()
});

export async function saveEvent(op: Operator, body: unknown, id?: string) {
  assertCan(op, "evento.gerenciar");
  const input = eventSchema.parse(body);
  const keyError = pixKeyError(input.pix_key_type, input.pix_key);
  if (keyError) throw new AppError(keyError);
  const organizer = await query<{ name: string; whatsapp: string | null }>("select name, whatsapp from app.ticket_organizers where id = $1", [input.organizer_id]);
  if (!organizer.rows[0]) throw new AppError("Organizador não encontrado.", 404, "NOT_FOUND");
  const reservations = input.reservations_whatsapp ? normalizeWhatsapp(input.reservations_whatsapp) : null;
  if (input.reservations_whatsapp && !reservations) throw new AppError(WHATSAPP_ERROR);
  const receiver = pixText(input.pix_receiver || organizer.rows[0].name, 25) || "RECEBEDOR";
  const city = pixText(input.pix_city || "MANAUS", 15) || "MANAUS";
  const values = [
    input.organizer_id, input.kind, input.name, input.purpose, input.event_date, input.event_time, input.place, input.price_cents,
    input.pix_key_type, input.pix_key_type === "email" || input.pix_key_type === "aleatoria" ? normalizePixKey(input.pix_key_type, input.pix_key) : input.pix_key.trim(),
    receiver, city, reservations, input.goal_tickets ?? null
  ];
  const actorId = op.kind === "user" ? op.actor.id : null;
  return transaction(async (client) => {
    let eventId = id;
    if (id) {
      if (!uuid.safeParse(id).success) throw new AppError("Evento não encontrado.", 404, "NOT_FOUND");
      const updated = await client.query(
        `update app.ticket_events set organizer_id=$2, kind=$3, name=$4, purpose=$5, event_date=$6, event_time=$7, place=$8, price_cents=$9,
                pix_key_type=$10, pix_key=$11, pix_receiver=$12, pix_city=$13, reservations_whatsapp=$14, goal_tickets=$15,
                updated_at=now(), updated_by=$16, version=version+1
          where id=$1 and ($17::int is null or version=$17)`,
        [id, ...values, actorId, input.version ?? null]);
      if (!updated.rowCount) throw new AppError("Evento alterado por outra pessoa. Recarregue a página.", 409, "VERSION_CONFLICT");
    } else {
      const created = await client.query<{ id: string }>(
        `insert into app.ticket_events (organizer_id, kind, name, purpose, event_date, event_time, place, price_cents, pix_key_type, pix_key,
                                        pix_receiver, pix_city, reservations_whatsapp, goal_tickets, created_by, updated_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15) returning id`,
        [...values, actorId]);
      eventId = created.rows[0].id;
    }
    await appendAudit(author(op), {
      category: id ? "Edição" : "Inclusão", action: id ? "Evento de ingressos alterado" : "Evento de ingressos criado",
      module: MODULE, section: SECTION, entityType: "ticket_event", entityId: eventId, details: `${input.name} · ${input.event_date}`, after: { ...input }
    }, client);
    return { id: eventId };
  });
}

const statusSchema = z.object({ action: z.enum(["ativar", "encerrar", "excluir"]) });

export async function changeEventStatus(op: Operator, id: string, body: unknown) {
  assertCan(op, "evento.gerenciar");
  if (!uuid.safeParse(id).success) throw new AppError("Evento não encontrado.", 404, "NOT_FOUND");
  const { action } = statusSchema.parse(body);
  const actorId = op.kind === "user" ? op.actor.id : null;
  return transaction(async (client) => {
    const current = await client.query<{ name: string; status: string; sales: number; accesses: number }>(
      `select name, status, (select count(*) from app.ticket_sales where event_id = e.id)::int as sales,
              (select count(*) from app.ticket_access where event_id = e.id)::int as accesses
         from app.ticket_events e where id = $1 for update`, [id]);
    const event = current.rows[0];
    if (!event) throw new AppError("Evento não encontrado.", 404, "NOT_FOUND");
    if (action === "ativar") {
      // Só um ativo: o anterior volta a rascunho (sem vendas) ou é encerrado (com vendas).
      await client.query(
        `update app.ticket_events e set status = case when exists (select 1 from app.ticket_sales v where v.event_id = e.id) then 'closed' else 'draft' end,
                updated_at = now(), updated_by = $2, version = version + 1
          where e.status = 'active' and e.id <> $1`, [id, actorId]);
      await client.query("update app.ticket_events set status = 'active', updated_at = now(), updated_by = $2, version = version + 1 where id = $1", [id, actorId]);
    } else if (action === "encerrar") {
      await client.query("update app.ticket_events set status = 'closed', updated_at = now(), updated_by = $2, version = version + 1 where id = $1", [id, actorId]);
    } else {
      if (event.sales) throw new AppError("Evento com vendas não pode ser excluído. Use Encerrar.", 409, "HAS_SALES");
      if (event.accesses) throw new AppError("Evento com acessos enviados não pode ser excluído. Use Encerrar.", 409, "HAS_ACCESS");
      await client.query("delete from app.ticket_goals where event_id = $1", [id]);
      await client.query("delete from app.ticket_events where id = $1", [id]);
    }
    await appendAudit(author(op), {
      category: action === "excluir" ? "Exclusão" : "Edição",
      action: action === "ativar" ? "Evento de ingressos ativado" : action === "encerrar" ? "Evento de ingressos encerrado" : "Evento de ingressos excluído",
      module: MODULE, section: SECTION, entityType: "ticket_event", entityId: id, details: event.name
    }, client);
    return { ok: true };
  });
}

export async function eventDetail(op: Operator, id: string) {
  assertCan(op, "evento.gerenciar");
  if (!uuid.safeParse(id).success) throw new AppError("Evento não encontrado.", 404, "NOT_FOUND");
  const event = await loadEvent(id);
  if (!event) throw new AppError("Evento não encontrado.", 404, "NOT_FOUND");
  return { event: { ...event, logo_url: logoUrl(event) } };
}

// ---------- contexto da tela (topo, meta e permissões) ----------

export async function moduleContext(op: Operator) {
  const event = await operatorEvent(op);
  const sellerId = op.kind === "seller" ? op.sellerId : await userSellerId(op.actor);
  const summary = event && sellerId ? await sellerEventSummary(event.id, sellerId) : null;
  const sellers = op.kind === "user" && can(op, "venda.criar") && event
    ? (await query<{ id: string; name: string }>(
        `select s.id, s.name from app.ticket_sellers s where exists (select 1 from app.ticket_goals g where g.event_id = $1 and g.seller_id = s.id)
            or s.id = $2 order by s.name`, [event.id, sellerId])).rows
    : [];
  return {
    mode: op.kind,
    role: op.kind === "user" ? op.role : "trabalhador",
    name: op.kind === "user" ? op.actor.name : op.name,
    event: event ? { ...event, logo_url: logoUrl(event) } : null,
    me: summary ? { sold: summary.sold, goal: summary.goal, totals: summary.totals } : null,
    sellers,
    can: Object.fromEntries((["organizador.gerenciar", "evento.gerenciar", "meta.gerenciar", "acesso.gerenciar", "acerto.registrar", "venda.criar",
      "venda.cancelar", "pagamento.registrar", "pagamento.estornar", "ticket.validar", "ticket.desfazer_entrega", "caixa.ver", "caixa.exportar"] as const)
      .map((p) => [p, can(op, p)]))
  };
}
