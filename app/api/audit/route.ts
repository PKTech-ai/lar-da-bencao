import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { getAuditFacets, getAuditRows } from "@/lib/audit-query";
import { errorResponse } from "@/lib/errors";
import { assertPermission } from "@/lib/permissions";

const filtersSchema = z.object({
  search: z.string().trim().max(100).optional(),
  actor: z.string().uuid().optional(),
  category: z.enum(["Acesso", "Inclusão", "Edição", "Exclusão", "Impressão", "Segurança"]).optional(),
  module: z.string().trim().max(120).optional(),
  result: z.enum(["success", "denied", "failed", "cancelled"]).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(30)
});

export async function GET(request: Request) {
  let actor = null;
  try {
    actor = await requireActor();
    await assertPermission(actor, "audit", "read");
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const filters = filtersSchema.parse(params);
    const [data, facets] = await Promise.all([getAuditRows(filters), getAuditFacets()]);
    return Response.json({ ...data, facets, page: filters.page, pageSize: filters.pageSize }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (actor) await appendAudit(actor, { category: "Segurança", action: "Consulta de auditoria negada", module: "Controle de Acesso", section: "Dedo-duro", result: "denied" }).catch(console.error);
    return errorResponse(error);
  }
}
