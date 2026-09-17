import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { query, transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { requireFlag } from "@/lib/feature-flags";
import { applyPlan } from "@/lib/legacy/importer";
import { isDemoPlan, planSchema } from "@/lib/legacy/v215";
import { assertPermission } from "@/lib/permissions";

export const maxDuration = 60;

const manifestSchema = z.object({
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  appVersion: z.number().int(),
  createdAt: z.string().max(40),
  createdBy: z.string().max(160).optional(),
  counts: z.object({ records: z.number(), files: z.number(), bytes: z.number() })
});
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.enum(["dry-run", "commit"]), manifest: manifestSchema, origin: z.record(z.string(), z.number()), plan: planSchema }),
  z.object({ action: z.literal("rollback"), import_id: z.string().uuid() })
]);

class DryRunComplete extends Error {
  constructor(readonly result: Awaited<ReturnType<typeof applyPlan>>) {
    super("dry-run");
  }
}

async function requireImporter() {
  const actor = await requireActor();
  await assertPermission(actor, "modules", "admin");
  await requireFlag("legacy_import");
  return actor;
}

export async function GET() {
  try {
    await requireImporter();
    const result = await query(
      `select i.id, i.source_version, i.source_sha256, i.status, i.report, i.manifest, i.created_at, i.completed_at, i.rolled_back_at,
              u.full_name as created_by_name
         from app.legacy_imports i join app.users u on u.id = i.created_by
        order by i.created_at desc limit 50`
    );
    return Response.json({ imports: result.rows }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  let actor = null;
  try {
    assertSameOrigin(request);
    actor = await requireImporter();
    const input = bodySchema.parse(await request.json());
    const author = actor;

    if (input.action === "rollback") {
      const counts = await transaction(async (client) => {
        const result = await client.query<{ counts: Record<string, number> }>("select app.rollback_legacy_import($1, $2) as counts", [input.import_id, author.id]);
        await appendAudit(author, {
          category: "Exclusão", action: "Reversão de importação v215", module: "Controle de Acesso", section: "Importação v215",
          entityType: "legacy_import", entityId: input.import_id, after: result.rows[0].counts
        }, client);
        return result.rows[0].counts;
      });
      return Response.json({ status: "rolled_back", counts });
    }

    if (process.env.VERCEL_ENV === "production" && isDemoPlan(input.plan)) {
      throw new AppError("O pacote contém os dados fictícios de demonstração da v215 e não pode ser importado em produção.", 422, "DEMO_PACKAGE");
    }
    const manifest = { ...input.manifest, origin: input.origin };

    if (input.action === "dry-run") {
      // Simulação real: executa a importação e desfaz a transação no final.
      const simulated = await transaction(async (client) => {
        const importId = (await client.query<{ id: string }>(
          `insert into app.legacy_imports (source_version, source_sha256, status, manifest, created_by)
           values ($1, $2, 'validating', $3, $4) returning id`,
          [input.manifest.appVersion, `dryrun-${input.manifest.sha256}`.slice(0, 64), manifest, author.id]
        )).rows[0].id;
        throw new DryRunComplete(await applyPlan(client, importId, input.plan, author));
      }).catch((error) => {
        if (error instanceof DryRunComplete) return error.result;
        throw error;
      });
      const active = await query("select id from app.legacy_imports where source_sha256=$1 and status <> 'rolled_back'", [input.manifest.sha256]);
      await appendAudit(author, {
        category: "Acesso", action: "Simulação de importação v215", module: "Controle de Acesso", section: "Importação v215",
        entityType: "legacy_package", entityId: input.manifest.sha256, details: JSON.stringify(simulated.report).slice(0, 1800)
      });
      return Response.json({ mode: "dry-run", alreadyImported: Boolean(active.rowCount), report: simulated.report, warnings: simulated.warnings });
    }

    const committed = await transaction(async (client) => {
      const created = await client.query<{ id: string }>(
        `insert into app.legacy_imports (source_version, source_sha256, status, manifest, created_by)
         values ($1, $2, 'importing', $3, $4) returning id`,
        [input.manifest.appVersion, input.manifest.sha256, manifest, author.id]
      ).catch((error: { code?: string }) => {
        if (error.code === "23505") throw new AppError("Este pacote já foi importado. Reverta a importação anterior para importar de novo.", 409, "ALREADY_IMPORTED");
        throw error;
      });
      const importId = created.rows[0].id;
      const result = await applyPlan(client, importId, input.plan, author);
      await client.query(
        "update app.legacy_imports set status='completed', completed_at=now(), report=$2 where id=$1",
        [importId, { entities: result.report, warnings: result.warnings, origin: input.origin }]
      );
      await appendAudit(author, {
        category: "Inclusão", action: "Importação v215 concluída", module: "Controle de Acesso", section: "Importação v215",
        entityType: "legacy_import", entityId: importId, details: `Pacote ${input.manifest.sha256.slice(0, 12)}…`, after: result.report
      }, client);
      return { importId, ...result };
    });
    return Response.json({ mode: "commit", importId: committed.importId, report: committed.report, warnings: committed.warnings, students: committed.students });
  } catch (error) {
    if (actor) {
      await appendAudit(actor, {
        category: "Segurança", action: "Falha na importação v215", module: "Controle de Acesso", section: "Importação v215",
        result: "failed", reasonCode: error instanceof AppError ? error.code : "INTERNAL_ERROR"
      }).catch(console.error);
    }
    return errorResponse(error);
  }
}
