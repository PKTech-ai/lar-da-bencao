import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { errorResponse } from "@/lib/errors";
import { requireFlag } from "@/lib/feature-flags";
import { cancelDisposal, decideDisposal, PATRIMONY_FLAG, requirePatrimony } from "@/lib/patrimonio";

const idSchema = z.string().uuid();

/** `{ action: "decide" | "cancel", ... }` — decisão da Diretoria ou cancelamento pelo Patrimônio. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const id = idSchema.parse((await context.params).id);
    const body = (await request.json()) as { action?: string };
    if (body.action === "decide") {
      await requireFlag(PATRIMONY_FLAG);
      await decideDisposal(actor, id, body);
    } else {
      await requirePatrimony(actor, "update");
      await cancelDisposal(actor, id, body);
    }
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
