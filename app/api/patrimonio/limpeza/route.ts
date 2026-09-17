import { requireActor } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { errorResponse } from "@/lib/errors";
import { createCleaning, listCleaning, requirePatrimony } from "@/lib/patrimonio";
import { hasPermission } from "@/lib/permissions";

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    await requirePatrimony(actor, "read");
    const params = new URL(request.url).searchParams;
    const year = new Date().getFullYear();
    const data = await listCleaning(params.get("start") ?? `${year}-01`, params.get("end") ?? `${year}-12`);
    const canEdit = await hasPermission(actor, "department", "update", "patrimonio");
    return Response.json({ ...data, capabilities: { edit: canEdit } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    await requirePatrimony(actor, "create");
    return Response.json(await createCleaning(actor, await request.json()), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
