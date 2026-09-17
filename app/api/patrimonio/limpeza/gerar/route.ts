import { requireActor } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { errorResponse } from "@/lib/errors";
import { generateCleaning, requirePatrimony } from "@/lib/patrimonio";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    await requirePatrimony(actor, "create");
    return Response.json(await generateCleaning(actor, await request.json()));
  } catch (error) {
    return errorResponse(error);
  }
}
