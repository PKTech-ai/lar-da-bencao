import { cashbox } from "@/lib/ingressos/caixa";
import { ingressosRoute } from "@/lib/ingressos/rota";

export const GET = ingressosRoute(async (request, op) => cashbox(op, new URL(request.url).searchParams.get("evento")));
