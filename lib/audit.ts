import type { PoolClient } from "pg";
import type { Actor } from "@/lib/auth";
import { dbPool } from "@/lib/db";
import { requestContext } from "@/lib/request-context";

export type AuditInput = {
  category: "Acesso" | "Inclusão" | "Edição" | "Exclusão" | "Impressão" | "Segurança";
  action: string;
  module: string;
  section?: string;
  entityType?: string;
  entityId?: string;
  result?: "success" | "denied" | "failed" | "cancelled";
  reasonCode?: string;
  details?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
};

export async function appendAudit(actor: Actor | null, input: AuditInput, client?: PoolClient) {
  const context = await requestContext();
  const executor = client ?? dbPool();
  const result = await executor.query<{ id: string }>(
    `select app.append_audit_event(
       $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9,
       $10, $11, $12, $13, $14::jsonb, $15::jsonb, $16::jsonb
     ) as id`,
    [
      actor?.id ?? null,
      actor?.authUserId ?? null,
      actor?.name ?? "Não autenticado",
      actor?.role ?? "anonymous",
      input.category,
      input.action,
      input.module,
      input.section ?? null,
      input.entityType ?? null,
      input.entityId ?? null,
      input.result ?? "success",
      input.reasonCode ?? null,
      input.details?.slice(0, 2_000) ?? null,
      input.before ?? null,
      input.after ?? null,
      {
        ...input.metadata,
        requestId: context.requestId,
        sessionId: actor?.sessionId ?? null,
        maskedIp: context.maskedIp,
        userAgent: context.userAgent,
        appVersion: context.appVersion
      }
    ]
  );
  return result.rows[0]?.id;
}
