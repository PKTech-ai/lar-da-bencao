import { z } from "zod";
import { appendAudit } from "@/lib/audit";
import { maskCpf } from "@/lib/cpf";
import { assertSameOrigin } from "@/lib/csrf";
import { query } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { loginIdentifier } from "@/lib/login-identifier";
import { attemptKey, clientIp, loginLockout, recordAttempt } from "@/lib/login-throttle";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ email: z.string().max(320), password: z.string().max(200) });
const GENERIC_FAILURE = "CPF ou senha inválidos.";

/**
 * Login por CPF: limita tentativas por CPF e IP, audita falhas e bloqueios
 * e responde igual para conta existente ou não (sem enumeração).
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AppError(GENERIC_FAILURE, 400, "INVALID_CREDENTIALS");
    const identifier = loginIdentifier(parsed.data.email);
    if (identifier.kind === "invalid") throw new AppError("Informe um CPF válido.", 400, "INVALID_IDENTIFIER");
    const keys = { email: attemptKey("email", identifier.cpf), ip: attemptKey("ip", clientIp(request)) };

    const found = await query<{ id: string; email: string; must_reset_password: boolean }>(
      "select id, email, must_reset_password from app.users where cpf=$1 and status='active'",
      [identifier.cpf]
    );
    const row = found.rows[0];
    const email = row?.email ?? "";
    const entityId = row?.id;
    const mustResetPassword = Boolean(row?.must_reset_password);
    const masked = maskCpf(identifier.cpf);

    const wait = await loginLockout(keys);
    if (wait > 0) {
      await appendAudit(null, {
        category: "Segurança", action: "Login bloqueado por excesso de tentativas", module: "Controle de Acesso",
        section: "Autenticação", entityType: entityId ? "user" : undefined, entityId,
        result: "denied", reasonCode: "LOGIN_THROTTLED", details: masked
      });
      return Response.json(
        { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente.", code: "LOGIN_THROTTLED" },
        { status: 429, headers: { "Retry-After": String(wait * 60), "Cache-Control": "private, no-store" } }
      );
    }

    if (!email) {
      await recordAttempt(keys, false);
      await appendAudit(null, {
        category: "Segurança", action: "Falha de login", module: "Controle de Acesso", section: "Autenticação",
        result: "failed", reasonCode: "INVALID_CREDENTIALS", details: masked
      });
      throw new AppError(GENERIC_FAILURE, 401, "INVALID_CREDENTIALS");
    }

    const supabase = await createClient();
    const result = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
    await recordAttempt(keys, !result.error);
    if (result.error) {
      await appendAudit(null, {
        category: "Segurança", action: "Falha de login", module: "Controle de Acesso", section: "Autenticação",
        entityType: entityId ? "user" : undefined, entityId,
        result: "failed", reasonCode: "INVALID_CREDENTIALS", details: masked
      });
      throw new AppError(GENERIC_FAILURE, 401, "INVALID_CREDENTIALS");
    }
    const next = mustResetPassword ? "/definir-senha?motivo=primeiro-acesso" : "/sistema";
    return Response.json({ next }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
