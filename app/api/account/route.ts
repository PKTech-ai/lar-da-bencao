import { requireActor } from "@/lib/auth";
import { query } from "@/lib/db";
import { errorResponse } from "@/lib/errors";
import { REAUTH_WINDOW_SECONDS } from "@/lib/sessions";
import { createClient } from "@/lib/supabase/server";

/** Situação de segurança da própria conta (titular). */
export async function GET() {
  try {
    const actor = await requireActor();
    const supabase = await createClient();
    const factors = await supabase.auth.mfa.listFactors();
    const [codes, events] = await Promise.all([
      query<{ remaining: number }>("select count(*)::int as remaining from app.mfa_recovery_codes where user_id=$1 and used_at is null", [actor.id]),
      query(
        `select occurred_at, action, result, masked_ip, actor_user_id = $1 as by_me
           from app.audit_events
          where category = 'Segurança' and (actor_user_id = $1 or (entity_type = 'user' and entity_id = $1::text))
          order by occurred_at desc limit 20`,
        [actor.id]
      )
    ]);
    return Response.json({
      name: actor.name,
      email: actor.email,
      role: actor.role,
      factors: (factors.data?.totp ?? []).map((f) => ({ id: f.id, name: f.friendly_name ?? "Autenticador", created_at: f.created_at, status: f.status })),
      recoveryCodesRemaining: codes.rows[0]?.remaining ?? 0,
      totpAt: actor.totpAt ?? null,
      reauthWindowSeconds: REAUTH_WINDOW_SECONDS,
      events: events.rows
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
