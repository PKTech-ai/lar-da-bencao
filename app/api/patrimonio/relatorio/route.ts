import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";
import { patrimonyReport, requirePatrimony } from "@/lib/patrimonio";

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    await requirePatrimony(actor, "read");
    const year = z.coerce.number().int().min(1900).max(2199).parse(new URL(request.url).searchParams.get("year") ?? new Date().getFullYear());
    return Response.json(await patrimonyReport(year), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
