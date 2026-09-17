import { dbPool } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Última migração esperada pela aplicação: o health fica “degraded” se o banco estiver atrás do código. */
const SCHEMA_MARKER = "app.legacy_id_map";

/**
 * Health público para monitoramento externo. Detalhes mínimos (sem dados internos):
 * banco acessível, esquema na versão esperada e verificação diária de integridade recente (≤ 36 h).
 */
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  const version = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "local";
  try {
    const result = await dbPool().query<{ schema_ok: boolean; integrity_ok: boolean }>(
      `select to_regclass($1) is not null as schema_ok,
              exists (select 1 from app.audit_events
                       where action = 'Verificação diária de integridade' and result = 'success'
                         and occurred_at > now() - interval '36 hours') as integrity_ok`,
      [SCHEMA_MARKER]
    );
    const checks = { database: true, schema: result.rows[0].schema_ok, integrity: result.rows[0].integrity_ok };
    const healthy = checks.schema && (checks.integrity || process.env.VERCEL_ENV !== "production");
    return Response.json({ status: healthy ? "ok" : "degraded", checks, version }, { status: healthy ? 200 : 503, headers });
  } catch {
    return Response.json({ status: "unavailable", checks: { database: false }, version }, { status: 503, headers });
  }
}
