import { createHash } from "node:crypto";
import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { authorizeAttachment } from "@/lib/attachments";
import { transaction } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { AppError, errorResponse } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/csrf";

export const runtime = "nodejs";

type Attachment = { id: string; owner_type: string; filename: string; mime_type: string; size_bytes: string; sha256: string; chunk_count: number; status: string; token_valid: boolean };
type Chunk = { part_no: number; data: Buffer; size_bytes: number };

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let actor = null;
  let attachment: Attachment | null = null;
  try {
    assertSameOrigin(request);
    actor = await requireActor();
    const id = z.string().uuid().parse((await context.params).id);
    const token = request.headers.get("x-upload-token") ?? "";
    if (token.length < 32) throw new AppError("Token de upload ausente.", 401, "UPLOAD_TOKEN_REQUIRED");

    const verified = await transaction(async (client) => {
      const found = await client.query<Attachment>(
        `select id,owner_type,filename,mime_type,size_bytes::text,sha256,chunk_count,status,
                upload_token_hash = digest($2,'sha256') as token_valid
           from app.attachments where id=$1 for update`, [id, token]
      );
      const file = found.rows[0];
      if (!file || !file.token_valid) throw new AppError("Upload não encontrado.", 404, "UPLOAD_NOT_FOUND");
      await authorizeAttachment(actor!, file.owner_type, "update");
      if (file.status === "active") return { file, chunks: [] as Chunk[], already: true };
      if (!['uploading','pending_scan'].includes(file.status)) throw new AppError("Este anexo não pode ser finalizado.", 409, "INVALID_ATTACHMENT_STATUS");
      const chunks = await client.query<Chunk>("select part_no,data,size_bytes from app.attachment_chunks where attachment_id=$1 order by part_no", [id]);
      if (chunks.rowCount !== file.chunk_count || chunks.rows.some((chunk, index) => chunk.part_no !== index)) throw new AppError("Ainda faltam partes do arquivo.", 409, "MISSING_CHUNKS");
      const total = chunks.rows.reduce((sum, chunk) => sum + chunk.size_bytes, 0);
      const hash = createHash("sha256"); chunks.rows.forEach((chunk) => hash.update(chunk.data));
      if (total !== Number(file.size_bytes) || hash.digest("hex") !== file.sha256) throw new AppError("O arquivo final não confere com tamanho ou hash informados.", 409, "FILE_INTEGRITY_FAILED");
      await client.query("update app.attachments set status='pending_scan' where id=$1", [id]);
      return { file, chunks: chunks.rows, already: false };
    });
    attachment = verified.file;
    if (verified.already) return Response.json({ id, status: "active" });

    const env = serverEnv();
    const body = Buffer.concat(verified.chunks.map((chunk) => chunk.data));
    const scan = await fetch(env.ANTIMALWARE_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.ANTIMALWARE_API_TOKEN}`, "Content-Type": attachment.mime_type, "X-File-SHA256": attachment.sha256 },
      body,
      signal: AbortSignal.timeout(45_000)
    });
    const scanBody = z.object({ clean: z.boolean(), engine: z.string().max(100).optional(), reason: z.string().max(500).optional() }).parse(await scan.json());
    if (!scan.ok) throw new AppError("O serviço de inspeção não concluiu a análise.", 503, "MALWARE_SCAN_UNAVAILABLE");
    const status = scanBody.clean ? "active" : "quarantined";
    await transaction(async (client) => {
      await client.query(
        `update app.attachments set status=$2,scan_result=$3,scan_engine=$4,activated_at=case when $2='active' then now() else null end where id=$1`,
        [id, status, scanBody.clean ? "clean" : scanBody.reason ?? "blocked", scanBody.engine ?? "external"]
      );
      await appendAudit(actor!, { category: scanBody.clean ? "Inclusão" : "Segurança", action: scanBody.clean ? "Anexo ativado" : "Anexo bloqueado pela inspeção", module: "Anexos", section: attachment!.owner_type, entityType: "attachment", entityId: id, result: scanBody.clean ? "success" : "denied", details: attachment!.filename }, client);
    });
    return Response.json({ id, status }, { status: scanBody.clean ? 200 : 422 });
  } catch (error) {
    if (actor && attachment) await appendAudit(actor, { category: "Segurança", action: "Falha na finalização do anexo", module: "Anexos", section: attachment.owner_type, entityType: "attachment", entityId: attachment.id, result: "failed", reasonCode: error instanceof AppError ? error.code : "INTERNAL_ERROR" }).catch(console.error);
    return errorResponse(error);
  }
}
