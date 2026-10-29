import { assertSameOrigin } from "@/lib/csrf";
import { errorResponse } from "@/lib/errors";
import { resolveOperator, type Operator } from "@/lib/ingressos/acesso";

/**
 * Rotas do módulo de Ingressos: resolvem o operador (usuário logado ou trabalhador com sessão do link),
 * conferem a origem nas gravações e respondem JSON sem cache. As permissões ficam nas funções de lib/ingressos.
 */
export function ingressosRoute<P = Record<string, string>>(
  handler: (request: Request, op: Operator, params: P) => Promise<unknown>,
  status = 200
) {
  return async (request: Request, context: { params: Promise<P> }) => {
    try {
      if (request.method !== "GET" && request.method !== "HEAD") assertSameOrigin(request);
      const op = await resolveOperator(request);
      const body = await handler(request, op, await context.params);
      return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export const jsonBody = async (request: Request) => request.json().catch(() => ({}));
