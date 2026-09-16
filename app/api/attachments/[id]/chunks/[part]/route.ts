import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { authorizeAttachment, CHUNK_SIZE, sha256, validateSignature } from "@/lib/attachments";
import { transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/csrf";

export const runtime = "nodejs";

const paramsSchema = z.object({ id: z.string().uuid(), part: z.coerce.number().int().min(0).max(6) });
type Attachment = { id: string; owner_type: string; mime_type: string; status: string; chunk_count: number; size_bytes: string; token_valid: boolean };

export async function PUT(request: Request, context: { params: Promise<{ id: string; part: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const params = paramsSchema.parse(await context.params);
    const token = request.headers.get("x-upload-token") ?? "";
    if (token.length < 32) throw new AppError("Token de upload ausente.", 401, "UPLOAD_TOKEN_REQUIRED");
    const announced = Number(request.headers.get("content-length") ?? 0);
    if (announced > CHUNK_SIZE) throw new AppError("Parte maior que 3 MiB.", 413, "CHUNK_TOO_LARGE");
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!bytes.byteLength || bytes.byteLength > CHUNK_SIZE) throw new AppError("Parte vazia ou maior que 3 MiB.", 413, "INVALID_CHUNK_SIZE");

    const result = await transaction(async (client) => {
      const found = await client.query<Attachment>(
        `select id,owner_type,mime_type,status,chunk_count,size_bytes::text,
                upload_token_hash = digest($2,'sha256') as token_valid
           from app.attachments where id=$1 for update`, [params.id, token]
      );
      const file = found.rows[0];
      if (!file || !file.token_valid) throw new AppError("Upload não encontrado.", 404, "UPLOAD_NOT_FOUND");
      await authorizeAttachment(actor, file.owner_type, "update");
      if (file.status !== "uploading") throw new AppError("Este upload já foi finalizado.", 409, "UPLOAD_ALREADY_FINALIZED");
      if (params.part >= file.chunk_count) throw new AppError("Número de parte inválido.");
      if (params.part === 0) validateSignature(file.mime_type, bytes);
      const hash = sha256(bytes);
      const existing = await client.query<{ sha256: string }>("select sha256 from app.attachment_chunks where attachment_id=$1 and part_no=$2", [params.id, params.part]);
      if (existing.rows[0]) {
        if (existing.rows[0].sha256 !== hash) throw new AppError("Esta parte já foi enviada com outro conteúdo.", 409, "CHUNK_CONFLICT");
        return { hash, duplicate: true };
      }
      await client.query(
        `insert into app.attachment_chunks (attachment_id,part_no,size_bytes,sha256,data) values ($1,$2,$3,$4,$5)`,
        [params.id, params.part, bytes.byteLength, hash, Buffer.from(bytes)]
      );
      const total = await client.query<{ size: string }>("select coalesce(sum(size_bytes),0)::text as size from app.attachment_chunks where attachment_id=$1", [params.id]);
      if (Number(total.rows[0].size) > Number(file.size_bytes)) throw new AppError("As partes ultrapassam o tamanho declarado.", 409, "UPLOAD_SIZE_MISMATCH");
      return { hash, duplicate: false };
    });
    return Response.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (error) { return errorResponse(error); }
}
