import { AppError } from "@/lib/errors";

/**
 * Cookie-authenticated mutations must originate from this application.
 * This is deliberately independent from CORS: CORS controls response access,
 * while this check rejects cross-site requests before any state is changed.
 */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  const requestOrigin = new URL(request.url).origin;
  const configuredOrigin = process.env.APP_URL
    ? new URL(process.env.APP_URL).origin
    : requestOrigin;

  if (fetchSite === "cross-site" || !origin) {
    throw new AppError("Origem da requisição não permitida.", 403, "CSRF_REJECTED");
  }

  if (origin !== requestOrigin && origin !== configuredOrigin) {
    throw new AppError("Origem da requisição não permitida.", 403, "CSRF_REJECTED");
  }
}
