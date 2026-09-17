import { requireActor } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { errorResponse } from "@/lib/errors";
import { canCloseMonth, changeMonthStatus, monthSchema, monthSummary, requireTreasury } from "@/lib/treasury";

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    await requireTreasury(actor, "read");
    const month = new URL(request.url).searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
    const [summary, canClose] = await Promise.all([monthSummary(monthSchema.parse(month)), canCloseMonth(actor)]);
    return Response.json({ ...summary, capabilities: { close: canClose } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    await requireTreasury(actor, "update");
    return Response.json(await changeMonthStatus(actor, await request.json()));
  } catch (error) {
    return errorResponse(error);
  }
}
