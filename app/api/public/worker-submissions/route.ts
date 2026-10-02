import { createHmac } from "node:crypto";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { query } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { AppError, errorResponse } from "@/lib/errors";
import { isFlagEnabled } from "@/lib/feature-flags";
import { clientIp } from "@/lib/login-throttle";
import {
  isHoneypotFilled, normalizeSubmission, PRIVACY_NOTICE_VERSION, PUBLIC_WORKER_FORM_FLAG, publicSubmissionSchema, SUBMISSION_LIMIT
} from "@/lib/worker-submissions";

const headers = { "Cache-Control": "private, no-store" };

/** Mesma derivação de app.auth_attempts, com domínio próprio: o IP nunca é gravado em claro. */
function ipHash(request: Request) {
  return createHmac("sha256", `lar-worker-submissions:${serverEnv().CRON_SECRET}`).update(clientIp(request)).digest("hex");
}

/**
 * Envio público (sem login) do cadastro de trabalhador. Grava só na fila de revisão;
 * a resposta é sempre a mesma e não revela se a pessoa já tem ficha.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (!(await isFlagEnabled(PUBLIC_WORKER_FORM_FLAG))) {
      throw new AppError("O cadastro online está fechado no momento.", 404, "FORM_CLOSED");
    }
    const body: unknown = await request.json().catch(() => null);
    // Robô que preencheu o campo-isca recebe a resposta normal, mas nada é gravado.
    if (isHoneypotFilled(body)) return Response.json({ status: "received" }, { status: 201, headers });
    const input = normalizeSubmission(publicSubmissionSchema.parse(body));

    const known = await query<{ key: string }>("select key from app.departments where active and key = any($1::text[])", [input.departments]);
    if (known.rows.length !== input.departments.length) throw new AppError("Departamento inválido. Atualize a página e tente novamente.");

    const hash = ipHash(request);
    const recent = await query<{ count: number }>(
      "select count(*)::int as count from app.worker_submissions where ip_hash = $1 and created_at > now() - make_interval(mins => $2)",
      [hash, SUBMISSION_LIMIT.windowMinutes]
    );
    if (recent.rows[0].count >= SUBMISSION_LIMIT.max) {
      await appendAudit(null, {
        category: "Segurança", action: "Cadastro online bloqueado por excesso de envios", module: "Trabalhadores",
        section: "Cadastros online", result: "denied", reasonCode: "SUBMISSION_THROTTLED"
      });
      return Response.json(
        { error: "Muitos envios a partir desta conexão. Tente novamente mais tarde.", code: "SUBMISSION_THROTTLED" },
        { status: 429, headers: { ...headers, "Retry-After": String(SUBMISSION_LIMIT.windowMinutes * 60) } }
      );
    }

    const inserted = await query<{ id: string }>(
      "insert into app.worker_submissions (payload, ip_hash, user_agent, privacy_version) values ($1::jsonb, $2, $3, $4) returning id",
      [JSON.stringify(input), hash, request.headers.get("user-agent")?.slice(0, 300) ?? null, PRIVACY_NOTICE_VERSION]
    );
    // Sem dados pessoais no Dedo-duro: só o identificador do envio.
    await appendAudit(null, {
      category: "Inclusão", action: "Envio de cadastro online de trabalhador", module: "Trabalhadores",
      section: "Cadastros online", entityType: "worker_submission", entityId: inserted.rows[0].id
    });
    return Response.json({ status: "received" }, { status: 201, headers });
  } catch (error) {
    return errorResponse(error);
  }
}
