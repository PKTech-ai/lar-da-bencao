/**
 * Cadastros declarativos (ondas 2 e 3). Módulo puro: usado pelo servidor (validação, SQL com colunas
 * de lista permitida, auditoria) e pelo navegador (tabela, formulário, impressão).
 */

type Base = { name: string; label: string; required?: boolean; help?: string; wide?: boolean; hideInList?: boolean; readOnly?: boolean };

export type Field =
  | (Base & { type: "text" | "textarea"; max: number; placeholder?: string; unique?: boolean; pattern?: string })
  | (Base & { type: "date"; notFuture?: boolean; notBeforeField?: string })
  | (Base & { type: "month" })
  | (Base & { type: "money"; min?: number })
  | (Base & { type: "integer"; min?: number; max?: number })
  | (Base & { type: "select"; options: readonly string[] })
  | (Base & { type: "multiselect"; options: readonly string[] })
  | (Base & { type: "boolean" })
  | (Base & { type: "department" })
  | (Base & { type: "worker"; department?: string })
  | (Base & { type: "phone" })
  | (Base & { type: "email" });

export type Scope = {
  /** Recurso RBAC (ex.: "department", "tesouraria", "secretaria"). */
  resource: string;
  /** Departamento quando o recurso é escopado (ex.: "patrimonio"). */
  department?: string;
};

export type AttachmentKind = { key: string; label: string; accept: string; mimes: readonly string[] };

export type ResourceDef = {
  /** Identificador na URL (`/api/r/<key>`). */
  key: string;
  /** Tabela no schema app (sem prefixo). */
  table: string;
  title: string;
  singular: string;
  module: string;
  section: string;
  flag: string;
  scope: Scope;
  fields: readonly Field[];
  search: readonly string[];
  orderBy: string;
  filters?: readonly { name: string; label: string }[];
  attachments?: { ownerType: string; kinds: readonly AttachmentKind[]; maxPerRecord: number };
  /** Validador de regras específicas do módulo (lib/resources/rules.ts). */
  rules?: string;
  /** Texto de ajuda exibido acima do formulário. */
  intro?: string;
  /** Arquivar em vez de excluir. Registros arquivados continuam no histórico. */
  archiveLabel?: string;
};

export const IMAGE_MIMES = ["image/jpeg", "image/png"] as const;
export const DOC_MIMES = ["application/pdf", "image/jpeg", "image/png"] as const;

export const PHOTO_KIND = (label = "Foto"): AttachmentKind => ({ key: "photo", label, accept: ".jpg,.jpeg,.png", mimes: IMAGE_MIMES });
export const DOC_KIND = (key: string, label: string): AttachmentKind => ({ key, label, accept: ".pdf,.jpg,.jpeg,.png", mimes: DOC_MIMES });

/** Converte "1.250,00" / "1250,5" / "1250.50" em centavos; lança erro legível. */
export function parseMoney(value: string): number {
  let s = String(value).trim().replace(/^R\$\s*/, "");
  if (!s) throw new Error("Informe um valor.");
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d+(,\d{1,2})?$/.test(s)) s = s.replace(",", ".");
  else if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error("Informe um valor válido, por exemplo 1.250,00.");
  const [int, dec = ""] = s.split(".");
  const cents = Number(int) * 100 + Number(dec.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > 99_999_999_999) throw new Error("Valor fora do limite (até R$ 999.999.999,99).");
  return cents;
}

export function formatMoney(cents: number | string | null | undefined) {
  if (cents === null || cents === undefined || cents === "") return "—";
  return (Number(cents) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function brDate(value: string | null | undefined) {
  return value ? String(value).slice(0, 10).split("-").reverse().join("/") : "—";
}

export function fieldDisplay(field: Field, value: unknown, lookups: { departments?: Map<string, string>; workers?: Map<string, string> } = {}) {
  if (value === null || value === undefined || value === "") return "—";
  switch (field.type) {
    case "money": return formatMoney(value as number);
    case "date": return brDate(String(value));
    case "month": return String(value).split("-").reverse().join("/");
    case "boolean": return value ? "Sim" : "Não";
    case "multiselect": return (value as string[]).join(", ") || "—";
    case "department": return lookups.departments?.get(String(value)) ?? String(value);
    case "worker": return lookups.workers?.get(String(value)) ?? "Trabalhador";
    default: return String(value);
  }
}
