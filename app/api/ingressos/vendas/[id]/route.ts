import { z } from "zod";
import { ingressosRoute, jsonBody } from "@/lib/ingressos/rota";
import { addPayment, cancelSale, chargeSale, resendSale, saleDetail, setDueDate, undoSale } from "@/lib/ingressos/vendas";

type P = { id: string };
const actionSchema = z.object({ action: z.enum(["desfazer", "cancelar", "reenviar", "cobrar", "pagamento", "vencimento"]) });

export const GET = ingressosRoute<P>(async (_request, op, { id }) => saleDetail(op, id));
export const POST = ingressosRoute<P>(async (request, op, { id }) => {
  const body = await jsonBody(request);
  const { action } = actionSchema.parse(body);
  switch (action) {
    case "desfazer": return undoSale(op, id);
    case "cancelar": return cancelSale(op, id, body);
    case "reenviar": return resendSale(op, id);
    case "cobrar": return chargeSale(op, id);
    case "pagamento": return addPayment(op, id, body);
    case "vencimento": return setDueDate(op, id, body);
  }
});
