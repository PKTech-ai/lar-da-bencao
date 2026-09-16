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
  const appError = error instanceof AppError ? error : new AppError("Não foi possível concluir a operação.", 500, "INTERNAL_ERROR");
  if (!(error instanceof AppError)) console.error(error);
  return Response.json(
    { error: appError.message, code: appError.code },
    { status: appError.status, headers: { "Cache-Control": "private, no-store" } }
  );
}
