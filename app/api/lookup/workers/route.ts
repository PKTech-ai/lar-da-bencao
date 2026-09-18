import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { query } from "@/lib/db";
import { AuthorizationError, errorResponse } from "@/lib/errors";
import { departmentsWithPermission, hasPermission } from "@/lib/permissions";

const schema = z.object({ department: z.string().regex(/^[a-z_]+$/).optional() });

/**
 * Trabalhadores aprovados e ativos (id, nome e departamentos) para os campos de seleção.
 * Sem departamento na consulta, devolve só os departamentos que o usuário pode ler —
 * exceto quem organiza escalas da Casa inteira (Patrimônio, Secretaria e Presidência).
 */
export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const { department } = schema.parse(Object.fromEntries(new URL(request.url).searchParams));
    if (department && !(await hasPermission(actor, "department", "read", department))) throw new AuthorizationError();

    let scope: string[] | null = null;
    if (department) {
      scope = [department];
    } else {
      const houseWide = (await hasPermission(actor, "department", "update", "patrimonio"))
        || (await hasPermission(actor, "secretaria", "read"))
        || (await hasPermission(actor, "presidencia", "read"));
      if (!houseWide) {
        scope = await departmentsWithPermission(actor, "read");
        if (!scope.length) throw new AuthorizationError();
      }
    }

    const result = await query<{ id: string; name: string; departments: string[] }>(
      `select w.id, w.full_name as name,
              coalesce(array_agg(d.department_key order by d.department_key) filter (where d.department_key is not null), '{}') as departments
         from app.workers w left join app.worker_departments d on d.worker_id = w.id
        where w.status = 'active'
          and ($1::text[] is null or exists (select 1 from app.worker_departments x where x.worker_id = w.id and x.department_key = any($1)))
        group by w.id order by w.full_name`,
      [scope]
    );
    return Response.json({ workers: result.rows }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
