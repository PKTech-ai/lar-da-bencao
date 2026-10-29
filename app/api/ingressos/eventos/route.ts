import { listEvents, saveEvent } from "@/lib/ingressos/eventos";
import { ingressosRoute, jsonBody } from "@/lib/ingressos/rota";

export const GET = ingressosRoute(async (_request, op) => listEvents(op));
export const POST = ingressosRoute(async (request, op) => saveEvent(op, await jsonBody(request)), 201);
