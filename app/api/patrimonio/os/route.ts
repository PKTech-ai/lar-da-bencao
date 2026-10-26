import { requireActor } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { errorResponse } from "@/lib/errors";
import { createServiceOrder, listServiceOrders } from "@/lib/ordens-servico";

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const params = new URL(request.url).searchParams;
    const body = await listServiceOrders(actor, {
      department: params.get("department")?.trim().slice(0, 40) || undefined,
      status: params.get("status")?.trim().slice(0, 20) || undefined,
      q: params.get("q")?.trim().slice(0, 100) || undefined
    });
    return Response.json(body, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    return Response.json(await createServiceOrder(actor, await request.json()), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
