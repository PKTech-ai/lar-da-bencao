import { requireActor } from "@/lib/auth";
import { query } from "@/lib/db";
import { errorResponse } from "@/lib/errors";

/** Situação de segurança da própria conta (titular). */
export async function GET() {
  try {
    const actor = await requireActor();
    const events = await query(
      `select occurred_at, action, result, masked_ip, actor_user_id = $1 as by_me
         from app.audit_events
        where category = 'Segurança' and (actor_user_id = $1 or (entity_type = 'user' and entity_id = $1::text))
        order by occurred_at desc limit 20`,
      [actor.id]
    );
    return Response.json({
      name: actor.name,
      email: actor.email,
      role: actor.role,
      events: events.rows
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
