import { requireActor } from "@/lib/auth";
import { bookshopSummary, BOOKSHOP_FLAG } from "@/lib/bookshop";
import { errorResponse } from "@/lib/errors";
import { requireFlag } from "@/lib/feature-flags";
import { assertModule } from "@/lib/permissions";

export async function GET() {
  try {
    const actor = await requireActor();
    await requireFlag(BOOKSHOP_FLAG);
    await assertModule(actor, "divulgacao", ["painel", "obras", "estoque", "emprestimos", "vendas"], "read");
    return Response.json(await bookshopSummary(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
