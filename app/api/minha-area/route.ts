import { requireActor } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";
import { loadMyArea } from "@/lib/my-area";

/** Minha área: cadastro, contribuições e escalas da própria pessoa. */
export async function GET() {
  try {
    const actor = await requireActor();
    return Response.json(await loadMyArea(actor), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
