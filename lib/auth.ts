import { createClient } from "@/lib/supabase/server";
import { query } from "@/lib/db";
import { AuthenticationError, AuthorizationError } from "@/lib/errors";
import { decodeAccessToken, isRecentTotp, isSessionRevoked, lastTotpAt, sessionAuthenticatedAt, sessionIdFromClaims } from "@/lib/sessions";

export type Actor = {
  id: string;
  authUserId: string;
  email: string;
  name: string;
  role: string;
  status: "active";
  departments: string[];
  sessionId: string | null;
  /** Última confirmação TOTP desta sessão (segundos), para exigir reautenticação recente. */
  totpAt?: number | null;
};

type ActorRow = {
  id: string;
  auth_user_id: string;
  email: string;
  full_name: string;
  role_key: string;
  status: string;
  departments: string[] | null;
  sessions_valid_after: Date | null;
};

export async function requireActor(options: { requireMfa?: boolean } = {}): Promise<Actor> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new AuthenticationError();
  const currentSession = await supabase.auth.getSession();

  if (options.requireMfa !== false) {
    const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error || assurance.data.currentLevel !== "aal2") {
      throw new AuthenticationError("Confirme o segundo fator para continuar.", "MFA_REQUIRED");
    }
  }

  const result = await query<ActorRow>(
    `select u.id, u.auth_user_id, u.email, u.full_name, u.role_key, u.status, u.sessions_valid_after,
            coalesce(array_agg(ud.department_key) filter (where ud.department_key is not null), '{}') as departments
       from app.users u
       left join app.user_departments ud on ud.user_id = u.id
      where u.auth_user_id = $1
      group by u.id`,
    [data.user.id]
  );
  const row = result.rows[0];
  if (!row || row.status !== "active") throw new AuthorizationError("Conta institucional inativa ou sem vínculo.");
  const claims = decodeAccessToken(currentSession.data.session?.access_token);
  if (isSessionRevoked(sessionAuthenticatedAt(claims), row.sessions_valid_after)) {
    throw new AuthenticationError("Sessão encerrada pela administração. Entre novamente.", "SESSION_REVOKED");
  }

  return {
    id: row.id,
    authUserId: row.auth_user_id,
    email: row.email,
    name: row.full_name,
    role: row.role_key,
    status: "active",
    departments: row.departments ?? [],
    sessionId: sessionIdFromClaims(claims),
    totpAt: lastTotpAt(claims)
  };
}

/** Operações sensíveis de MFA exigem código TOTP confirmado nos últimos minutos. */
export function assertRecentTotp(actor: Actor) {
  if (!isRecentTotp(actor.totpAt ?? null)) {
    throw new AuthenticationError("Confirme o código do autenticador novamente para continuar.", "REAUTH_REQUIRED");
  }
}
