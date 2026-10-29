import { z } from "zod";
import {
  blockAccess, extendAccess, registerSettlement, remindSeller, removeSeller, sellerDetail, sendAccess
} from "@/lib/ingressos/metas";
import { ingressosRoute, jsonBody } from "@/lib/ingressos/rota";

type P = { evento: string; vendedor: string };
const actionSchema = z.object({ action: z.enum(["enviar", "prorrogar", "bloquear", "lembrar", "acerto", "remover"]) });

export const GET = ingressosRoute<P>(async (_request, op, { evento, vendedor }) => sellerDetail(op, evento, vendedor));
export const POST = ingressosRoute<P>(async (request, op, { evento, vendedor }) => {
  const body = await jsonBody(request);
  const { action } = actionSchema.parse(body);
  switch (action) {
    case "enviar": return sendAccess(op, evento, vendedor, body);
    case "prorrogar": return extendAccess(op, evento, vendedor, body);
    case "bloquear": return blockAccess(op, evento, vendedor);
    case "lembrar": return remindSeller(op, evento, vendedor);
    case "acerto": return registerSettlement(op, evento, vendedor, body);
    case "remover": return removeSeller(op, evento, vendedor);
  }
});
