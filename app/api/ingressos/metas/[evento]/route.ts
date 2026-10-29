import { addSeller, goalsPanel, saveGoals } from "@/lib/ingressos/metas";
import { ingressosRoute, jsonBody } from "@/lib/ingressos/rota";

type P = { evento: string };
export const GET = ingressosRoute<P>(async (_request, op, { evento }) => goalsPanel(op, evento));
/** Meta do evento e metas dos trabalhadores. */
export const PUT = ingressosRoute<P>(async (request, op, { evento }) => saveGoals(op, evento, await jsonBody(request)));
/** Adicionar trabalhador (ficha da Casa ou nome + WhatsApp). */
export const POST = ingressosRoute<P>(async (request, op, { evento }) => addSeller(op, evento, await jsonBody(request)), 201);
