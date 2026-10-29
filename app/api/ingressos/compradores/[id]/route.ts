import { ingressosRoute, jsonBody } from "@/lib/ingressos/rota";
import { updateBuyer } from "@/lib/ingressos/vendas";

export const PUT = ingressosRoute<{ id: string }>(async (request, op, { id }) => updateBuyer(op, id, await jsonBody(request)));
