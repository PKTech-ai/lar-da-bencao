import type { PoolClient } from "pg";
import { createAdminClient } from "@/lib/supabase/admin";

/** Remove todos os fatores MFA do usuário no Supabase Auth; o próximo acesso exige novo cadastro TOTP. */
export async function deleteAllMfaFactors(authUserId: string) {
  const admin = createAdminClient();
  const listed = await admin.auth.admin.mfa.listFactors({ userId: authUserId });
  if (listed.error) throw listed.error;
  for (const factor of listed.data.factors) {
    const removed = await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId: authUserId });
    if (removed.error) throw removed.error;
  }
  return listed.data.factors.length;
}

export async function invalidateRecoveryCodes(client: PoolClient, userId: string) {
  const result = await client.query(
    "update app.mfa_recovery_codes set used_at=now() where user_id=$1 and used_at is null",
    [userId]
  );
  return result.rowCount ?? 0;
}
