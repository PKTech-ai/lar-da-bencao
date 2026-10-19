import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = "BAD_REQUEST"
  ) {
    super(message);
    this.name = "AppError";
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

/** Tira pedido de suporte e número de protocolo. O que fica é o que aconteceu. */
export function plainFailure(message: string) {
  const cleaned = message
    .replace(/informe ao suporte[^.]*\.?/gi, "")
    .replace(/protocolo[:\s]*[A-Z0-9]+/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.])/g, "$1")
    .trim();
  return cleaned || "A operação falhou. Tente de novo.";
}

function where(error: object) {
  const address = "address" in error && error.address ? String(error.address) : "";
  const port = "port" in error && error.port ? String(error.port) : "";
  return address && port ? ` em ${address}:${port}` : "";
}

/** Frase que a tela pode mostrar, no lugar do texto genérico de suporte. */
export function failureMessage(error: unknown): string {
  if (error instanceof AppError) return plainFailure(error.message);
  if (error instanceof ZodError) {
    const message = error.issues.find((issue) => issue.message && !/^invalid\b/i.test(issue.message))?.message;
    return plainFailure(message || "Dados inválidos. Revise os campos e tente novamente.");
  }
  if (error && typeof error === "object") {
    const code = "code" in error ? String(error.code) : "";
    const place = where(error);
    if (code === "ECONNREFUSED") return `O banco de dados recusou a conexão${place}.`;
    if (code === "ETIMEDOUT" || code === "ECONNRESET" || code === "ENOTFOUND") return `O banco de dados não respondeu${place}.`;
    if (code === "42P01" || code === "42703") {
      const detail = error instanceof Error ? error.message.trim() : "";
      return plainFailure(detail ? `O banco de dados não está atualizado. ${detail}` : "O banco de dados não está atualizado.");
    }
  }
  if (error instanceof Error && error.message.trim()) return plainFailure(error.message.trim());
  return "A operação falhou. Tente de novo.";
}

export function errorResponse(error: unknown) {
  const message = failureMessage(error);
  const appError = error instanceof AppError
    ? new AppError(message, error.status, error.code)
    : error instanceof ZodError
      ? new AppError(message, 400, "VALIDATION_ERROR")
      : new AppError(message, 500, "INTERNAL_ERROR");
  if (!(error instanceof AppError) && !(error instanceof ZodError)) console.error(error);
  return Response.json(
    { error: appError.message, code: appError.code },
    { status: appError.status, headers: { "Cache-Control": "private, no-store" } }
  );
}
