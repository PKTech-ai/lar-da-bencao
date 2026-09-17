import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { errorResponse } from "@/lib/errors";
import { listMessages, queueMessage, requireWhatsapp } from "@/lib/whatsapp";

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const scope = z.enum(["tesouraria", "doutrina"]).parse(new URL(request.url).searchParams.get("scope") ?? "tesouraria");
    await requireWhatsapp(actor, scope, "read");
    return Response.json({ messages: await listMessages(scope) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const body = (await request.json()) as { scope?: string };
    await requireWhatsapp(actor, String(body.scope), "create");
    return Response.json(await queueMessage(actor, body), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
