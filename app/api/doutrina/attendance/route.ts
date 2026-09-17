import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { query, transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { attendanceStats, isValidAttendanceCell, type AttendanceValue } from "@/lib/doutrina-attendance";
import { canEditDoutrina, requireDoutrina } from "@/lib/doutrina-data";
import { isValidMonth } from "@/lib/doutrina-scale";

const monthSchema = z.string().refine(isValidMonth, "Mês inválido.");
const saveSchema = z.object({
  month: monthSchema,
  entries: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    row_id: z.string().regex(/^[a-z_0-9]{2,40}$/),
    /** null limpa a célula. */
    value: z.number().int().min(0).max(100000).nullable()
  })).max(600)
});

async function monthValues(ym: string) {
  const result = await query<AttendanceValue>(
    `select to_char(sheet_date, 'YYYY-MM-DD') as date, row_id, value from app.attendance_counts
      where department_key = 'doutrina' and sheet_date >= $1::date and sheet_date < ($1::date + interval '1 month')`,
    [`${ym}-01`]
  );
  return result.rows;
}

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    await requireDoutrina(actor, "read");
    const ym = monthSchema.parse(new URL(request.url).searchParams.get("month"));
    const values = await monthValues(ym);
    return Response.json({ values, stats: attendanceStats(values), canEdit: await canEditDoutrina(actor) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    await requireDoutrina(actor, "update");
    const input = saveSchema.parse(await request.json());
    const invalid = input.entries.find((entry) => !isValidAttendanceCell(input.month, entry.date, entry.row_id));
    if (invalid) throw new AppError(`Atividade ${invalid.row_id} não ocorre em ${invalid.date.split("-").reverse().join("/")}.`);
    await transaction(async (client) => {
      const upserts = input.entries.filter((entry) => entry.value !== null);
      const removals = input.entries.filter((entry) => entry.value === null);
      if (upserts.length) {
        await client.query(
          `insert into app.attendance_counts (department_key, sheet_date, row_id, value, updated_by)
           select 'doutrina', r.date::date, r.row_id, r.value, $2 from jsonb_to_recordset($1::jsonb) as r(date text, row_id text, value int)
           on conflict (department_key, sheet_date, row_id) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`,
          [JSON.stringify(upserts), actor.id]
        );
      }
      if (removals.length) {
        await client.query(
          `delete from app.attendance_counts a using jsonb_to_recordset($1::jsonb) as r(date text, row_id text)
            where a.department_key = 'doutrina' and a.sheet_date = r.date::date and a.row_id = r.row_id`,
          [JSON.stringify(removals)]
        );
      }
      await appendAudit(actor, {
        category: "Edição", action: "Lançamento de frequência", module: "Doutrina", section: "Frequência",
        entityType: "attendance_month", entityId: input.month, details: `${input.month}: ${upserts.length} valor(es), ${removals.length} limpeza(s)`
      }, client);
    });
    const values = await monthValues(input.month);
    return Response.json({ values, stats: attendanceStats(values) });
  } catch (error) {
    return errorResponse(error);
  }
}
