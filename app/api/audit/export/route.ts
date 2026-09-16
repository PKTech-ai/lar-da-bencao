import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { getAuditRows } from "@/lib/audit-query";
import { errorResponse } from "@/lib/errors";
import { assertPermission } from "@/lib/permissions";
import { csvCell } from "@/lib/csv";

const schema = z.object({
  search: z.string().trim().max(100).optional(), actor: z.string().uuid().optional(),
  category: z.string().max(30).optional(), module: z.string().max(120).optional(),
  result: z.string().max(20).optional(), from: z.string().max(10).optional(), to: z.string().max(10).optional()
});

export async function GET(request: Request) {
  let actor = null;
  try {
    actor = await requireActor();
    await assertPermission(actor, "audit", "export");
    const filters = schema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const data = await getAuditRows({ ...filters, page: 1, pageSize: 10_000 });
    const header = ["ID", "Data/Hora UTC", "Usuário", "Perfil", "Tipo", "Ação", "Módulo", "Seção", "Entidade", "Resultado", "Detalhes", "Request ID", "Versão", "Hash"];
    const lines = [header, ...data.rows.map((row) => [row.id, row.occurred_at, row.actor_name_snapshot, row.role_snapshot, row.category, row.action, row.module, row.section, `${row.entity_type ?? ""}:${row.entity_id ?? ""}`, row.result, row.details, row.request_id, row.app_version, row.event_hash])];
    await appendAudit(actor, { category: "Impressão", action: "Exportação do Dedo-duro", module: "Controle de Acesso", section: "Dedo-duro", entityType: "audit_export", result: "success", details: `${data.total} evento(s) exportado(s).` });
    return new Response("\ufeff" + lines.map((line) => line.map(csvCell).join(";")).join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="historico_atividades_${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "private, no-store"
      }
    });
  } catch (error) {
    if (actor) await appendAudit(actor, { category: "Segurança", action: "Exportação de auditoria negada", module: "Controle de Acesso", section: "Dedo-duro", result: "denied" }).catch(console.error);
    return errorResponse(error);
  }
}
