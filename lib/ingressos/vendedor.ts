import { z } from "zod";
import { appendAudit } from "@/lib/audit";
import { query, transaction } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  ACCESS_ENDED, MODULE, SECTION, SESSION_HOURS, assertRateLimit, hashPin, ipKey, newToken, recordRateHit, sha256hex, verifyPin
} from "@/lib/ingressos/acesso";
import { TODAY_SQL, logoUrl } from "@/lib/ingressos/dados";

/**
 * Link de acesso do trabalhador (RF-12): primeiro acesso cria o PIN e prende o link ao aparelho;
 * depois, só o PIN (sessão de 12 h). 5 PINs errados bloqueiam por 15 minutos.
 */

type AccessRow = {
  id: string; seller_id: string; seller_name: string; event_id: string; event_name: string; event_date: string; organizer_id: string;
  has_logo: boolean; logo_version: string | null; valid_until: string; pin_hash: string | null; device_hash: string | null;
  locked_until: string | null; locked: boolean; usable: boolean;
};

export type AccessState =
  | { state: "encerrado" }
  | { state: "outro_aparelho" }
  | { state: "criar_pin" | "pin" | "bloqueado_pin"; seller_name: string; event_name: string; event_date: string; valid_until: string; logo_url: string; minutes?: number };

async function findAccess(token: string) {
  const result = await query<AccessRow>(
    `select a.id, a.seller_id, s.name as seller_name, a.event_id, e.name as event_name, to_char(e.event_date, 'YYYY-MM-DD') as event_date,
            e.organizer_id, o.logo is not null as has_logo, extract(epoch from o.logo_updated_at)::bigint::text as logo_version,
            to_char(a.valid_until, 'YYYY-MM-DD') as valid_until, a.pin_hash, a.device_hash, a.locked_until,
            coalesce(a.locked_until > now(), false) as locked,
            (a.revoked_at is null and a.valid_until >= ${TODAY_SQL}) as usable
       from app.ticket_access a
       join app.ticket_sellers s on s.id = a.seller_id
       join app.ticket_events e on e.id = a.event_id
       join app.ticket_organizers o on o.id = e.organizer_id
      where a.token_hash = $1`,
    [sha256hex(token)]
  );
  return result.rows[0] ?? null;
}

function describe(access: AccessRow, deviceId: string | undefined): AccessState {
  if (!access.usable) return { state: "encerrado" };
  if (access.device_hash && (!deviceId || sha256hex(deviceId) !== access.device_hash)) return { state: "outro_aparelho" };
  const base = {
    seller_name: access.seller_name, event_name: access.event_name, event_date: access.event_date, valid_until: access.valid_until,
    logo_url: logoUrl({ organizer_id: access.organizer_id, has_logo: access.has_logo, logo_version: access.logo_version })
  };
  if (!access.pin_hash || !access.device_hash) return { state: "criar_pin", ...base };
  if (access.locked) {
    const minutes = Math.max(1, Math.ceil((new Date(access.locked_until as string).getTime() - Date.now()) / 60_000));
    return { state: "bloqueado_pin", ...base, minutes };
  }
  return { state: "pin", ...base };
}

/** Abrir o link: diz o que a página deve pedir (criar PIN, PIN, outro aparelho ou encerrado). */
export async function openAccess(token: string, deviceId: string | undefined, ip: string) {
  const key = ipKey(null, ip);
  await assertRateLimit("acesso", key);
  const access = token.length >= 20 && token.length <= 100 ? await findAccess(token) : null;
  if (!access) {
    await recordRateHit("acesso", key);
    return { state: "encerrado" } as AccessState;
  }
  return describe(access, deviceId);
}

const pinSchema = z.string().regex(/^\d{4}$/, "O PIN tem 4 números.");

type SessionResult = { session: string; device: string; state: AccessState };

async function openSession(client: Parameters<Parameters<typeof transaction>[0]>[0], accessId: string) {
  const session = newToken(32);
  await client.query(
    "insert into app.ticket_seller_sessions (access_id, token_hash, expires_at) values ($1, $2, now() + make_interval(hours => $3))",
    [accessId, sha256hex(session), SESSION_HOURS]);
  await client.query("update app.ticket_access set last_access_at = now(), pin_failures = 0, locked_until = null where id = $1", [accessId]);
  return session;
}

/** Primeiro acesso: cria o PIN e prende o link a este aparelho (só um aparelho consegue). */
export async function createPin(token: string, deviceId: string | undefined, body: unknown, ip: string): Promise<SessionResult> {
  const input = z.object({ pin: pinSchema, confirm: z.string() }).parse(body);
  if (input.pin !== input.confirm) throw new AppError("Os dois PINs não são iguais. Digite de novo.");
  await assertRateLimit("acesso", ipKey(null, ip));
  const access = await findAccess(token);
  if (!access || !access.usable) throw new AppError(ACCESS_ENDED, 410, "ACCESS_ENDED");
  const device = deviceId && deviceId.length >= 32 ? deviceId : newToken(32);
  const pinHash = await hashPin(input.pin);
  return transaction(async (client) => {
    const claimed = await client.query(
      `update app.ticket_access set pin_hash = $2, device_hash = $3, first_access_at = coalesce(first_access_at, now())
        where id = $1 and revoked_at is null and (device_hash is null or pin_hash is null) and (device_hash is null or device_hash = $3)`,
      [access.id, pinHash, sha256hex(device)]);
    if (!claimed.rowCount) throw new AppError("Este acesso já está em uso em outro celular. Peça um novo link à coordenação.", 409, "OTHER_DEVICE");
    const session = await openSession(client, access.id);
    await appendAudit({ name: `${access.seller_name} (trabalhador)`, role: "vendedor_ingressos" }, {
      category: "Acesso", action: "Primeiro acesso de vendedor", module: MODULE, section: SECTION, entityType: "ticket_access", entityId: access.id
    }, client);
    return { session, device, state: describe({ ...access, pin_hash: pinHash, device_hash: sha256hex(device) }, device) };
  });
}

export async function enterPin(token: string, deviceId: string | undefined, body: unknown, ip: string): Promise<SessionResult> {
  const { pin } = z.object({ pin: pinSchema }).parse(body);
  const key = ipKey(null, ip);
  await assertRateLimit("pin", key);
  const access = await findAccess(token);
  if (!access || !access.usable) throw new AppError(ACCESS_ENDED, 410, "ACCESS_ENDED");
  const state = describe(access, deviceId);
  if (state.state === "outro_aparelho") throw new AppError("Este acesso já está em uso em outro celular. Peça um novo link à coordenação.", 409, "OTHER_DEVICE");
  if (state.state === "bloqueado_pin") throw new AppError(`PIN bloqueado por muitas tentativas. Tente de novo em ${state.minutes} min.`, 429, "PIN_LOCKED");
  if (state.state !== "pin") throw new AppError("Crie o seu PIN primeiro.", 409, "NO_PIN");
  if (!(await verifyPin(pin, access.pin_hash))) {
    await recordRateHit("pin", key);
    const failed = await query<{ pin_failures: number; locked: boolean }>(
      `update app.ticket_access set
              pin_failures = case when pin_failures + 1 >= 5 then 0 else pin_failures + 1 end,
              locked_until = case when pin_failures + 1 >= 5 then now() + interval '15 minutes' else locked_until end
        where id = $1 returning pin_failures, locked_until > now() as locked`, [access.id]);
    const row = failed.rows[0];
    if (row?.locked) throw new AppError("PIN bloqueado por 15 minutos depois de 5 tentativas erradas.", 429, "PIN_LOCKED");
    throw new AppError(`PIN errado. Restam ${5 - (row?.pin_failures ?? 0)} tentativa(s).`, 401, "WRONG_PIN");
  }
  return transaction(async (client) => ({ session: await openSession(client, access.id), device: deviceId as string, state }));
}
