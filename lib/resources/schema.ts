import { z } from "zod";
import type { Field, ResourceDef } from "@/lib/resources/types";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

function fieldSchema(field: Field): z.ZodTypeAny {
  let schema: z.ZodTypeAny;
  switch (field.type) {
    case "text":
    case "textarea": {
      let s = z.string().trim().max(field.max, `${field.label}: até ${field.max} caracteres.`);
      if (field.pattern) s = s.regex(new RegExp(field.pattern), `${field.label}: formato inválido.`);
      schema = s;
      break;
    }
    case "phone": schema = z.string().trim().max(40); break;
    case "email": schema = z.string().trim().max(200).email(`${field.label}: e-mail inválido.`).or(z.literal("")); break;
    case "date": schema = isoDate.or(z.literal("")); break;
    case "month": schema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, `${field.label}: mês inválido.`).or(z.literal("")); break;
    case "money": schema = z.number().int().min(field.min ?? 0).max(99_999_999_999); break;
    case "integer": schema = z.number().int().min(field.min ?? 0).max(field.max ?? 1_000_000); break;
    case "select": schema = z.enum(field.options as [string, ...string[]]).or(z.literal("")); break;
    case "multiselect": schema = z.array(z.enum(field.options as [string, ...string[]])).max(field.options.length); break;
    case "boolean": schema = z.boolean(); break;
    case "department": schema = z.string().regex(/^[a-z_]+$/).or(z.literal("")); break;
    case "worker": schema = z.string().uuid().or(z.literal("")); break;
  }
  if (field.type === "boolean") return schema.default(false);
  if (field.type === "multiselect") return schema.default([]);
  if (field.type === "money" || field.type === "integer") return field.required ? schema : schema.nullable().optional();
  return field.required
    ? schema.refine((v) => v !== "", `${field.label} é obrigatório.`)
    : schema.optional().default("");
}

export function inputSchema(def: ResourceDef) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of def.fields) if (!field.readOnly) shape[field.name] = fieldSchema(field);
  return z.object(shape);
}

/** Valor para o banco: strings vazias viram NULL (exceto texto livre). */
export function toDbValue(field: Field, value: unknown) {
  if (value === undefined) return null;
  if (field.type === "text" || field.type === "textarea") return value ?? "";
  if (value === "") return null;
  return value;
}

export function sqlType(field: Field) {
  switch (field.type) {
    case "date": return "date";
    case "money": return "bigint";
    case "integer": return "integer";
    case "boolean": return "boolean not null default false";
    case "multiselect": return "text[] not null default '{}'";
    case "worker": return "uuid references app.workers(id)";
    case "department": return "text references app.departments(key)";
    case "text":
    case "textarea": return `text not null default '' check (char_length(${field.name}) <= ${field.max})`;
    default: return "text";
  }
}

/** DDL de referência de um cadastro (usado para escrever as migrações e conferido no teste de integração). */
export function resourceDDL(def: ResourceDef) {
  const cols = def.fields.map((f) => `  ${f.name} ${sqlType(f)}${f.required && !["text", "textarea", "boolean", "multiselect"].includes(f.type) ? " not null" : ""},`);
  return `create table if not exists app.${def.table} (
  id uuid primary key default gen_random_uuid(),
${cols.join("\n")}
  archived_at timestamptz,
  archived_by uuid references app.users(id),
  archive_reason text not null default '' check (char_length(archive_reason) <= 500),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id)
);
grant select, insert, update on app.${def.table} to lar_app;`;
}

export function selectList(def: ResourceDef, alias = "r") {
  const cols = def.fields.map((f) => (f.type === "date" ? `to_char(${alias}.${f.name}, 'YYYY-MM-DD') as ${f.name}` : `${alias}.${f.name}`));
  return [`${alias}.id`, ...cols, `${alias}.archived_at`, `${alias}.archive_reason`, `${alias}.version`, `${alias}.created_at`, `${alias}.updated_at`].join(", ");
}
