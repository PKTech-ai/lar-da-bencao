import { moduleContext } from "@/lib/ingressos/eventos";
import { ingressosRoute } from "@/lib/ingressos/rota";

export const GET = ingressosRoute(async (_request, op) => moduleContext(op));
