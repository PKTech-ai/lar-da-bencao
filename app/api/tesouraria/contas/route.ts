import { requireActor } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";
import { listAccounts, requireTreasury } from "@/lib/treasury";

export async function GET() {
  try {
    const actor = await requireActor();
    await requireTreasury(actor, "read");
    return Response.json({ accounts: await listAccounts() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
