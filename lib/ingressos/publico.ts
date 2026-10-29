import { query } from "@/lib/db";
import { assertRateLimit, ipKey, recordRateHit, sha256hex } from "@/lib/ingressos/acesso";
import { logoUrl } from "@/lib/ingressos/dados";
import { addDays, firstName, todayManaus, type EventKind } from "@/lib/ingressos/regras";

/**
 * Página pública dos ingressos (RF-16): sem login, só leitura, nunca mostra valores, saldo,
 * vencimento, WhatsApp ou vendedor. Token inválido → página genérica.
 */
export type PublicTickets =
  | { state: "invalido" }
  | { state: "passou" }
  | { state: "cancelado"; event_name: string; organizer_name: string; logo_url: string }
  | {
      state: "ok"; event_name: string; organizer_name: string; logo_url: string; kind: EventKind; event_date: string; event_time: string; place: string;
      first_name: string; tickets: { number: number; code: string; token: string; delivered_at: string | null }[];
    };

export async function publicTickets(token: string, ip: string): Promise<PublicTickets> {
  const key = ipKey(null, ip);
  try {
    await assertRateLimit("link", key);
  } catch {
    return { state: "invalido" };
  }
  const found = /^[A-Za-z0-9_-]{20,64}$/.test(token) ? await query<{
    sale_id: string; cancelled: boolean; buyer_name: string; event_name: string; organizer_name: string; organizer_id: string;
    has_logo: boolean; logo_version: string | null; kind: EventKind; event_date: string; event_time: string; place: string;
  }>(
    `select v.id as sale_id, v.cancelled_at is not null as cancelled, b.name as buyer_name, e.name as event_name, o.name as organizer_name,
            o.id as organizer_id, o.logo is not null as has_logo, extract(epoch from o.logo_updated_at)::bigint::text as logo_version,
            e.kind, to_char(e.event_date, 'YYYY-MM-DD') as event_date, e.event_time, e.place
       from app.ticket_sale_links l
       join app.ticket_sales v on v.id = l.sale_id
       join app.ticket_buyers b on b.id = v.buyer_id
       join app.ticket_events e on e.id = v.event_id
       join app.ticket_organizers o on o.id = e.organizer_id
      where l.token_hash = $1`, [sha256hex(token)]) : null;
  const row = found?.rows[0];
  if (!row) {
    await recordRateHit("link", key);
    return { state: "invalido" };
  }
  if (todayManaus() > addDays(row.event_date, 7)) return { state: "passou" };
  const logo = logoUrl({ organizer_id: row.organizer_id, has_logo: row.has_logo, logo_version: row.logo_version });
  if (row.cancelled) return { state: "cancelado", event_name: row.event_name, organizer_name: row.organizer_name, logo_url: logo };
  const tickets = await query<{ number: number; code: string; token: string; delivered_at: string | null }>(
    "select number, code, token, delivered_at from app.ticket_tickets where sale_id = $1 order by number", [row.sale_id]);
  return {
    state: "ok", event_name: row.event_name, organizer_name: row.organizer_name, logo_url: logo, kind: row.kind,
    event_date: row.event_date, event_time: row.event_time, place: row.place, first_name: firstName(row.buyer_name), tickets: tickets.rows
  };
}
