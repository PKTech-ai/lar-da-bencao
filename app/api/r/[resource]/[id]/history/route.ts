import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";
import { recordHistory, requireResource, resolveResource } from "@/lib/resources/server";

export async function GET(_request: Request, context: { params: Promise<{ resource: string; id: string }> }) {
  try {
    const actor = await requireActor();
    const { resource, id } = await context.params;
    const def = resolveResource(resource);
    await requireResource(actor, def, "read");
    return Response.json({ history: await recordHistory(def, z.string().uuid().parse(id)) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
