import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { query, transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { EDUCATION_LABEL, defaultPlan, firstSundayOfMarch } from "@/lib/education";
import { allowedGroups, canEditEducation, requireEducation } from "@/lib/education-data";
import { scheduleRows } from "@/lib/education-schedule";

type Params = { params: Promise<{ department: string }> };
const yearSchema = z.coerce.number().int().min(2020).max(2100);
const putSchema = z.object({
  year: yearSchema,
  objective: z.string().trim().max(4000),
  priorities: z.string().trim().max(4000),
  expected: z.string().trim().max(4000),
  notes: z.string().trim().max(4000),
  version: z.number().int().nonnegative()
});

export async function GET(request: Request, context: Params) {
  try {
    const actor = await requireActor();
    const department = await requireEducation(actor, (await context.params).department, "read");
    const year = yearSchema.parse(new URL(request.url).searchParams.get("year"));
    const plan = await query<{ id: string; objective: string; priorities: string; expected: string; notes: string; version: number; updated_at: string }>(
      "select id, objective, priorities, expected, notes, version, updated_at from app.education_plans where department_key=$1 and year=$2",
      [department, year]
    );
    const saved = plan.rows[0];
    const items = saved
      ? (await query(
        `select id, kind, to_char(item_date, 'YYYY-MM-DD') as item_date, month, title, item_type, purpose, audience, location, responsible, requirements, status
           from app.education_plan_items where plan_id=$1 order by kind, coalesce(item_date, make_date($2, month, 1)), title`,
        [saved.id, year]
      )).rows
      : defaultPlan(department).management.map((m, i) => ({ id: `default-${i}`, kind: "management", item_date: null, month: m.month, title: m.action, item_type: "", purpose: "", audience: "", location: "", responsible: m.responsible, requirements: m.goal, status: "Planejado" }));
    const lessons = await scheduleRows(department, `${year}-03-01`, `${year}-12-31`, await allowedGroups(actor, department));
    const base = saved ?? { ...defaultPlan(department), id: null, version: 0, updated_at: null };
    return Response.json({
      plan: { id: base.id, objective: base.objective, priorities: base.priorities, expected: base.expected, notes: base.notes, version: base.version, updated_at: base.updated_at },
      saved: Boolean(saved),
      items,
      lessons,
      returnDate: firstSundayOfMarch(year),
      canEdit: await canEditEducation(actor, department)
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Salva os textos do plano; na primeira gravação cria o plano do ano com as ações de organização padrão. */
export async function PUT(request: Request, context: Params) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const department = await requireEducation(actor, (await context.params).department, "update");
    const input = putSchema.parse(await request.json());
    const result = await transaction(async (client) => {
      const current = await client.query<{ id: string; version: number }>(
        "select id, version from app.education_plans where department_key=$1 and year=$2 for update",
        [department, input.year]
      );
      const plan = current.rows[0];
      if ((plan?.version ?? 0) !== input.version) throw new AppError("O planejamento foi alterado por outra sessão. Recarregue a página.", 409, "VERSION_CONFLICT");
      let id = plan?.id;
      if (!id) {
        id = (await client.query<{ id: string }>(
          `insert into app.education_plans (department_key, year, objective, priorities, expected, notes, updated_by)
           values ($1,$2,$3,$4,$5,$6,$7) returning id`,
          [department, input.year, input.objective, input.priorities, input.expected, input.notes, actor.id]
        )).rows[0].id;
        for (const m of defaultPlan(department).management) {
          await client.query(
            "insert into app.education_plan_items (plan_id, kind, month, title, responsible, requirements, updated_by) values ($1,'management',$2,$3,$4,$5,$6)",
            [id, m.month, m.action, m.responsible, m.goal, actor.id]
          );
        }
      } else {
        await client.query(
          `update app.education_plans set objective=$2, priorities=$3, expected=$4, notes=$5, updated_by=$6, updated_at=now(), version=version+1 where id=$1`,
          [id, input.objective, input.priorities, input.expected, input.notes, actor.id]
        );
      }
      await appendAudit(actor, {
        category: plan ? "Edição" : "Inclusão", action: plan ? "Planejamento anual atualizado" : "Planejamento anual criado",
        module: EDUCATION_LABEL[department], section: "Planejamento Anual", entityType: "education_plan", entityId: id, details: String(input.year)
      }, client);
      return { id };
    });
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
