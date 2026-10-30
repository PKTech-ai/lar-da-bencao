import { requireActor } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";
import { pendingFor } from "@/lib/pendencias";

/** Feed de pendências do usuário: só o que ele pode abrir, com o módulo ligado. */
export async function GET() {
  try {
    const pending = await pendingFor(await requireActor());
    return Response.json({ pending }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
