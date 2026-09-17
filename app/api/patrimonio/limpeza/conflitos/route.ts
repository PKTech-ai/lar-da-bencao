import { requireActor } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { errorResponse } from "@/lib/errors";
import { keepCleaningConflict, requirePatrimony } from "@/lib/patrimonio";

/** Mantém a repetição anual de um trabalhador (decisão registrada no Dedo-duro). */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    await requirePatrimony(actor, "update");
    return Response.json({ kept: await keepCleaningConflict(actor, await request.json()) });
  } catch (error) {
    return errorResponse(error);
  }
}
