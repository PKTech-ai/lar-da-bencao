import { requireActor } from "@/lib/auth";
import { bookshopSummary, BOOKSHOP_FLAG } from "@/lib/bookshop";
import { errorResponse } from "@/lib/errors";
import { requireFlag } from "@/lib/feature-flags";
import { assertPermission } from "@/lib/permissions";

export async function GET() {
  try {
    const actor = await requireActor();
    await requireFlag(BOOKSHOP_FLAG);
    await assertPermission(actor, "department", "read", "divulgacao");
    return Response.json(await bookshopSummary(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
