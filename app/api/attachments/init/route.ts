import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { allowedMimeTypes, authorizeAttachment, BANK_FILE_LIMIT, CHUNK_SIZE, COMMON_FILE_LIMIT, newUploadToken, safeFilename, uploadTokenHash } from "@/lib/attachments";
import { dbPool } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/csrf";

export const runtime = "nodejs";

const schema = z.object({
  ownerType: z.string().regex(/^[a-z_]+$/), ownerId: z.string().trim().min(1).max(160),
  filename: z.string().min(1).max(240), mimeType: z.enum(allowedMimeTypes),
  sizeBytes: z.number().int().positive().max(BANK_FILE_LIMIT), sha256: z.string().regex(/^[a-f0-9]{64}$/),
  kind: z.string().regex(/^[a-z_]{1,40}$/).optional()
});

export async function POST(request: Request) {
  let actor = null;
  try {
    assertSameOrigin(request);
    actor = await requireActor();
    const input = schema.parse(await request.json());
    const permission = await authorizeAttachment(actor, input.ownerType, "create");
    const limit = input.ownerType === "bank_statement" ? BANK_FILE_LIMIT : COMMON_FILE_LIMIT;
    if (input.sizeBytes > limit) throw new AppError(`O arquivo ultrapassa o limite de ${limit / 1024 / 1024} MB.`, 413, "FILE_TOO_LARGE");
    const chunkCount = Math.ceil(input.sizeBytes / CHUNK_SIZE);
    const token = newUploadToken();
    const result = await dbPool().query<{ id: string }>(
      `insert into app.attachments
       (owner_type,owner_id,department_key,filename,mime_type,size_bytes,sha256,chunk_count,upload_token_hash,uploaded_by,kind)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       returning id`,
      [input.ownerType, input.ownerId, permission.department ?? null, safeFilename(input.filename), input.mimeType, input.sizeBytes, input.sha256, chunkCount, uploadTokenHash(token), actor.id, input.kind ?? null]
    );
    const id = result.rows[0].id;
    await appendAudit(actor, { category: "Inclusão", action: "Início de upload de anexo", module: "Anexos", section: input.ownerType, entityType: "attachment", entityId: id, result: "success", details: `${safeFilename(input.filename)} · ${input.sizeBytes} bytes · ${chunkCount} parte(s).` });
    return Response.json({ id, token, chunkSize: CHUNK_SIZE, chunkCount }, { status: 201 });
  } catch (error) {
    if (actor) await appendAudit(actor, { category: "Segurança", action: "Falha ao iniciar upload", module: "Anexos", result: "failed", reasonCode: error instanceof AppError ? error.code : "INTERNAL_ERROR" }).catch(console.error);
    return errorResponse(error);
  }
}
