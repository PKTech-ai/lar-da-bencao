import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { query } from "@/lib/db";
import { AuthorizationError, errorResponse } from "@/lib/errors";
import { departmentsWithModule, hasModule } from "@/lib/permissions";

const schema = z.object({ department: z.string().regex(/^[a-z_]+$/).optional(), month: z.coerce.number().int().min(1).max(12).optional() });

/** Aniversariantes dos trabalhadores ativos, no escopo de leitura do usuário (BL-014 / BL-054). */
export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const { department, month } = schema.parse(Object.fromEntries(new URL(request.url).searchParams));
    // A Secretaria e a Presidência veem todos; os demais, só os departamentos que podem ler.
    const all = (await hasModule(actor, "secretaria", "aniversariantes", "read")) || (await hasModule(actor, "diretoria", "aniversariantes", "read"));
    const allowed = department ? [department] : all ? null : await departmentsWithModule(actor, "aniversariantes", "read");
    if (department && !(await hasModule(actor, department, "aniversariantes", "read"))) throw new AuthorizationError();
    if (!all && allowed && !allowed.length) throw new AuthorizationError();
    const result = await query<{ id: string; full_name: string; birth_date: string; day: number; month: number; departments: string[] }>(
      `select w.id, w.full_name, to_char(w.birth_date, 'YYYY-MM-DD') as birth_date,
              extract(day from w.birth_date)::int as day, extract(month from w.birth_date)::int as month,
              coalesce(array_agg(d.department_key order by d.department_key) filter (where d.department_key is not null), '{}') as departments
         from app.workers w left join app.worker_departments d on d.worker_id = w.id
        where w.status = 'active' and w.birth_date is not null
          and ($1::text[] is null or exists (select 1 from app.worker_departments x where x.worker_id = w.id and x.department_key = any($1)))
          and ($2::int is null or extract(month from w.birth_date)::int = $2)
        group by w.id order by extract(month from w.birth_date), extract(day from w.birth_date), w.full_name`,
      [allowed, month ?? null]
    );
    return Response.json({ workers: result.rows }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
