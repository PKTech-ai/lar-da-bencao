import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { query } from "@/lib/db";
import { errorResponse } from "@/lib/errors";
import { birthdaysInRange } from "@/lib/birthdays";
import { activeForYear, allowedGroups, requireEducation } from "@/lib/education-data";

type Params = { params: Promise<{ department: string }> };
const querySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  from: z.coerce.number().int().min(1).max(12),
  to: z.coerce.number().int().min(1).max(12),
  audience: z.enum(["all", "evangelizandos", "evangelizadores"]).default("all")
});

export async function GET(request: Request, context: Params) {
  try {
    const actor = await requireActor();
    const department = await requireEducation(actor, (await context.params).department, "read");
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const input = querySchema.parse(params);
    const groups = await allowedGroups(actor, department);
    const people = [];
    if (input.audience !== "evangelizadores") {
      const students = await activeForYear(department, input.year);
      people.push(...students.filter((s) => s.birth_date && (!groups || groups.includes(s.current_group)))
        .map((s) => ({ id: s.id, name: s.full_name, birth_date: s.birth_date!, kind: "Evangelizando", link: s.current_group })));
    }
    if (input.audience !== "evangelizandos") {
      const workers = await query<{ id: string; full_name: string; birth_date: string; groups: string | null }>(
        `select w.id, w.full_name, to_char(w.birth_date, 'YYYY-MM-DD') as birth_date,
                (select string_agg(g.class_group, ', ') from app.education_group_evangelizers g where g.worker_id = w.id and g.department_key = $1) as groups
           from app.workers w join app.worker_departments d on d.worker_id = w.id and d.department_key = $1
          where w.status = 'active' and w.birth_date is not null`,
        [department]
      );
      people.push(...workers.rows.map((w) => ({ id: w.id, name: w.full_name, birth_date: w.birth_date, kind: "Evangelizador(a)", link: w.groups ?? "Departamento" })));
    }
    return Response.json({ people: birthdaysInRange(people, input.year, input.from, input.to) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
