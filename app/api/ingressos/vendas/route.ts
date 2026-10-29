import { ingressosRoute, jsonBody } from "@/lib/ingressos/rota";
import { createSale, mySales } from "@/lib/ingressos/vendas";

/** GET: vendas do próprio vendedor no evento (Minhas vendas). POST: venda em 3 toques. */
export const GET = ingressosRoute(async (_request, op) => mySales(op));
export const POST = ingressosRoute(async (request, op) => createSale(op, await jsonBody(request)), 201);
