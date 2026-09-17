import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { query } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

const schema = z.object({ version: z.string().min(4).max(40) });

export async function GET() {
  try {
    const actor = await requireActor({ requireMfa: false });
    const result = await query<{ accepted_at: string }>(
      "select accepted_at from app.terms_acceptances where user_id=$1 and terms_version=$2",
      [actor.id, CURRENT_TERMS_VERSION]
    );
    return Response.json({
      version: CURRENT_TERMS_VERSION,
      accepted: Boolean(result.rows[0]),
      acceptedAt: result.rows[0]?.accepted_at ?? null
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  let actor = null;
  try {
    assertSameOrigin(request);
    actor = await requireActor({ requireMfa: false });
    const input = schema.parse(await request.json());
    if (input.version !== CURRENT_TERMS_VERSION) throw new AppError("Os termos foram atualizados. Recarregue a página e leia a versão atual.", 409, "TERMS_OUTDATED");
    await query(
      `insert into app.terms_acceptances (user_id, terms_version)
       values ($1,$2)
       on conflict (user_id, terms_version) do nothing`,
      [actor.id, CURRENT_TERMS_VERSION]
    );
    await appendAudit(actor, {
      category: "Segurança",
      action: "Aceite de termos",
      module: "Controle de Acesso",
      entityType: "terms",
      entityId: input.version,
      details: `Versão ${input.version}`
    });
    return Response.json({ status: "accepted" });
  } catch (error) {
    return errorResponse(error);
  }
}
