import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { errorResponse } from "@/lib/errors";
import { actOnServiceOrder } from "@/lib/ordens-servico";

const idSchema = z.string().uuid();

/** `{ action: "status" | "note" | "cancel", ... }` — posição do Patrimônio ou do departamento que abriu. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const id = idSchema.parse((await context.params).id);
    return Response.json(await actOnServiceOrder(actor, id, await request.json()));
  } catch (error) {
    return errorResponse(error);
  }
}
