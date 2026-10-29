import { ingressosRoute } from "@/lib/ingressos/rota";
import { deliver, undoDelivery } from "@/lib/ingressos/validar";

type P = { id: string };
/** Entregar a refeição (atômico). */
export const POST = ingressosRoute<P>(async (_request, op, { id }) => deliver(op, id));
/** Desfazer entrega (Coordenação). */
export const DELETE = ingressosRoute<P>(async (_request, op, { id }) => undoDelivery(op, id));
