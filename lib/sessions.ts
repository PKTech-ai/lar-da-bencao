import type { PoolClient } from "pg";

type AccessTokenClaims = { session_id?: unknown; amr?: unknown; iat?: unknown };

export function decodeAccessToken(accessToken?: string | null): AccessTokenClaims | null {
  if (!accessToken) return null;
  try {
    return JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString("utf8")) as AccessTokenClaims;
  } catch {
    return null;
  }
}

export function sessionIdFromClaims(claims: AccessTokenClaims | null) {
  return typeof claims?.session_id === "string" ? claims.session_id : null;
}

/**
 * Momento do login que originou a sessão (em segundos). O `amr` guarda o horário de cada
 * método de autenticação e não muda no refresh, ao contrário do `iat`.
 */
export function sessionAuthenticatedAt(claims: AccessTokenClaims | null): number | null {
  if (!claims) return null;
  const stamps = Array.isArray(claims.amr)
    ? claims.amr
      .map((entry) => (entry && typeof entry === "object" ? (entry as { timestamp?: unknown }).timestamp : undefined))
      .filter((value): value is number => typeof value === "number")
    : [];
  if (stamps.length) return Math.min(...stamps);
  return typeof claims.iat === "number" ? claims.iat : null;
}

/** Momento (s) da última confirmação TOTP nesta sessão, pelo `amr` do JWT. */
export function lastTotpAt(claims: AccessTokenClaims | null): number | null {
  if (!claims || !Array.isArray(claims.amr)) return null;
  const stamps = claims.amr
    .filter((entry): entry is { method: string; timestamp: number } =>
      Boolean(entry) && typeof entry === "object" && (entry as { method?: unknown }).method === "totp"
      && typeof (entry as { timestamp?: unknown }).timestamp === "number")
    .map((entry) => entry.timestamp);
  return stamps.length ? Math.max(...stamps) : null;
}

export const REAUTH_WINDOW_SECONDS = 5 * 60;

export function isRecentTotp(totpAt: number | null, nowMs = Date.now(), windowSeconds = REAUTH_WINDOW_SECONDS) {
  return totpAt !== null && nowMs / 1000 - totpAt <= windowSeconds;
}

export function isSessionRevoked(authenticatedAt: number | null, validAfter: Date | string | null) {
  if (!validAfter) return false;
  if (authenticatedAt === null) return true;
  return authenticatedAt * 1000 < new Date(validAfter).getTime();
}

/** Revoga todas as sessões do usuário: corte imediato na aplicação e remoção no Supabase Auth. */
export async function revokeAllSessions(client: PoolClient, userId: string, authUserId: string) {
  // amr tem resolução de segundos: arredonda para cima para derrubar sessões do mesmo segundo.
  await client.query("update app.users set sessions_valid_after = date_trunc('second', now()) + interval '1 second' where id=$1", [userId]);
  const removed = await client.query<{ count: number }>("select app.revoke_auth_sessions($1::uuid) as count", [authUserId]);
  return removed.rows[0]?.count ?? 0;
}
