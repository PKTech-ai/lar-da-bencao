import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { query, transaction } from "@/lib/db";
import { AppError, AuthorizationError, errorResponse } from "@/lib/errors";
import { assertPermission, hasPermission } from "@/lib/permissions";

const patchSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]+$/),
  enabled: z.boolean(),
  uat_reference: z.string().trim().min(3).max(300).optional()
});

/** Flags que não podem ser alteradas pela tela (segurança da fundação). */
const LOCKED = new Set(["audit"]);

export async function GET() {
  try {
    const actor = await requireActor();
    // A Diretoria acompanha a situação dos módulos; só o Administrador liga e desliga.
    const canRead = (await hasPermission(actor, "modules", "admin")) || (await hasPermission(actor, "presidencia", "read"));
    if (!canRead) throw new AuthorizationError();
    const result = await query(
      `select f.key, f.enabled, f.description, f.wave, f.uat_reference, f.enabled_at, f.updated_at, u.full_name as updated_by_name
         from app.feature_flags f
         left join app.users u on u.id = f.updated_by
        order by coalesce(f.wave, 'z'), f.key`
    );
    return Response.json({ flags: result.rows, locked: [...LOCKED] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  let actor = null;
  try {
    assertSameOrigin(request);
    actor = await requireActor();
    await assertPermission(actor, "modules", "admin");
    const input = patchSchema.parse(await request.json());
    if (LOCKED.has(input.key)) throw new AppError("Esta proteção não pode ser desligada.", 409, "FLAG_LOCKED");
    const admin = actor;
    await transaction(async (client) => {
      const current = await client.query<{ enabled: boolean; wave: string | null; uat_reference: string | null }>(
        "select enabled, wave, uat_reference from app.feature_flags where key=$1 for update",
        [input.key]
      );
      const before = current.rows[0];
      if (!before) throw new AppError("Flag não encontrada.", 404, "NOT_FOUND");
      const businessWave = before.wave === "1" || before.wave === "2" || before.wave === "3" || input.key === "business_modules";
      if (input.enabled && businessWave && !input.uat_reference) {
        throw new AppError("Informe a referência do UAT aprovado (ata, data e responsável) para liberar o módulo.", 400, "UAT_REQUIRED");
      }
      await client.query(
        `update app.feature_flags
            set enabled=$2,
                uat_reference=case when $2 then coalesce($3, uat_reference) else uat_reference end,
                enabled_at=case when $2 and not enabled then now() else enabled_at end,
                updated_at=now(), updated_by=$4
          where key=$1`,
        [input.key, input.enabled, input.uat_reference ?? null, admin.id]
      );
      await appendAudit(admin, {
        category: "Segurança",
        action: input.enabled ? "Liberação de módulo" : "Desligamento de módulo",
        module: "Controle de Acesso",
        section: "Módulos e ondas",
        entityType: "feature_flag",
        entityId: input.key,
        details: input.uat_reference ? `UAT: ${input.uat_reference}` : undefined,
        before: { enabled: before.enabled, uat_reference: before.uat_reference },
        after: { enabled: input.enabled, uat_reference: input.uat_reference ?? before.uat_reference }
      }, client);
    });
    return Response.json({ status: "updated" });
  } catch (error) {
    if (actor) {
      await appendAudit(actor, {
        category: "Segurança", action: "Falha ao alterar módulo", module: "Controle de Acesso", section: "Módulos e ondas",
        result: "failed", reasonCode: error instanceof AppError ? error.code : "INTERNAL_ERROR"
      }).catch(console.error);
    }
    return errorResponse(error);
  }
}
