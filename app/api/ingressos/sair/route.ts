import { cookies } from "next/headers";
import { assertSameOrigin } from "@/lib/csrf";
import { query } from "@/lib/db";
import { errorResponse } from "@/lib/errors";
import { SESSION_COOKIE, sha256hex } from "@/lib/ingressos/acesso";

/** Sair do acesso do trabalhador (o aparelho continua vinculado; na volta pede o PIN). */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const store = await cookies();
    const session = store.get(SESSION_COOKIE)?.value;
    if (session) await query("update app.ticket_seller_sessions set revoked_at = now() where token_hash = $1 and revoked_at is null", [sha256hex(session)]);
    store.delete(SESSION_COOKIE);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
