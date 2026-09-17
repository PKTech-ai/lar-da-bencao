import { assertRecentTotp, requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { deleteAllMfaFactors, invalidateRecoveryCodes } from "@/lib/mfa-reset";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Troca de aparelho pelo titular (BL-004): exige código TOTP recente, remove o fator atual,
 * invalida os códigos de recuperação e encerra as outras sessões. O titular recadastra em /mfa.
 */
export async function POST(request: Request) {
  let actor = null;
  try {
    assertSameOrigin(request);
    actor = await requireActor();
    assertRecentTotp(actor);
    const supabase = await createClient();
    const accessToken = (await supabase.auth.getSession()).data.session?.access_token;
    if (!accessToken) throw new AppError("Sessão expirada. Entre novamente.", 401, "UNAUTHENTICATED");
    const owner = actor;
    const removed = await transaction(async (client) => {
      const invalidated = await invalidateRecoveryCodes(client, owner.id);
      const signOut = await createAdminClient().auth.admin.signOut(accessToken, "others");
      if (signOut.error) throw signOut.error;
      const factors = await deleteAllMfaFactors(owner.authUserId);
      await appendAudit(owner, {
        category: "Segurança", action: "Troca de autenticador pelo titular", module: "Controle de Acesso", section: "MFA",
        entityType: "user", entityId: owner.id,
        details: `${factors} fator(es) removido(s); ${invalidated} código(s) de recuperação invalidado(s); outras sessões encerradas.`
      }, client);
      return factors;
    });
    return Response.json({ ok: true, removed, next: "/mfa" });
  } catch (error) {
    if (actor) {
      await appendAudit(actor, {
        category: "Segurança", action: "Troca de autenticador recusada", module: "Controle de Acesso", section: "MFA",
        entityType: "user", entityId: actor.id, result: "denied", reasonCode: error instanceof AppError ? error.code : "INTERNAL_ERROR"
      }).catch(console.error);
    }
    return errorResponse(error);
  }
}
