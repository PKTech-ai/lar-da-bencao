import { requireActor } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";
import { homeCards, institution, institutionalMemory, myArea } from "@/lib/home";
import { departmentCards } from "@/lib/paineis";
import { todayInSaoPaulo } from "@/lib/workers";

/** Visão Geral: memória institucional, indicadores no escopo da pessoa, números dos departamentos que ela abre e a área dela. */
export async function GET() {
  try {
    const actor = await requireActor();
    const [house, cards, area, departamentos] = await Promise.all([institution(), homeCards(actor), myArea(actor), departmentCards(actor)]);
    return Response.json(
      { institution: house, memory: institutionalMemory(house.founded_on, todayInSaoPaulo()), cards, myArea: area, departamentos },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
