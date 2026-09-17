import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { errorResponse } from "@/lib/errors";
import { decideMessage, requireWhatsapp } from "@/lib/whatsapp";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const id = z.string().uuid().parse((await context.params).id);
    const body = (await request.json()) as { scope?: string };
    await requireWhatsapp(actor, String(body.scope), "update");
    await decideMessage(actor, id, body);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
