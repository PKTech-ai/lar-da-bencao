import { requireActor } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";
import { listAccounts, requireTreasury } from "@/lib/treasury";

export async function GET() {
  try {
    const actor = await requireActor();
    await requireTreasury(actor, "read", ["plano-de-contas", "caixa", "lancamentos", "extrato", "contribuicoes"]);
    return Response.json({ accounts: await listAccounts() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
