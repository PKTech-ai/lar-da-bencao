import { requireActor } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";
import { homeCards, institution, institutionalMemory, myArea } from "@/lib/home";
import { todayInSaoPaulo } from "@/lib/workers";

/** Visão Geral: memória institucional, indicadores no escopo da pessoa e a área dela. */
export async function GET() {
  try {
    const actor = await requireActor();
    const [house, cards, area] = await Promise.all([institution(), homeCards(actor), myArea(actor)]);
    return Response.json(
      { institution: house, memory: institutionalMemory(house.founded_on, todayInSaoPaulo()), cards, myArea: area },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
