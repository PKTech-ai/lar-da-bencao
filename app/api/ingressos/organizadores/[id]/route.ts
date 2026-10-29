import { saveOrganizer } from "@/lib/ingressos/eventos";
import { ingressosRoute, jsonBody } from "@/lib/ingressos/rota";

export const PUT = ingressosRoute<{ id: string }>(async (request, op, { id }) => saveOrganizer(op, await jsonBody(request), id));
