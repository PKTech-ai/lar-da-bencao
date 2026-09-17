import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { query, transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { isValidMonth } from "@/lib/doutrina-scale";
import { EDUCATION_LABEL, classSundays, isClassSunday } from "@/lib/education";
import { activeForYear, allowedGroups, canWriteClasses, requireClassWrite, requireEducation } from "@/lib/education-data";

type Params = { params: Promise<{ department: string }> };
const monthSchema = z.string().refine(isValidMonth, "Mês inválido.");
const putSchema = z.object({
  month: monthSchema,
  entries: z.array(z.object({
    evangelizando_id: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    mark: z.enum(["P", "F"]).nullable()
  })).max(2000)
});

async function sheet(department: "infancia" | "juventude", ym: string, groups: string[] | null) {
  const students = (await activeForYear(department, Number(ym.slice(0, 4))))
    .filter((s) => !groups || groups.includes(s.current_group))
    .map((s) => ({ id: s.id, full_name: s.full_name, group: s.current_group }));
  const marks = await query<{ evangelizando_id: string; date: string; mark: "P" | "F" }>(
    `select a.evangelizando_id, to_char(a.class_date, 'YYYY-MM-DD') as date, a.mark from app.evangelizando_attendance a
       join app.evangelizandos e on e.id = a.evangelizando_id and e.department_key = $1
      where a.class_date >= $2::date and a.class_date < ($2::date + interval '1 month')`,
    [department, `${ym}-01`]
  );
  const visible = new Set(students.map((s) => s.id));
  return { dates: classSundays(ym), students, marks: marks.rows.filter((m) => visible.has(m.evangelizando_id)) };
}

export async function GET(request: Request, context: Params) {
  try {
    const actor = await requireActor();
    const department = await requireEducation(actor, (await context.params).department, "read");
    const ym = monthSchema.parse(new URL(request.url).searchParams.get("month"));
    const groups = await allowedGroups(actor, department);
    return Response.json({ ...(await sheet(department, ym, groups)), canEdit: await canWriteClasses(actor, department) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Chamada dominical: P, F ou em branco (null). */
export async function PUT(request: Request, context: Params) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const { department, groups } = await requireClassWrite(actor, (await context.params).department);
    const input = putSchema.parse(await request.json());
    const current = await sheet(department, input.month, groups);
    const allowed = new Set(current.students.map((s) => s.id));
    for (const entry of input.entries) {
      if (!entry.date.startsWith(input.month) || !isClassSunday(entry.date)) throw new AppError(`Chamada só aos domingos com aula (recesso em janeiro e fevereiro): ${entry.date}.`);
      if (!allowed.has(entry.evangelizando_id)) throw new AppError("Evangelizando fora da sua turma ou sem matrícula vigente.", 403, "FORBIDDEN");
    }
    await transaction(async (client) => {
      const set = input.entries.filter((e) => e.mark);
      const clear = input.entries.filter((e) => !e.mark);
      if (set.length) {
        await client.query(
          `insert into app.evangelizando_attendance (evangelizando_id, class_date, mark, updated_by)
           select r.evangelizando_id::uuid, r.date::date, r.mark, $2 from jsonb_to_recordset($1::jsonb) as r(evangelizando_id text, date text, mark text)
           on conflict (evangelizando_id, class_date) do update set mark = excluded.mark, updated_by = excluded.updated_by, updated_at = now()`,
          [JSON.stringify(set), actor.id]
        );
      }
      if (clear.length) {
        await client.query(
          `delete from app.evangelizando_attendance a using jsonb_to_recordset($1::jsonb) as r(evangelizando_id text, date text)
            where a.evangelizando_id = r.evangelizando_id::uuid and a.class_date = r.date::date`,
          [JSON.stringify(clear)]
        );
      }
      await appendAudit(actor, {
        category: "Edição", action: "Chamada dominical", module: EDUCATION_LABEL[department], section: "Frequência",
        entityType: "attendance_month", entityId: `${department}:${input.month}`, details: `${set.length} marcação(ões), ${clear.length} limpeza(s)`
      }, client);
    });
    return Response.json(await sheet(department, input.month, groups));
  } catch (error) {
    return errorResponse(error);
  }
}
