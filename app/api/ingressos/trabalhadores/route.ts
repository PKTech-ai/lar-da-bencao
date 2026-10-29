import { searchWorkers } from "@/lib/ingressos/metas";
import { ingressosRoute } from "@/lib/ingressos/rota";

/** Busca no cadastro de trabalhadores da Casa para incluir nas metas. */
export const GET = ingressosRoute(async (request, op) => ({ workers: await searchWorkers(op, new URL(request.url).searchParams.get("q") ?? "") }));
