import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { query } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { runtimeEnvironment } from "@/lib/environment";
import { assertPermission } from "@/lib/permissions";

const schema = z.object({
  role: z.string().regex(/^[a-z_]+$/),
  departments: z.array(z.string().regex(/^[a-z_]+$/)).max(12).default([])
});

/**
 * Simula o que um perfil enxerga em cada página, usando a mesma função do servidor.
 * Fora de produção: é ferramenta de conferência, não substitui o teste com uma conta real.
 */
export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    await assertPermission(actor, "users", "admin");
    if (runtimeEnvironment().production) throw new AppError("A simulação de acessos não fica disponível em produção.", 404, "NOT_FOUND");
    const params = new URL(request.url).searchParams;
    const input = schema.parse({ role: params.get("role"), departments: params.getAll("department") });
    const result = await query<{ key: string; label: string; level: string | null }>(
      `select p.key, p.label, app.page_level_for($1, $2::text[], p.key) as level
         from app.pages p order by p.sort_order, p.label`,
      [input.role, input.departments]
    );
    await appendAudit(actor, {
      category: "Acesso", action: "Simulação de acessos", module: "Controle de Acesso", section: "Testar acessos",
      details: `${input.role}${input.departments.length ? ` · ${input.departments.join(", ")}` : ""}`
    });
    return Response.json({ pages: result.rows }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
