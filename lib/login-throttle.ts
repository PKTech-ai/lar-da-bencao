import { createHmac } from "node:crypto";
import type { PoolClient } from "pg";
import { query } from "@/lib/db";
import { serverEnv } from "@/lib/env";

/** Janelas progressivas: quanto mais falhas, maior a espera. */
export const LOGIN_LIMITS = {
  email: [
    { failures: 5, windowMinutes: 15 },
    { failures: 10, windowMinutes: 60 },
    { failures: 20, windowMinutes: 24 * 60 }
  ],
  ip: [
    { failures: 20, windowMinutes: 15 },
    { failures: 60, windowMinutes: 60 }
  ]
} as const;

export type AttemptScope = keyof typeof LOGIN_LIMITS;
export type FailureCounts = Record<AttemptScope, { windowMinutes: number; failures: number }[]>;

export function normalizeLoginEmail(email: string) {
  return email.trim().toLowerCase();
}

export function attemptKey(scope: AttemptScope, value: string) {
  // Chave derivada com separação de domínio: o hash não é reversível por enumeração de IPs/e-mails.
  return createHmac("sha256", `lar-auth-attempts:${serverEnv().CRON_SECRET}`).update(`${scope}:${value}`).digest("hex");
}

export function clientIp(request: Request) {
  return request.headers.get("x-real-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

/** Retorna os minutos de espera (maior janela estourada) ou 0 se liberado. */
export function lockoutMinutes(counts: FailureCounts) {
  let wait = 0;
  for (const scope of Object.keys(LOGIN_LIMITS) as AttemptScope[]) {
    for (const limit of LOGIN_LIMITS[scope]) {
      const observed = counts[scope].find((item) => item.windowMinutes === limit.windowMinutes)?.failures ?? 0;
      if (observed >= limit.failures) wait = Math.max(wait, limit.windowMinutes);
    }
  }
  return wait;
}

async function countFailures(scope: AttemptScope, keyHash: string) {
  const windows = LOGIN_LIMITS[scope].map((limit) => limit.windowMinutes);
  const result = await query<{ window_minutes: number; failures: number }>(
    `select w as window_minutes,
            (select count(*)::int from app.auth_attempts a
              where a.scope=$1 and a.key_hash=$2 and not a.success
                and a.created_at > now() - make_interval(mins => w)
                -- Login correto zera o contador do e-mail; o do IP não (conta própria não limpa o IP).
                and ($1 <> 'email' or a.created_at > coalesce((select max(created_at) from app.auth_attempts s
                                              where s.scope=$1 and s.key_hash=$2 and s.success), '-infinity'))) as failures
       from unnest($3::int[]) as w`,
    [scope, keyHash, windows]
  );
  return result.rows.map((row) => ({ windowMinutes: row.window_minutes, failures: row.failures }));
}

export async function loginLockout(keys: Record<AttemptScope, string>) {
  const [email, ip] = await Promise.all([countFailures("email", keys.email), countFailures("ip", keys.ip)]);
  return lockoutMinutes({ email, ip });
}

export async function recordAttempt(keys: Record<AttemptScope, string>, success: boolean, client?: PoolClient) {
  const sql = "insert into app.auth_attempts (scope, key_hash, success) values ('email',$1,$3), ('ip',$2,$3)";
  if (client) await client.query(sql, [keys.email, keys.ip, success]);
  else await query(sql, [keys.email, keys.ip, success]);
}
