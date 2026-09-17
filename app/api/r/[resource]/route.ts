import { requireActor } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { errorResponse } from "@/lib/errors";
import { createRecord, listRecords, requireResource, resolveResource, resourceCapabilities } from "@/lib/resources/server";

type Params = { params: Promise<{ resource: string }> };

export async function GET(request: Request, context: Params) {
  try {
    const actor = await requireActor();
    const def = resolveResource((await context.params).resource);
    await requireResource(actor, def, "read");
    const [records, capabilities] = await Promise.all([listRecords(def, new URL(request.url).searchParams), resourceCapabilities(actor, def)]);
    return Response.json({ records, capabilities }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: Params) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const def = resolveResource((await context.params).resource);
    await requireResource(actor, def, "create");
    const id = await createRecord(def, actor, await request.json());
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
