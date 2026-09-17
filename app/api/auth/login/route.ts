import { z } from "zod";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { query } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { attemptKey, clientIp, loginLockout, normalizeLoginEmail, recordAttempt } from "@/lib/login-throttle";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ email: z.string().max(320), password: z.string().max(200) });
const GENERIC_FAILURE = "E-mail ou senha inválidos.";

function maskEmail(email: string) {
  const [user = "", domain = ""] = email.split("@");
  return `${user.slice(0, 1)}***@${domain}`;
}

/**
 * Login por senha no servidor: limita tentativas por e-mail e IP, audita falhas e bloqueios
 * e responde igual para conta existente ou não (sem enumeração).
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AppError(GENERIC_FAILURE, 400, "INVALID_CREDENTIALS");
    const email = normalizeLoginEmail(parsed.data.email);
    const keys = { email: attemptKey("email", email), ip: attemptKey("ip", clientIp(request)) };
    const known = await query<{ id: string }>("select id from app.users where email=$1", [email]);
    const entityId = known.rows[0]?.id;

    const wait = await loginLockout(keys);
    if (wait > 0) {
      await appendAudit(null, {
        category: "Segurança", action: "Login bloqueado por excesso de tentativas", module: "Controle de Acesso",
        section: "Autenticação", entityType: entityId ? "user" : undefined, entityId,
        result: "denied", reasonCode: "LOGIN_THROTTLED", details: maskEmail(email)
      });
      return Response.json(
        { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente.", code: "LOGIN_THROTTLED" },
        { status: 429, headers: { "Retry-After": String(wait * 60), "Cache-Control": "private, no-store" } }
      );
    }

    const supabase = await createClient();
    const result = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
    await recordAttempt(keys, !result.error);
    if (result.error) {
      await appendAudit(null, {
        category: "Segurança", action: "Falha de login", module: "Controle de Acesso", section: "Autenticação",
        entityType: entityId ? "user" : undefined, entityId,
        result: "failed", reasonCode: "INVALID_CREDENTIALS", details: maskEmail(email)
      });
      throw new AppError(GENERIC_FAILURE, 401, "INVALID_CREDENTIALS");
    }
    return Response.json({ next: "/mfa" }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
