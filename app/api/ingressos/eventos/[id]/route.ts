import { changeEventStatus, eventDetail, saveEvent } from "@/lib/ingressos/eventos";
import { ingressosRoute, jsonBody } from "@/lib/ingressos/rota";

type P = { id: string };
export const GET = ingressosRoute<P>(async (_request, op, { id }) => eventDetail(op, id));
export const PUT = ingressosRoute<P>(async (request, op, { id }) => saveEvent(op, await jsonBody(request), id));
/** { action: "ativar" | "encerrar" | "excluir" } */
export const POST = ingressosRoute<P>(async (request, op, { id }) => changeEventStatus(op, id, await jsonBody(request)));
