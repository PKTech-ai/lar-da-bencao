import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import type { PoolClient } from "pg";
import { requireActor, type Actor } from "@/lib/auth";
import type { AuditAuthor } from "@/lib/audit";
import { query } from "@/lib/db";
import { AppError, AuthenticationError, AuthorizationError } from "@/lib/errors";
import { requireFlag } from "@/lib/feature-flags";
import { clientIp } from "@/lib/login-throttle";
import { pageLevel } from "@/lib/permissions";

/**
 * Quem está operando o módulo de Ingressos e o que pode fazer.
 * - Usuário do sistema: Coordenação (página Eventos com acesso total) ou Equipe (leitura na página Eventos
 *   e vínculo com o Departamento de Eventos). Leitura sem vínculo (ex.: Diretoria) só consulta o caixa.
 * - Trabalhador: sessão do acesso temporário (link + PIN + aparelho), presa a um evento e às próprias vendas.
 */
export const FLAG = "module_eventos";
export const MODULE = "Eventos";
export const SECTION = "Ingressos";

export const PERMISSIONS = [
  "organizador.gerenciar", "evento.gerenciar", "meta.gerenciar", "acesso.gerenciar", "acerto.registrar",
  "venda.criar", "venda.cancelar", "pagamento.registrar", "pagamento.estornar", "ticket.validar",
  "ticket.desfazer_entrega", "caixa.ver", "caixa.exportar"
] as const;
export type Permission = (typeof PERMISSIONS)[number];
export type UserRole = "coordenacao" | "equipe" | "consulta";

const EQUIPE: readonly Permission[] = ["venda.criar", "pagamento.registrar", "ticket.validar", "caixa.ver"];
const CONSULTA: readonly Permission[] = ["caixa.ver"];

export function roleAllows(role: UserRole, permission: Permission) {
  if (role === "coordenacao") return true;
  return (role === "equipe" ? EQUIPE : CONSULTA).includes(permission);
}

export type UserOperator = { kind: "user"; actor: Actor; role: UserRole };
export type SellerOperator = { kind: "seller"; sellerId: string; eventId: string; accessId: string; name: string };
export type Operator = UserOperator | SellerOperator;

export function can(op: Operator, permission: Permission) {
  return op.kind === "user" && roleAllows(op.role, permission);
}

export function assertCan(op: Operator, permission: Permission) {
  if (!can(op, permission)) throw new AuthorizationError();
}

export function author(op: Operator): Actor | AuditAuthor {
  return op.kind === "user" ? op.actor : { name: `${op.name} (trabalhador)`, role: "vendedor_ingressos" };
}

export function userRoleFor(level: "full" | "read" | null, departments: string[]): UserRole | null {
  if (level === "full") return "coordenacao";
  if (level === "read") return departments.includes("eventos") ? "equipe" : "consulta";
  return null;
}

export async function userOperator(actor: Actor): Promise<UserOperator> {
  await requireFlag(FLAG);
  const role = userRoleFor(await pageLevel(actor, "eventos"), actor.departments);
  if (!role) throw new AuthorizationError();
  return { kind: "user", actor, role };
}

// ---------- tokens, hashes e PIN ----------

export const newToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const sha256hex = (value: string) => createHash("sha256").update(value).digest("hex");

const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export async function hashPin(pin: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(pin, salt, 32);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPin(pin: string, stored: string | null) {
  const [scheme, salt, hash] = (stored ?? "").split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scrypt(pin, Buffer.from(salt, "base64url"), expected.length);
  return timingSafeEqual(expected, actual);
}

// ---------- cookies do trabalhador ----------

export const DEVICE_COOKIE = "lar_ing_dev";
export const SESSION_COOKIE = "lar_ing_ses";
export const SESSION_HOURS = 12;
export const ACCESS_ENDED = "Acesso encerrado. Fale com a coordenação.";

export const cookieOptions = (maxAgeSeconds: number) => ({
  httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: maxAgeSeconds
});

/** Sessão do trabalhador a partir dos cookies. Acesso bloqueado, reenviado ou vencido → null. */
export async function sellerFromCookies(): Promise<SellerOperator | null> {
  const store = await cookies();
  const session = store.get(SESSION_COOKIE)?.value;
  const device = store.get(DEVICE_COOKIE)?.value;
  if (!session || !device) return null;
  const found = await query<{ access_id: string; event_id: string; seller_id: string; name: string }>(
    `select a.id as access_id, a.event_id, a.seller_id, s.name
       from app.ticket_seller_sessions ss
       join app.ticket_access a on a.id = ss.access_id
       join app.ticket_sellers s on s.id = a.seller_id
      where ss.token_hash = $1 and ss.revoked_at is null and ss.expires_at > now()
        and a.revoked_at is null and a.device_hash = $2
        and a.valid_until >= (now() at time zone 'America/Manaus')::date`,
    [sha256hex(session), sha256hex(device)]
  );
  const row = found.rows[0];
  return row ? { kind: "seller", sellerId: row.seller_id, eventId: row.event_id, accessId: row.access_id, name: row.name } : null;
}

/**
 * Operador da requisição. O app do trabalhador manda `X-Ingressos-Modo: vendedor`; sem o cabeçalho,
 * vale o login normal do sistema.
 */
export async function resolveOperator(request: Request): Promise<Operator> {
  if (request.headers.get("x-ingressos-modo") === "vendedor") {
    await requireFlag(FLAG);
    const seller = await sellerFromCookies();
    if (!seller) throw new AuthenticationError(ACCESS_ENDED, "ACCESS_ENDED");
    return seller;
  }
  return userOperator(await requireActor());
}

export async function requireUser(request: Request): Promise<UserOperator> {
  const op = await resolveOperator(request);
  if (op.kind !== "user") throw new AuthorizationError();
  return op;
}

// ---------- limite por IP (página pública e link de acesso) ----------

const RATE_LIMITS = { link: 40, acesso: 20, pin: 30 } as const;

export function ipKey(request: Request | null, ip?: string) {
  return sha256hex(`lar-ingressos:${ip ?? (request ? clientIp(request) : "unknown")}`);
}

/** Conta falhas recentes (15 min) do IP; acima do limite, recusa sem dizer se o token existe. */
export async function assertRateLimit(scope: keyof typeof RATE_LIMITS, key: string) {
  const result = await query<{ hits: number }>(
    "select count(*)::int as hits from app.ticket_rate_hits where scope=$1 and key_hash=$2 and created_at > now() - interval '15 minutes'",
    [scope, key]
  );
  if ((result.rows[0]?.hits ?? 0) >= RATE_LIMITS[scope]) throw new AppError("Muitas tentativas. Aguarde alguns minutos.", 429, "RATE_LIMITED");
}

export async function recordRateHit(scope: keyof typeof RATE_LIMITS, key: string, client?: PoolClient) {
  const sql = "insert into app.ticket_rate_hits (scope, key_hash) values ($1, $2)";
  if (client) await client.query(sql, [scope, key]);
  else await query(sql, [scope, key]);
}
