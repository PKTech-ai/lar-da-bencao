import { requireActor } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { AuthorizationError, errorResponse } from "@/lib/errors";
import { requireFlag } from "@/lib/feature-flags";
import { canDecideDisposals, canReadDisposals, eligibleAssets, listDisposals, PATRIMONY_FLAG, requestDisposal, requirePatrimony } from "@/lib/patrimonio";
import { hasPermission } from "@/lib/permissions";

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    await requireFlag(PATRIMONY_FLAG);
    if (!(await canReadDisposals(actor))) throw new AuthorizationError();
    const params = new URL(request.url).searchParams;
    const status = params.get("status") ?? "";
    const [requests, canRequest, canDecide] = await Promise.all([
      listDisposals({ status: ["pending", "approved", "rejected", "cancelled"].includes(status) ? status : undefined, q: params.get("q")?.trim().slice(0, 100) || undefined }),
      hasPermission(actor, "department", "update", "patrimonio"),
      canDecideDisposals(actor)
    ]);
    const assets = canRequest ? await eligibleAssets() : [];
    return Response.json({ requests, assets, capabilities: { request: canRequest, decide: canDecide } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    await requirePatrimony(actor, "update");
    return Response.json(await requestDisposal(actor, await request.json()), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
