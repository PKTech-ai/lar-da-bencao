import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { registerReturn } from "@/lib/bookshop";
import { assertSameOrigin } from "@/lib/csrf";
import { errorResponse } from "@/lib/errors";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const id = z.string().uuid().parse((await context.params).id);
    return Response.json(await registerReturn(actor, id, await request.json()), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
