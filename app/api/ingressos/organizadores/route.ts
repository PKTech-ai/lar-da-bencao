import { listOrganizers, saveOrganizer } from "@/lib/ingressos/eventos";
import { ingressosRoute, jsonBody } from "@/lib/ingressos/rota";

export const GET = ingressosRoute(async (_request, op) => listOrganizers(op));
export const POST = ingressosRoute(async (request, op) => saveOrganizer(op, await jsonBody(request)), 201);
