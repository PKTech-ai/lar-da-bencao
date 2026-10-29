import { ingressosRoute } from "@/lib/ingressos/rota";
import { lookup } from "@/lib/ingressos/validar";

/** ?q= código de 4 caracteres, conteúdo do QR (TKT:...) ou nome do comprador. */
export const GET = ingressosRoute(async (request, op) => lookup(op, new URL(request.url).searchParams.get("q") ?? ""));
