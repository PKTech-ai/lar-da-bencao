import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { assertPermission } from "@/lib/permissions";

const schema = z.object({
  status: z.enum(["Recebida", "Em análise", "Respondida", "Arquivada"]),
  answer: z.string().trim().max(4000).optional().default(""),
  version: z.number().int().positive()
});

/** Resposta da Diretoria a uma sugestão. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    await assertPermission(actor, "presidencia", "update");
    const id = z.string().uuid().parse((await context.params).id);
    const input = schema.parse(await request.json());
    if (input.status === "Respondida" && input.answer.length < 3) throw new AppError("Escreva a resposta antes de marcar como respondida.");
    await transaction(async (client) => {
      const updated = await client.query(
        `update app.suggestions set status=$2, answer=$3, answered_by=$4,
                answered_at = case when $2 = 'Respondida' then now() else answered_at end, version = version + 1
          where id=$1 and version=$5`,
        [id, input.status, input.answer, actor.id, input.version]
      );
      if (!updated.rowCount) throw new AppError("Sugestão alterada por outra sessão. Recarregue a página.", 409, "VERSION_CONFLICT");
      await appendAudit(actor, {
        category: "Edição", action: "Resposta a sugestão", module: "Sistema", section: "Sugestões",
        entityType: "suggestion", entityId: id, details: input.status
      }, client);
    });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
