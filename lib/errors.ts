import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = "BAD_REQUEST"
  ) {
    super(message);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Autenticação necessária.", code = "UNAUTHENTICATED") {
    super(message, 401, code);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "Seu perfil não permite esta operação.") {
    super(message, 403, "FORBIDDEN");
  }
}

export function errorResponse(error: unknown) {
  // Protocolo curto para o suporte localizar o erro no log sem expor detalhes técnicos (RF-015).
  const protocol = crypto.randomUUID().slice(0, 8).toUpperCase();
  const appError = error instanceof AppError
    ? error
    : error instanceof ZodError
      ? new AppError("Dados inválidos. Revise os campos e tente novamente.", 400, "VALIDATION_ERROR")
      : new AppError(`Não foi possível concluir a operação. Informe ao suporte o protocolo ${protocol}.`, 500, "INTERNAL_ERROR");
  if (!(error instanceof AppError) && !(error instanceof ZodError)) console.error(`[protocolo ${protocol}]`, error);
  return Response.json(
    { error: appError.message, code: appError.code, ...(appError.status >= 500 ? { protocol } : {}) },
    { status: appError.status, headers: { "Cache-Control": "private, no-store" } }
  );
}
