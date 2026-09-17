import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { deleteAllMfaFactors, invalidateRecoveryCodes } from "@/lib/mfa-reset";
import { assertPermission } from "@/lib/permissions";
import { revokeAllSessions } from "@/lib/sessions";

/**
 * Recuperação iniciada pelo administrador: remove fatores MFA, invalida códigos de recuperação
 * e encerra as sessões do usuário. O administrador nunca vê segredo TOTP nem códigos.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let actor = null;
  try {
    assertSameOrigin(request);
    actor = await requireActor();
    await assertPermission(actor, "users", "admin");
    const id = z.string().uuid().parse((await context.params).id);
    if (id === actor.id) throw new AppError("Use a própria tela de MFA para trocar o seu autenticador.", 409, "SELF_MFA_RESET");
    const admin = actor;
    const name = await transaction(async (client) => {
      const user = await client.query<{ auth_user_id: string; full_name: string }>(
        "select auth_user_id, full_name from app.users where id=$1 for update",
        [id]
      );
      const target = user.rows[0];
      if (!target) throw new AppError("Usuário não encontrado.", 404, "USER_NOT_FOUND");
      const invalidated = await invalidateRecoveryCodes(client, id);
      await revokeAllSessions(client, id, target.auth_user_id);
      // Chamada externa por último: se falhar, a transação desfaz o restante.
      const removedFactors = await deleteAllMfaFactors(target.auth_user_id);
      await appendAudit(admin, {
        category: "Segurança",
        action: "Redefinição de MFA pelo administrador",
        module: "Controle de Acesso",
        section: "Usuários e Perfis",
        entityType: "user",
        entityId: id,
        details: `${target.full_name}: ${removedFactors} fator(es) removido(s), ${invalidated} código(s) invalidado(s), sessões encerradas.`
      }, client);
      return target.full_name;
    });
    return Response.json({ status: "reset", name });
  } catch (error) {
    if (actor) {
      await appendAudit(actor, {
        category: "Segurança",
        action: "Falha ao redefinir MFA",
        module: "Controle de Acesso",
        section: "Usuários e Perfis",
        result: "failed",
        reasonCode: error instanceof AppError ? error.code : "INTERNAL_ERROR"
      }).catch(console.error);
    }
    return errorResponse(error);
  }
}
