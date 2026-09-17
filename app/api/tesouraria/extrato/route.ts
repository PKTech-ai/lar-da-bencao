import { requireActor } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { errorResponse } from "@/lib/errors";
import { importStatement, monthSchema, requireTreasury, statementLines } from "@/lib/treasury";

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    await requireTreasury(actor, "read");
    const month = monthSchema.parse(new URL(request.url).searchParams.get("month") ?? new Date().toISOString().slice(0, 7));
    return Response.json({ lines: await statementLines(month) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    await requireTreasury(actor, "create");
    return Response.json(await importStatement(actor, await request.json()), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
