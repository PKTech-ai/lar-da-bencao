import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { errorResponse } from "@/lib/errors";
import { assertPermission } from "@/lib/permissions";
import { departmentReport } from "@/lib/reports";

/** Relatório anual comum de um departamento (mesma estrutura em todos os módulos). */
export async function GET(request: Request, context: { params: Promise<{ department: string }> }) {
  try {
    const actor = await requireActor();
    const department = z.string().regex(/^[a-z_]+$/).parse((await context.params).department);
    await assertPermission(actor, "department", "read", department);
    const year = z.coerce.number().int().min(1900).max(2199).parse(new URL(request.url).searchParams.get("year") ?? new Date().getFullYear());
    const report = await departmentReport(department, year);
    await appendAudit(actor, {
      category: "Impressão", action: "Relatório anual consultado", module: department, section: "Relatório Anual",
      details: `${department} · ${year}`
    });
    return Response.json(report, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
