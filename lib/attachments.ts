import { createHash, randomBytes } from "node:crypto";
import { inflateSync } from "node:zlib";
import type { Actor } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { authorizeServiceOrderFiles } from "@/lib/ordens-servico";
import { SECTOR_ROLE_RESOURCE } from "@/lib/module-pages";
import { assertModule, assertPermission } from "@/lib/permissions";

export const CHUNK_SIZE = 3 * 1024 * 1024;
export const COMMON_FILE_LIMIT = 15 * 1024 * 1024;
export const BANK_FILE_LIMIT = 20 * 1024 * 1024;

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const allowedMimeTypes = [
  "application/pdf", "image/jpeg", "image/png", "audio/webm", "audio/ogg", "text/csv", "application/x-ofx", DOCX_MIME
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
    : mime === DOCX_MIME ? starts(0x50, 0x4b, 0x03, 0x04)
    : mime === "application/x-ofx" ? /^(OFXHEADER:|<\?OFX|<OFX)/i.test(text)
    : mime === "text/csv" ? !bytes.slice(0, 256).includes(0)
    : false;
  if (!valid) throw new AppError("O conteúdo não corresponde ao tipo de arquivo informado.", 415, "INVALID_FILE_SIGNATURE");
}

/** Tipos que o próprio sistema confere quando o antivírus externo não responde (política temporária, docs/DEPLOY.md). */
export const INTERNAL_CHECK_MIME_TYPES = ["image/jpeg", "image/png"] as const;
export const INTERNAL_CHECK_ENGINE = "conferencia-interna";

/**
 * Conferência interna de foto: início e fim do arquivo precisam ser de uma imagem JPG/PNG completa.
 * A imagem só é servida com o próprio tipo e `nosniff`, então não roda como página nem como programa.
 */
export function verifyImageStructure(mime: string, bytes: Uint8Array) {
  validateSignature(mime, bytes);
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0x00) end -= 1; // algumas câmeras completam o arquivo com zeros
  const tail = (...values: number[]) => end >= values.length && values.every((value, index) => bytes[end - values.length + index] === value);
  const complete = mime === "image/jpeg" ? tail(0xff, 0xd9)
    : mime === "image/png" ? tail(0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82)
    : false;
  if (!complete) throw new AppError("Esta imagem está incompleta ou não é uma foto JPG/PNG. Tire outra foto ou escolha outra imagem.", 415, "INVALID_FILE_SIGNATURE");
}

/** PDFs que passam pela conferência interna quando o antivírus não responde: só material das Bibliotecas de Estudos. */
export function internalPdfCheckAllowed(ownerType: string, mime: string) {
  return mime === "application/pdf" && ownerType.startsWith("study_material_");
}

/** Nomes de PDF que executam algo, embutem arquivos, enviam dados ou escondem o conteúdo da conferência. */
const PDF_BLOCKED_NAMES = new Set([
  "JavaScript", "JS", "Launch", "EmbeddedFile", "EmbeddedFiles", "RichMedia", "XFA", "SubmitForm", "ImportData", "GoToE", "Encrypt"
]);
const PDF_NAME = /\/([^\s/[\]<>(){}%]+)/g;
const PDF_STREAM = />>\s*stream\r?\n/g;

/** `/J#61vaScript` é o mesmo nome que `/JavaScript`. */
const decodePdfNames = (text: string) => text.replace(/#([0-9a-fA-F]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));

function blockedPdfName(text: string) {
  for (const [, raw] of text.matchAll(PDF_NAME)) {
    const name = decodePdfNames(raw);
    if (PDF_BLOCKED_NAMES.has(name)) return name;
  }
  return null;
}

/**
 * Conferência interna de PDF (antivírus fora do ar): arquivo PDF completo, sem JavaScript, ação de abrir programa,
 * arquivo embutido, formulário que envia dados nem criptografia. Os dicionários guardados em fluxos de objetos
 * (/ObjStm) são descompactados e conferidos também; um fluxo de objetos ilegível recusa o arquivo.
 */
export function verifyPdfStructure(bytes: Uint8Array) {
  validateSignature("application/pdf", bytes);
  const text = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("latin1");
  const refuse = (detail: string): never => {
    throw new AppError(`Este PDF não passou na conferência interna (${detail}). Salve o arquivo de novo como PDF simples e tente outra vez.`, 415, "PDF_INTERNAL_CHECK_FAILED");
  };
  if (!text.slice(-1024).includes("%%EOF")) refuse("arquivo incompleto");
  const visible: string[] = [];
  let cursor = 0;
  for (const match of text.matchAll(PDF_STREAM)) {
    const start = match.index! + match[0].length;
    if (start < cursor) continue;
    const end = text.indexOf("endstream", start);
    if (end < 0) refuse("fluxo sem fim");
    const header = text.slice(cursor, start);
    visible.push(header);
    const dictionary = decodePdfNames(header.slice(Math.max(0, header.lastIndexOf("obj"))));
    if (/\/Type\s*\/ObjStm\b/.test(dictionary)) {
      if (!/\/Filter\s*\[?\s*\/FlateDecode\s*\]?/.test(dictionary)) refuse("fluxo de objetos sem compressão conhecida");
      try {
        visible.push(inflateSync(Buffer.from(text.slice(start, end).replace(/\r?\n$/, ""), "latin1")).toString("latin1"));
      } catch {
        refuse("fluxo de objetos ilegível");
      }
    }
    cursor = end + "endstream".length;
  }
  visible.push(text.slice(cursor));
  const blocked = blockedPdfName(visible.join("\n"));
  if (blocked) refuse(`contém /${blocked}`);
}

export function attachmentPermission(ownerType: string) {
  // Vínculos de negócio seguem a permissão da página dona (baixar = ler). `attachments` fica para testes técnicos.
  const mappings: Record<string, { resource: string; department?: string }> = {
    treasury_proof: { resource: "tesouraria" },
    bank_statement: { resource: "tesouraria" },
    patrimony_asset: { resource: "department", department: "patrimonio" },
    social_record: { resource: "department", department: "assistencia_social" },
    social_brecho_proof: { resource: "social_brecho" },
    social_clube_maes_proof: { resource: "social_clube_maes" },
    meeting_audio: { resource: "secretaria" },
    meeting_document: { resource: "secretaria" },
    legal_document: { resource: "department", department: "juridico" },
    event_record: { resource: "department", department: "eventos" },
    bookshop_proof: { resource: "department", department: "divulgacao" },
    fiscal_council_document: { resource: "conselho_fiscal" },
    institutional_document: { resource: "institucional" },
    study_material_doutrina: { resource: "department", department: "doutrina" },
    study_material_infancia: { resource: "department", department: "infancia" },
    study_material_juventude: { resource: "department", department: "juventude" },
    evangelizando_photo_infancia: { resource: "department", department: "infancia" },
    evangelizando_photo_juventude: { resource: "department", department: "juventude" },
    // Fotos da OS: o departamento depende da OS (ver authorizeAttachment).
    service_order: { resource: "department" },
    system_test: { resource: "attachments" }
  };
  const mapping = mappings[ownerType];
  if (!mapping) throw new AppError("Tipo de vínculo de anexo não permitido.");
  return mapping;
}

/** Módulos de Usuários › Acesso que abrem cada tipo de anexo. */
const ATTACHMENT_MODULES: Readonly<Record<string, { department: string; modules: readonly string[] }>> = {
  treasury_proof: { department: "tesouraria", modules: ["lancamentos", "doacoes"] },
  bank_statement: { department: "tesouraria", modules: ["extrato"] },
  patrimony_asset: { department: "patrimonio", modules: ["bens"] },
  social_record: { department: "assistencia_social", modules: ["rancho"] },
  social_brecho_proof: { department: "assistencia_social", modules: ["brecho"] },
  social_clube_maes_proof: { department: "assistencia_social", modules: ["clube-maes"] },
  meeting_audio: { department: "secretaria", modules: ["gravador"] },
  meeting_document: { department: "secretaria", modules: ["reunioes"] },
  legal_document: { department: "juridico", modules: ["eleicoes"] },
  event_record: { department: "eventos", modules: ["agenda"] },
  bookshop_proof: { department: "divulgacao", modules: ["vendas"] },
  fiscal_council_document: { department: "conselho_fiscal", modules: ["analises"] },
  study_material_doutrina: { department: "doutrina", modules: ["estudos"] },
  study_material_infancia: { department: "infancia", modules: ["estudos"] },
  study_material_juventude: { department: "juventude", modules: ["estudos"] },
  evangelizando_photo_infancia: { department: "infancia", modules: ["evangelizandos"] },
  evangelizando_photo_juventude: { department: "juventude", modules: ["evangelizandos"] }
};

export async function authorizeAttachment(actor: Actor, ownerType: string, action: "read" | "create" | "update" | "delete" | "download", ownerId?: string) {
  const permission = attachmentPermission(ownerType);
  if (ownerType === "service_order") {
    const department = await authorizeServiceOrderFiles(actor, ownerId ?? "", action === "read" || action === "download" ? "read" : "write");
    return { ...permission, department };
  }
  // Vínculos de negócio usam a permissão do próprio recurso: baixar = ler.
  const effective = permission.resource !== "attachments" && action === "download" ? "read" : action;
  const home = ATTACHMENT_MODULES[ownerType];
  if (home && SECTOR_ROLE_RESOURCE[actor.role] !== permission.resource) {
    await assertModule(actor, home.department, home.modules, effective);
    return permission;
  }
  await assertPermission(actor, permission.resource, effective, permission.department);
  return permission;
}
