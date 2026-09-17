import { z } from "zod";
import { assertRecentTotp, requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { query, transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import {
  RECOVERY_FAILURE_WINDOW_MINUTES,
  generateRecoveryCodes,
  hashRecoveryCode,
  isRecoveryLocked,
  normalizeRecoveryCode,
  recoveryCodeHashes
} from "@/lib/mfa-recovery";
import { deleteAllMfaFactors, invalidateRecoveryCodes } from "@/lib/mfa-reset";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const USE_ACTION = "Uso de código de recuperação MFA";
const noStore = { "Cache-Control": "private, no-store" };
const useSchema = z.object({ code: z.string().max(64) });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor({ requireMfa: true });
    assertRecentTotp(actor);
    const codes = generateRecoveryCodes();
    const hashed = recoveryCodeHashes(codes);
    await transaction(async (client) => {
      await invalidateRecoveryCodes(client, actor.id);
      for (const item of hashed) {
        await client.query("insert into app.mfa_recovery_codes (user_id, code_hash) values ($1,$2)", [actor.id, item.hash]);
      }
      await appendAudit(actor, {
        category: "Segurança",
        action: "Emissão de códigos de recuperação MFA",
        module: "Controle de Acesso",
        section: "MFA",
        entityType: "user",
        entityId: actor.id,
        details: `${codes.length} códigos emitidos; anteriores invalidados (plaintext não armazenado).`
      }, client);
    });
    return Response.json({ codes }, { headers: noStore });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Consome um código de recuperação (sessão aal1). Em caso de sucesso: invalida os demais códigos,
 * remove o fator TOTP perdido e encerra as outras sessões; o titular recadastra o autenticador em seguida.
 */
export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor({ requireMfa: false });
    const parsed = useSchema.safeParse(await request.json().catch(() => null));
    const code = parsed.success ? normalizeRecoveryCode(parsed.data.code) : "";
    if (!code) throw new AppError("Informe o código de recuperação.");

    const failures = await query<{ count: string }>(
      `select count(*)::text as count from app.audit_events
        where actor_user_id=$1 and action=$2 and result in ('failed','denied')
          and occurred_at > now() - make_interval(mins => $3)`,
      [actor.id, USE_ACTION, RECOVERY_FAILURE_WINDOW_MINUTES]
    );
    if (isRecoveryLocked(Number(failures.rows[0]?.count ?? 0))) {
      await appendAudit(actor, {
        category: "Segurança", action: USE_ACTION, module: "Controle de Acesso", section: "MFA",
        entityType: "user", entityId: actor.id, result: "denied", reasonCode: "RECOVERY_LOCKED"
      });
      throw new AppError(`Muitas tentativas. Aguarde ${RECOVERY_FAILURE_WINDOW_MINUTES} minutos ou procure a administração.`, 429, "RECOVERY_LOCKED");
    }

    const supabase = await createClient();
    const accessToken = (await supabase.auth.getSession()).data.session?.access_token;
    if (!accessToken) throw new AppError("Sessão expirada. Entre novamente.", 401, "UNAUTHENTICATED");

    const consumed = await transaction(async (client) => {
      const found = await client.query<{ id: string }>(
        `select id from app.mfa_recovery_codes
          where user_id=$1 and code_hash=$2 and used_at is null
          for update`,
        [actor.id, hashRecoveryCode(code)]
      );
      if (!found.rows[0]) return false;
      await client.query("update app.mfa_recovery_codes set used_at=now() where id=$1", [found.rows[0].id]);
      const invalidated = await invalidateRecoveryCodes(client, actor.id);
      // Chamadas externas dentro da transação: se falharem, o código não é consumido.
      const removedFactors = await deleteAllMfaFactors(actor.authUserId);
      const signOut = await createAdminClient().auth.admin.signOut(accessToken, "others");
      if (signOut.error) throw signOut.error;
      await appendAudit(actor, {
        category: "Segurança", action: USE_ACTION, module: "Controle de Acesso", section: "MFA",
        entityType: "user", entityId: actor.id,
        details: `Código consumido; ${invalidated} restantes invalidados; ${removedFactors} fator(es) removido(s); demais sessões encerradas.`
      }, client);
      return true;
    });

    if (!consumed) {
      await appendAudit(actor, {
        category: "Segurança", action: USE_ACTION, module: "Controle de Acesso", section: "MFA",
        entityType: "user", entityId: actor.id, result: "failed", reasonCode: "RECOVERY_INVALID"
      });
      throw new AppError("Código inválido ou já utilizado.", 401, "RECOVERY_INVALID");
    }
    return Response.json({ ok: true, reenrollRequired: true }, { headers: noStore });
  } catch (error) {
    return errorResponse(error);
  }
}
