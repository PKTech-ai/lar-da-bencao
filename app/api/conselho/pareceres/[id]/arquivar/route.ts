import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { errorResponse } from "@/lib/errors";
import { requireFlag } from "@/lib/feature-flags";
import { assertPermission } from "@/lib/permissions";
import { lockFiscalReview } from "@/lib/treasury";

/** Arquiva a decisão do Conselho Fiscal (trava o parecer e a competência). */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    await requireFlag("module_conselho_fiscal");
    await assertPermission(actor, "conselho_fiscal", "update");
    await lockFiscalReview(actor, z.string().uuid().parse((await context.params).id));
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
