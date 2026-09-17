import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { errorResponse } from "@/lib/errors";
import { archiveRecord, getRecord, requireResource, resolveResource, updateRecord } from "@/lib/resources/server";

type Params = { params: Promise<{ resource: string; id: string }> };

async function resolve(context: Params) {
  const { resource, id } = await context.params;
  return { def: resolveResource(resource), id: z.string().uuid().parse(id) };
}

export async function GET(_request: Request, context: Params) {
  try {
    const actor = await requireActor();
    const { def, id } = await resolve(context);
    await requireResource(actor, def, "read");
    return Response.json({ record: await getRecord(def, id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: Params) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const { def, id } = await resolve(context);
    await requireResource(actor, def, "update");
    await updateRecord(def, actor, id, await request.json());
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Arquiva (ou restaura com `restore: true`). Registros nunca são apagados. */
export async function DELETE(request: Request, context: Params) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const { def, id } = await resolve(context);
    await requireResource(actor, def, "delete");
    await archiveRecord(def, actor, id, await request.json());
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
