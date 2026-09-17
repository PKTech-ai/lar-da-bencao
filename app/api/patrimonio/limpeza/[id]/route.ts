import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { errorResponse } from "@/lib/errors";
import { requirePatrimony, updateCleaning } from "@/lib/patrimonio";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    await requirePatrimony(actor, "update");
    await updateCleaning(actor, z.string().uuid().parse((await context.params).id), await request.json());
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
