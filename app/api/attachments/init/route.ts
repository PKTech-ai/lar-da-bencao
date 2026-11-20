import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { allowedMimeTypes, authorizeAttachment, BANK_FILE_LIMIT, CHUNK_SIZE, COMMON_FILE_LIMIT, newUploadToken, safeFilename, uploadTokenHash } from "@/lib/attachments";
import { transaction } from "@/lib/db";
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
    const permission = await authorizeAttachment(actor, input.ownerType, "create", input.ownerId);
    const limit = input.ownerType === "bank_statement" ? BANK_FILE_LIMIT : COMMON_FILE_LIMIT;
    if (input.sizeBytes > limit) throw new AppError(`O arquivo ultrapassa o limite de ${limit / 1024 / 1024} MB.`, 413, "FILE_TOO_LARGE");
    const chunkCount = Math.ceil(input.sizeBytes / CHUNK_SIZE);
    const token = newUploadToken();
    const values = [input.ownerType, input.ownerId, permission.department ?? null, safeFilename(input.filename), input.mimeType, input.sizeBytes, input.sha256, chunkCount, uploadTokenHash(token), actor.id, input.kind ?? null];
    // O mesmo arquivo só existe uma vez por cadastro (owner_type, owner_id, sha256). Mandar de novo
    // (foto removida e escolhida outra vez, ou envio que falhou no meio) reaproveita esse registro.
    const started = await transaction(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `insert into app.attachments
         (owner_type,owner_id,department_key,filename,mime_type,size_bytes,sha256,chunk_count,upload_token_hash,uploaded_by,kind)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         on conflict (owner_type, owner_id, sha256) do nothing
         returning id`, values
      );
      if (inserted.rows[0]) return { id: inserted.rows[0].id, chunkCount, reused: "" };
      const found = await client.query<{ id: string; status: string }>(
        "select id,status from app.attachments where owner_type=$1 and owner_id=$2 and sha256=$3 for update", [input.ownerType, input.ownerId, input.sha256]
      );
      const existing = found.rows[0];
      if (!existing) throw new AppError("O envio não começou. Tente de novo.", 409, "UPLOAD_CONFLICT");
      if (existing.status === "quarantined") throw new AppError("Este arquivo já foi bloqueado pela inspeção antivírus e não pode ser anexado.", 422, "ATTACHMENT_QUARANTINED");
      if (existing.status === "active") {
        // Conteúdo já conferido: não há partes a enviar; a finalização só confirma o arquivo ativo.
        await client.query("update app.attachments set upload_token_hash=$2 where id=$1", [existing.id, uploadTokenHash(token)]);
        return { id: existing.id, chunkCount: 0, reused: " · arquivo igual já conferido" };
      }
      await client.query("delete from app.attachment_chunks where attachment_id=$1", [existing.id]);
      await client.query(
        `update app.attachments set department_key=$3, filename=$4, mime_type=$5, size_bytes=$6, chunk_count=$8, upload_token_hash=$9,
            uploaded_by=$10, kind=$11, status='uploading', uploaded_at=now(), scan_result=null, scan_engine=null, activated_at=null, removed_at=null
          where id=$12 and owner_type=$1 and owner_id=$2 and sha256=$7`,
        [...values, existing.id]
      );
      return { id: existing.id, chunkCount, reused: " · reenvio do mesmo arquivo" };
    });
    const id = started.id;
    await appendAudit(actor, { category: "Inclusão", action: "Início de upload de anexo", module: "Anexos", section: input.ownerType, entityType: "attachment", entityId: id, result: "success", details: `${safeFilename(input.filename)} · ${input.sizeBytes} bytes · ${started.chunkCount} parte(s)${started.reused}.` });
    return Response.json({ id, token, chunkSize: CHUNK_SIZE, chunkCount: started.chunkCount }, { status: 201 });
  } catch (error) {
    if (actor) await appendAudit(actor, { category: "Segurança", action: "Falha ao iniciar upload", module: "Anexos", result: "failed", reasonCode: error instanceof AppError ? error.code : "INTERNAL_ERROR" }).catch(console.error);
    return errorResponse(error);
  }
}
