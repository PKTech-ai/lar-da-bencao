import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { authorizeAttachment } from "@/lib/attachments";
import { dbPool } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";

export const runtime = "nodejs";

type FileRow = { id: string; owner_type: string; filename: string; mime_type: string; size_bytes: string; status: string; chunk_count: number };

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    const id = z.string().uuid().parse((await context.params).id);
    const found = await dbPool().query<FileRow>("select id,owner_type,filename,mime_type,size_bytes::text,status,chunk_count from app.attachments where id=$1", [id]);
    const file = found.rows[0];
    if (!file || file.status !== "active") throw new AppError("Anexo não encontrado.", 404, "ATTACHMENT_NOT_FOUND");
    await authorizeAttachment(actor, file.owner_type, "download");
    await appendAudit(actor, { category: "Acesso", action: "Download de anexo", module: "Anexos", section: file.owner_type, entityType: "attachment", entityId: id, result: "success", details: file.filename });
    let index = 0;
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (index >= file.chunk_count) { controller.close(); return; }
        try {
          const chunk = await dbPool().query<{ data: Buffer }>(
            "select data from app.attachment_chunks where attachment_id=$1 and part_no=$2",
            [id, index]
          );
          if (!chunk.rows[0]) throw new Error(`Parte ${index} ausente.`);
          index += 1;
          controller.enqueue(new Uint8Array(chunk.rows[0].data));
        } catch (error) {
          controller.error(error);
        }
      }
    });
    const encoded = encodeURIComponent(file.filename);
    const inline = new URL(request.url).searchParams.get("inline") === "1" && ["application/pdf", "image/jpeg", "image/png"].includes(file.mime_type);
    return new Response(stream, { headers: {
      "Content-Type": file.mime_type,
      "Content-Length": file.size_bytes,
      // `?inline=1` abre PDFs e imagens no navegador (visualização); demais tipos sempre como download.
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="anexo"; filename*=UTF-8''${encoded}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff"
    }});
  } catch (error) { return errorResponse(error); }
}
