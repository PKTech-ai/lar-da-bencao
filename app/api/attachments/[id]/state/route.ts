import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { authorizeAttachment } from "@/lib/attachments";
import { assertSameOrigin } from "@/lib/csrf";
import { transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";

const schema = z.object({ action: z.enum(["remove", "restore"]), reason: z.string().trim().max(500).default("") });

/** Retira um anexo do cadastro (mantém o binário e o histórico) ou restaura o vínculo. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const id = z.string().uuid().parse((await context.params).id);
    const input = schema.parse(await request.json());
    await transaction(async (client) => {
      const found = await client.query<{ owner_type: string; status: string; filename: string; has_binary: boolean }>(
        `select owner_type, status, filename, exists (select 1 from app.attachment_chunks c where c.attachment_id = a.id) as has_binary
           from app.attachments a where id=$1 for update`,
        [id]
      );
      const file = found.rows[0];
      if (!file) throw new AppError("Anexo não encontrado.", 404, "NOT_FOUND");
      await authorizeAttachment(actor, file.owner_type, "update");
      if (input.action === "remove") {
        if (file.status !== "active") throw new AppError("Somente anexos ativos podem ser retirados.", 409, "INVALID_ATTACHMENT_STATUS");
        if (input.reason.length < 3) throw new AppError("Informe o motivo da retirada.");
        await client.query("update app.attachments set status='deleted', removed_at=now() where id=$1", [id]);
      } else {
        if (file.status !== "deleted" || !file.has_binary) throw new AppError("Este anexo não pode ser restaurado.", 409, "INVALID_ATTACHMENT_STATUS");
        await client.query("update app.attachments set status='active', removed_at=null where id=$1", [id]);
      }
      await appendAudit(actor, {
        category: input.action === "remove" ? "Exclusão" : "Edição",
        action: input.action === "remove" ? "Anexo retirado do cadastro" : "Anexo restaurado",
        module: "Anexos", section: file.owner_type, entityType: "attachment", entityId: id,
        details: [file.filename, input.reason].filter(Boolean).join(" · ")
      }, client);
    });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
