/**
 * Ingressos — regras puras (sem banco): códigos, dinheiro, situação do pagamento, datas em Manaus,
 * WhatsApp, nomes e mensagens. Usado no servidor e no navegador; testado em regras.test.ts.
 */
import { formatPersonName } from "@/lib/person-name";

export const TZ = "America/Manaus";
/** RF-05: sem B, I, L, O, S, Z, 0, 1, 2, 5, 8 (letras e números que se confundem). */
export const CODE_ALPHABET = "ACDEFGHJKMNPQRTUVWXY34679";
export const MAX_TICKETS_PER_SALE = 20;
export const DEFAULT_DUE_DAYS = 30;
export const DEFAULT_ACCESS_DAYS = 90;
export const UNDO_SECONDS = 120;
export const DEFAULT_DDD = "92";

export const EVENT_KINDS = ["feijoada", "cafe_da_manha", "almoco", "outro"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];
export const EVENT_KIND_LABEL: Record<EventKind, string> = { feijoada: "Feijoada", cafe_da_manha: "Café da manhã", almoco: "Almoço", outro: "Outro" };
export const EVENT_NAME_SUGGESTION: Record<EventKind, string> = {
  feijoada: "Feijoada Solidária", cafe_da_manha: "Café da Manhã Solidário", almoco: "Almoço Solidário", outro: ""
};
export const EVENT_STATUS_LABEL = { draft: "Rascunho", active: "Ativo", closed: "Encerrado" } as const;
export type EventStatus = keyof typeof EVENT_STATUS_LABEL;

/** O que cada ticket vale, com artigo: "a feijoada", "um café da manhã". */
const MEAL: Record<EventKind, { noun: string; feminine: boolean }> = {
  feijoada: { noun: "feijoada", feminine: true },
  cafe_da_manha: { noun: "café da manhã", feminine: false },
  almoco: { noun: "refeição", feminine: true },
  outro: { noun: "entrada", feminine: true }
};
export const mealWithArticle = (kind: EventKind, definite: boolean) =>
  `${definite ? (MEAL[kind].feminine ? "a" : "o") : MEAL[kind].feminine ? "uma" : "um"} ${MEAL[kind].noun}`;

export const PIX_KEY_TYPES = ["cnpj", "cpf", "email", "telefone", "aleatoria"] as const;
export type PixKeyType = (typeof PIX_KEY_TYPES)[number];
export const PIX_KEY_LABEL: Record<PixKeyType, string> = { cnpj: "CNPJ", cpf: "CPF", email: "e-mail", telefone: "telefone", aleatoria: "chave aleatória" };

export const PAYMENT_METHODS = ["pix", "dinheiro"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = { pix: "Pix", dinheiro: "Dinheiro" };

// ---------- dinheiro (RN-08: centavos inteiros) ----------

export function formatBRL(cents: number) {
  const negative = cents < 0;
  const abs = Math.abs(Math.trunc(cents));
  const reais = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}R$ ${reais},${String(abs % 100).padStart(2, "0")}`;
}

/** "30", "30,5", "R$ 1.234,56" → centavos. Inválido → null. */
export function parseBRL(value: string): number | null {
  const clean = value.replace(/R\$|\s/g, "").replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const [int, frac = ""] = clean.split(".");
  return Number(int) * 100 + Number(frac.padEnd(2, "0"));
}

// ---------- datas (RN-09: America/Manaus) ----------

export function todayManaus(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now);
}

export function addDays(isoDate: string, days: number) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string) {
  const parse = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((parse(toIso) - parse(fromIso)) / 86_400_000);
}

/** 2026-11-15 → "15/11"; com ano: "15/11/2026". */
export function shortDate(iso: string, withYear = false) {
  const [y, m, d] = iso.split("-");
  return withYear ? `${d}/${m}/${y}` : `${d}/${m}`;
}

const WEEKDAYS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
export function weekday(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** Hora e data de um instante, no fuso de Manaus: { date: "15/11", time: "12:14" }. */
export function manausDateTime(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${get("day")}/${get("month")}`, fullDate: `${get("day")}/${get("month")}/${get("year")}`, time: `${get("hour")}:${get("minute")}` };
}

// ---------- pagamento (RN-03, RN-04) ----------

export type PaymentStatus = "pago" | "vencido" | "parcial" | "a_pagar";
export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = { pago: "Pago", vencido: "Vencido", parcial: "Parcial", a_pagar: "A pagar" };

export function balanceCents(totalCents: number, paidCents: number) {
  return Math.max(0, totalCents - paidCents);
}

export function paymentStatus(input: { totalCents: number; paidCents: number; dueDate: string | null; today: string }): PaymentStatus {
  const balance = balanceCents(input.totalCents, input.paidCents);
  if (balance === 0) return "pago";
  if (input.dueDate && input.dueDate < input.today) return "vencido";
  if (input.paidCents > 0) return "parcial";
  return "a_pagar";
}

/** "vencido há 3 dias", "vence hoje", "vence 28/11". */
export function dueLabel(dueDate: string, today: string) {
  const diff = daysBetween(today, dueDate);
  if (diff < 0) return `vencido há ${-diff} ${diff === -1 ? "dia" : "dias"}`;
  if (diff === 0) return "vence hoje";
  return `vence ${shortDate(dueDate)}`;
}

/** RF-13: cobrança do dinheiro que ficou com o trabalhador. */
export function inHandsCents(cashWithSellerCents: number, settledCents: number) {
  return Math.max(0, cashWithSellerCents - settledCents);
}

// ---------- WhatsApp, nome e CNPJ ----------

export const WHATSAPP_ERROR = "Confira o WhatsApp: são 9 números depois do (92).";
export const NAME_ERROR = "Escreva o nome e o sobrenome. Ex.: Rosa Lima.";

/**
 * DDD + número (com ou sem 55, com ou sem máscara) → "55" + 10/11 dígitos. Celular: 9 dígitos começando por 9;
 * fixo (8 dígitos) só se não começar por 9. Inválido → null.
 */
export function normalizeWhatsapp(value: string): string | null {
  let digits = value.replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
  if (!/^[1-9][0-9]/.test(digits)) return null;
  const local = digits.slice(2);
  if (local.length === 9 && local.startsWith("9")) return `55${digits}`;
  if (local.length === 8 && !local.startsWith("9")) return `55${digits}`;
  return null;
}

/** "5592991234567" → "(92) 99123-4567". */
export function formatWhatsapp(value: string | null | undefined) {
  if (!value) return "";
  const digits = value.startsWith("55") ? value.slice(2) : value;
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  return rest.length === 9 ? `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}` : `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
}

/** RF-17: nome e sobrenome (duas palavras ou mais; "Dona Rosa" vale). */
export function normalizeBuyerName(value: string): string | null {
  const name = formatPersonName(value.replace(/[^\p{L}\p{M}' .-]/gu, " "));
  const words = name.split(" ").filter((w) => /\p{L}/u.test(w));
  if (words.length < 2 || name.length > 120 || words.some((w) => w.replace(/[^\p{L}]/gu, "").length < 1)) return null;
  return name;
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

export function cnpjDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function isValidCnpj(value: string) {
  const digits = cnpjDigits(value);
  if (!/^\d{14}$/.test(digits) || /^(\d)\1{13}$/.test(digits)) return false;
  const calc = (length: number) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + Number(digits[i]) * w, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return calc(12) === Number(digits[12]) && calc(13) === Number(digits[13]);
}

export function formatCnpj(value: string) {
  const d = cnpjDigits(value);
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : value;
}

// ---------- códigos e tokens ----------

/** Código curto de 4 caracteres a partir de bytes aleatórios (sem viés: descarta bytes ≥ 250). */
export function codeFromBytes(bytes: Uint8Array): string | null {
  const size = CODE_ALPHABET.length;
  const limit = 256 - (256 % size);
  let code = "";
  for (const byte of bytes) {
    if (byte >= limit) continue;
    code += CODE_ALPHABET[byte % size];
    if (code.length === 4) return code;
  }
  return null;
}

/** Normaliza o que a pessoa digitou na tela Validar (minúsculas, O→0 não existe no alfabeto etc.). */
export function normalizeTypedCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export const QR_PREFIX = "TKT:";
export function ticketTokenFromQr(text: string) {
  const value = text.trim();
  return value.startsWith(QR_PREFIX) ? value.slice(QR_PREFIX.length) : null;
}

// ---------- acesso do trabalhador (RF-12) ----------

export type AccessState = "nao_enviado" | "enviado" | "ativo" | "expirado" | "bloqueado";
export const ACCESS_STATE_LABEL: Record<AccessState, string> = {
  nao_enviado: "Não enviado", enviado: "Enviado", ativo: "Ativo", expirado: "Expirado", bloqueado: "Bloqueado"
};

export function accessState(access: { valid_until: string; first_access_at: string | null; revoked_at: string | null; revoke_reason: string | null } | null, today: string): AccessState {
  if (!access) return "nao_enviado";
  if (access.revoked_at) return "bloqueado";
  if (access.valid_until < today) return "expirado";
  return access.first_access_at ? "ativo" : "enviado";
}

// ---------- mensagens do WhatsApp (seção 10) ----------

export type EventForMessage = {
  name: string; kind: EventKind; event_date: string; event_time: string; purpose: string;
  organizer_name: string; pix_key_type: PixKeyType; pix_key: string;
};

const whenText = (event: EventForMessage) =>
  `${weekday(event.event_date)}, ${shortDate(event.event_date)}${event.event_time ? `, às ${event.event_time}` : ""}`;

export function ticketsMessage(input: {
  event: EventForMessage; buyerName: string; codes: string[]; link: string;
  balanceCents: number; dueDate: string | null;
}) {
  const { event, codes } = input;
  const n = codes.length;
  const head = n === 1
    ? `Olá, ${firstName(input.buyerName)}! Seu ingresso para a *${event.name}* do ${event.organizer_name} (${whenText(event)}):`
    : `Olá, ${firstName(input.buyerName)}! Seus ${n} ingressos para a *${event.name}* do ${event.organizer_name} (${whenText(event)}):`;
  const lines = [
    head,
    "",
    ...codes.map((code, i) => `Ticket ${i + 1}: *${code}*`),
    "",
    `Veja ${n === 1 ? "o ingresso" : "os ingressos"} com QR code: ${input.link}`,
    "",
    `É só mostrar na hora de retirar ${mealWithArticle(event.kind, true)}.`,
    `Renda revertida para: ${event.purpose}.`
  ];
  if (input.balanceCents > 0) {
    lines.push("", `Valor em aberto: ${formatBRL(input.balanceCents)}${input.dueDate ? `, com vencimento em ${shortDate(input.dueDate, true)}` : ""}.`,
      `Pix (${PIX_KEY_LABEL[event.pix_key_type]}): ${event.pix_key}`);
  }
  return lines.join("\n");
}

export function chargeMessage(input: { event: EventForMessage; buyerName: string; quantity: number; balanceCents: number; dueDate: string | null }) {
  return [
    `Olá, ${firstName(input.buyerName)}! Tudo bem? Passando para lembrar do valor de ${formatBRL(input.balanceCents)} referente ${input.quantity === 1 ? "ao ticket" : `aos ${input.quantity} tickets`} da ${input.event.name}${input.dueDate ? `, com vencimento em ${shortDate(input.dueDate, true)}` : ""}.`,
    "",
    `Pix (${PIX_KEY_LABEL[input.event.pix_key_type]}): ${input.event.pix_key}`,
    "",
    "Assim que pagar, é só mandar o comprovante por aqui. Obrigado!"
  ].join("\n");
}

export function inviteMessage(input: { sellerName: string; eventName: string; organizerName: string; goal: number | null; link: string; validUntil: string }) {
  return [
    `Olá, ${firstName(input.sellerName)}! Você foi convidado(a) para vender ingressos da *${input.eventName}* do ${input.organizerName}.`,
    "",
    ...(input.goal ? [`Sua meta: *${input.goal} ingressos*.`] : []),
    `Seu acesso: ${input.link}`,
    "",
    `No primeiro acesso, crie um PIN de 4 números. O acesso vale até ${shortDate(input.validUntil, true)}.`,
    "Obrigado por ajudar!"
  ].join("\n");
}

export function reminderMessage(input: { sellerName: string; eventName: string; sold: number; goal: number }) {
  return `Olá, ${firstName(input.sellerName)}! Passando para lembrar da venda de ingressos da *${input.eventName}*. Você está com ${input.sold} de ${input.goal}. Para vender, use o link de acesso que você recebeu. Se não encontrar, me avise que eu reenvio.`;
}

export function waLink(whatsapp: string, text: string) {
  return `https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

// ---------- Pix estático (seção 11, BR Code sem valor) ----------

const stripAccents = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "");
const emv = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

export function crc16(payload: string) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function normalizePixKey(type: PixKeyType, key: string) {
  const value = key.trim();
  if (type === "cnpj" || type === "cpf") return value.replace(/\D/g, "");
  if (type === "email") return value.toLowerCase();
  if (type === "telefone") {
    const digits = value.replace(/\D/g, "");
    return `+${digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`}`;
  }
  return value;
}

/** Valida a chave conforme o tipo; devolve a mensagem de erro ou null. */
export function pixKeyError(type: PixKeyType, key: string) {
  const value = normalizePixKey(type, key);
  if (type === "cnpj" && !isValidCnpj(value)) return "CNPJ da chave Pix inválido.";
  if (type === "cpf" && !/^\d{11}$/.test(value)) return "CPF da chave Pix inválido.";
  if (type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "E-mail da chave Pix inválido.";
  if (type === "telefone" && !/^\+55\d{10,11}$/.test(value)) return "Telefone da chave Pix inválido.";
  if (type === "aleatoria" && !/^[0-9a-f-]{32,36}$/i.test(value)) return "Chave aleatória inválida.";
  return null;
}

export const pixText = (value: string, max: number) => stripAccents(value).toUpperCase().replace(/[^A-Z0-9 ]/g, "").trim().slice(0, max);

export function pixPayload(input: { keyType: PixKeyType; key: string; receiver: string; city: string }) {
  const account = emv("00", "BR.GOV.BCB.PIX") + emv("01", normalizePixKey(input.keyType, input.key));
  const body = emv("00", "01") + emv("26", account) + emv("52", "0000") + emv("53", "986") + emv("58", "BR")
    + emv("59", pixText(input.receiver, 25)) + emv("60", pixText(input.city, 15)) + emv("62", emv("05", "***")) + "6304";
  return body + crc16(body);
}
