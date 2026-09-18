import { requireActor } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { errorResponse } from "@/lib/errors";
import { contributionsForMonth, monthSchema, requireTreasury, saveContribution } from "@/lib/treasury";
import { hasPermission } from "@/lib/permissions";

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    await requireTreasury(actor, "read");
    const month = monthSchema.parse(new URL(request.url).searchParams.get("month") ?? new Date().toISOString().slice(0, 7));
    const [grid, canEdit] = await Promise.all([contributionsForMonth(month), hasPermission(actor, "tesouraria", "update")]);
    return Response.json({ ...grid, capabilities: { edit: canEdit } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    await requireTreasury(actor, "update");
    await saveContribution(actor, await request.json());
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
