import { z } from "zod";
import type { Actor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { query, transaction } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireFlag } from "@/lib/feature-flags";
import { assertPermission } from "@/lib/permissions";

export const WHATSAPP_FLAG = "module_whatsapp";

/** Módulos que podem usar a fila, com o recurso de permissão de cada um. */
export const WHATSAPP_SCOPES: Record<string, { resource: string; department?: string; label: string }> = {
  tesouraria: { resource: "tesouraria", label: "Tesouraria" },
  doutrina: { resource: "department", department: "doutrina", label: "Doutrina" }
};

export const onlyDigits = (phone: string) => phone.replace(/\D/g, "");

/** Número brasileiro com DDD (10 ou 11 dígitos), com ou sem o 55. */
export function normalizePhone(phone: string) {
  const digits = onlyDigits(phone);
  const national = digits.startsWith("55") ? digits.slice(2) : digits;
  if (national.length < 10 || national.length > 11) throw new AppError("Confira o número de WhatsApp com DDD.");
  return `55${national}`;
}

const queueSchema = z.object({
  scope: z.enum(["tesouraria", "doutrina"]),
  recipient_name: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(8).max(40),
  body: z.string().trim().min(5).max(1000),
  consent: z.literal(true, { message: "Registre o consentimento da pessoa antes de enviar." }),
  consent_source: z.string().trim().min(3, "Diga como o consentimento foi obtido.").max(200)
});

export async function requireWhatsapp(actor: Actor, scope: string, action: "read" | "create" | "update") {
  const config = WHATSAPP_SCOPES[scope];
  if (!config) throw new AppError("Módulo sem fila de mensagens.", 404, "NOT_FOUND");
  await requireFlag(WHATSAPP_FLAG);
  await assertPermission(actor, config.resource, action, config.department);
  return config;
}

export async function listMessages(scope: string) {
  const result = await query(
    `select m.id, m.scope, m.recipient_name, m.phone, m.body, m.consent_source, m.status, m.created_at,
            m.sent_at, u.full_name as created_by_name, s.full_name as sent_by_name, m.cancel_reason
       from app.whatsapp_messages m
       left join app.users u on u.id = m.created_by
       left join app.users s on s.id = m.sent_by
      where m.scope = $1 order by m.created_at desc limit 300`,
    [scope]
  );
  return result.rows;
}

/** Cria a mensagem na fila. O envio continua manual: o sistema não fala com a operadora. */
export async function queueMessage(actor: Actor, body: unknown) {
  const input = queueSchema.parse(body);
  const phone = normalizePhone(input.phone);
  return transaction(async (client) => {
    const inserted = await client.query<{ id: string }>(
      `insert into app.whatsapp_messages (scope, recipient_name, phone, body, consent_source, created_by)
       values ($1,$2,$3,$4,$5,$6) returning id`,
      [input.scope, input.recipient_name, phone, input.body, input.consent_source, actor.id]
    );
    await appendAudit(actor, {
      category: "Inclusão", action: "Mensagem de WhatsApp na fila", module: WHATSAPP_SCOPES[input.scope].label, section: "WhatsApp",
      entityType: "whatsapp", entityId: inserted.rows[0].id,
      details: `${input.recipient_name} · consentimento: ${input.consent_source}`,
      metadata: { phoneMasked: `***${phone.slice(-4)}` }
    }, client);
    return { id: inserted.rows[0].id, phone };
  });
}

const decisionSchema = z.object({ action: z.enum(["sent", "cancel"]), reason: z.string().trim().max(500).optional().default("") });

export async function decideMessage(actor: Actor, id: string, body: unknown) {
  const input = decisionSchema.parse(body);
  return transaction(async (client) => {
    const found = await client.query<{ id: string; scope: string; status: string; recipient_name: string; phone: string }>(
      "select id, scope, status, recipient_name, phone from app.whatsapp_messages where id = $1 for update",
      [id]
    );
    const row = found.rows[0];
    if (!row) throw new AppError("Mensagem não encontrada.", 404, "NOT_FOUND");
    if (row.status !== "Na fila") throw new AppError("Esta mensagem já saiu da fila.", 409, "ALREADY_DECIDED");
    if (input.action === "cancel" && input.reason.trim().length < 3) throw new AppError("Informe o motivo do cancelamento.");
    await client.query(
      `update app.whatsapp_messages set status = $2, sent_by = case when $2 = 'Enviada' then $3::uuid else null end,
              sent_at = case when $2 = 'Enviada' then now() else null end, cancel_reason = $4, version = version + 1 where id = $1`,
      [id, input.action === "sent" ? "Enviada" : "Cancelada", actor.id, input.action === "cancel" ? input.reason : ""]
    );
    await appendAudit(actor, {
      category: "Edição", action: input.action === "sent" ? "Mensagem de WhatsApp enviada" : "Mensagem de WhatsApp cancelada",
      module: WHATSAPP_SCOPES[row.scope]?.label ?? "Sistema", section: "WhatsApp", entityType: "whatsapp", entityId: id,
      details: `${row.recipient_name}${input.reason ? ` · ${input.reason}` : ""}`,
      metadata: { phoneMasked: `***${row.phone.slice(-4)}` }
    }, client);
  });
}
