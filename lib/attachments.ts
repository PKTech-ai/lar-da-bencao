import { createHash, randomBytes } from "node:crypto";
import type { Actor } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { assertPermission } from "@/lib/permissions";

export const CHUNK_SIZE = 3 * 1024 * 1024;
export const COMMON_FILE_LIMIT = 15 * 1024 * 1024;
export const BANK_FILE_LIMIT = 20 * 1024 * 1024;

export const allowedMimeTypes = [
  "application/pdf", "image/jpeg", "image/png", "audio/webm", "audio/ogg", "text/csv", "application/x-ofx"
] as const;

export function sha256(data: Uint8Array | string) {
  return createHash("sha256").update(data).digest("hex");
}

/** Hash do token de upload calculado na aplicação (independe do search_path/pgcrypto da sessão). */
export function uploadTokenHash(token: string) {
  return createHash("sha256").update(token).digest();
}

export function newUploadToken() {
  return randomBytes(32).toString("base64url");
}

export function safeFilename(value: string) {
  const name = value.normalize("NFKC").replace(/[\u0000-\u001f<>:"/\\|?*]/g, "_").replace(/\s+/g, " ").trim();
  if (!name || name.length > 240 || name === "." || name === "..") throw new AppError("Nome de arquivo inválido.");
  return name;
}

export function validateSignature(mime: string, bytes: Uint8Array) {
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  const text = new TextDecoder().decode(bytes.slice(0, 256)).trimStart();
  const valid = mime === "application/pdf" ? starts(0x25, 0x50, 0x44, 0x46, 0x2d)
    : mime === "image/png" ? starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
    : mime === "image/jpeg" ? starts(0xff, 0xd8, 0xff)
    : mime === "audio/ogg" ? starts(0x4f, 0x67, 0x67, 0x53)
    : mime === "audio/webm" ? starts(0x1a, 0x45, 0xdf, 0xa3)
    : mime === "application/x-ofx" ? /^(OFXHEADER:|<\?OFX|<OFX)/i.test(text)
    : mime === "text/csv" ? !bytes.slice(0, 256).includes(0)
    : false;
  if (!valid) throw new AppError("O conteúdo não corresponde ao tipo de arquivo informado.", 415, "INVALID_FILE_SIGNATURE");
}

export function attachmentPermission(ownerType: string) {
  const mappings: Record<string, { resource: string; department?: string }> = {
    treasury_proof: { resource: "attachments", department: "tesouraria" },
    bank_statement: { resource: "attachments", department: "tesouraria" },
    patrimony_asset: { resource: "attachments", department: "patrimonio" },
    social_record: { resource: "attachments", department: "assistencia_social" },
    meeting_audio: { resource: "attachments", department: "secretaria" },
    legal_document: { resource: "attachments", department: "juridico" },
    // Estatuto/Regimento: leitura para todos os trabalhadores ativos; envio só pelo administrador.
    institutional_document: { resource: "institucional" },
    // Materiais de estudo seguem a permissão do departamento: quem lê o departamento baixa o material.
    study_material_doutrina: { resource: "department", department: "doutrina" },
    study_material_infancia: { resource: "department", department: "infancia" },
    study_material_juventude: { resource: "department", department: "juventude" },
    evangelizando_photo_infancia: { resource: "department", department: "infancia" },
    evangelizando_photo_juventude: { resource: "department", department: "juventude" },
    system_test: { resource: "attachments" }
  };
  const mapping = mappings[ownerType];
  if (!mapping) throw new AppError("Tipo de vínculo de anexo não permitido.");
  return mapping;
}

export async function authorizeAttachment(actor: Actor, ownerType: string, action: "read" | "create" | "update" | "delete" | "download") {
  const permission = attachmentPermission(ownerType);
  // Vínculos de negócio usam a permissão do próprio recurso: baixar = ler.
  const effective = permission.resource !== "attachments" && action === "download" ? "read" : action;
  await assertPermission(actor, permission.resource, effective, permission.department);
  return permission;
}
