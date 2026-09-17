import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";
import { requireTreasury, treasuryReport } from "@/lib/treasury";

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    await requireTreasury(actor, "read");
    const year = z.coerce.number().int().min(1900).max(2199).parse(new URL(request.url).searchParams.get("year") ?? new Date().getFullYear());
    return Response.json(await treasuryReport(year), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
