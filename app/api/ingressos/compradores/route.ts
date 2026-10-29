import { ingressosRoute } from "@/lib/ingressos/rota";
import { findBuyerByWhatsapp, recentBuyers } from "@/lib/ingressos/vendas";

/** ?whatsapp=92991234567 → comprador já cadastrado (ou null); sem parâmetro → "Compraram com você". */
export const GET = ingressosRoute(async (request, op) => {
  const whatsapp = new URL(request.url).searchParams.get("whatsapp");
  return whatsapp !== null ? findBuyerByWhatsapp(op, whatsapp.slice(0, 40)) : { recent: await recentBuyers(op) };
});
