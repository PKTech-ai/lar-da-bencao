import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { assertPermission } from "@/lib/permissions";
import { revokeAllSessions } from "@/lib/sessions";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let actor = null;
  try {
    assertSameOrigin(request);
    actor = await requireActor();
    await assertPermission(actor, "users", "admin");
    const id = z.string().uuid().parse((await context.params).id);
    const admin = actor;
    const result = await transaction(async (client) => {
      const user = await client.query<{ auth_user_id: string; full_name: string }>(
        "select auth_user_id, full_name from app.users where id=$1 for update",
        [id]
      );
      const target = user.rows[0];
      if (!target) throw new AppError("Usuário não encontrado.", 404, "USER_NOT_FOUND");
      const removed = await revokeAllSessions(client, id, target.auth_user_id);
      await appendAudit(admin, {
        category: "Segurança",
        action: "Revogação de sessões",
        module: "Controle de Acesso",
        section: "Usuários e Perfis",
        entityType: "user",
        entityId: id,
        details: `Sessões encerradas para ${target.full_name} (${removed} no provedor).`
      }, client);
      return { removed, self: id === admin.id };
    });
    return Response.json({ status: "revoked", ...result });
  } catch (error) {
    if (actor) {
      await appendAudit(actor, {
        category: "Segurança",
        action: "Falha ao revogar sessões",
        module: "Controle de Acesso",
        result: "failed",
        reasonCode: error instanceof AppError ? error.code : "INTERNAL_ERROR"
      }).catch(console.error);
    }
    return errorResponse(error);
  }
}
