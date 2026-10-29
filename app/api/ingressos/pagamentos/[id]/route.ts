import { ingressosRoute, jsonBody } from "@/lib/ingressos/rota";
import { reversePayment } from "@/lib/ingressos/vendas";

/** Estorno (Coordenação): { reason }. */
export const POST = ingressosRoute<{ id: string }>(async (request, op, { id }) => reversePayment(op, id, await jsonBody(request)));
