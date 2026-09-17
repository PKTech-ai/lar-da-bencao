import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { isValidMonth } from "@/lib/doutrina-scale";
import { EDUCATION_LABEL, PLAN_STATUSES, groupNames, isClassSunday } from "@/lib/education";
import { scheduleRows } from "@/lib/education-schedule";
import { allowedGroups, canWriteClasses, requireClassWrite, requireEducation } from "@/lib/education-data";

type Params = { params: Promise<{ department: string }> };
const monthSchema = z.string().refine(isValidMonth, "Mês inválido.");
const putSchema = z.object({
  entries: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    group: z.string().max(40),
    theme: z.string().trim().max(300).optional(),
    responsible: z.string().trim().max(300).optional(),
    objective: z.string().trim().max(1000).optional(),
    reference: z.string().trim().max(300).optional(),
    resources: z.string().trim().max(1000).optional(),
    status: z.enum(PLAN_STATUSES).optional()
  })).min(1).max(400)
});

export async function GET(request: Request, context: Params) {
  try {
    const actor = await requireActor();
    const department = await requireEducation(actor, (await context.params).department, "read");
    const ym = monthSchema.parse(new URL(request.url).searchParams.get("month"));
    const groups = await allowedGroups(actor, department);
    const last = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).toISOString().slice(0, 10);
    return Response.json({ rows: await scheduleRows(department, `${ym}-01`, last, groups), canEdit: await canWriteClasses(actor, department) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Salva tema/evangelizadores (cronograma) e campos complementares do planejamento anual. */
export async function PUT(request: Request, context: Params) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const { department, groups } = await requireClassWrite(actor, (await context.params).department);
    const input = putSchema.parse(await request.json());
    for (const entry of input.entries) {
      if (!isClassSunday(entry.date)) throw new AppError(`O cronograma só aceita domingos com aula (recesso em janeiro e fevereiro): ${entry.date}.`);
      if (!groupNames(department).includes(entry.group)) throw new AppError("Turma inválida.");
      if (groups && !groups.includes(entry.group)) throw new AppError("Esta turma não está vinculada ao seu perfil.", 403, "FORBIDDEN");
    }
    await transaction(async (client) => {
      const payload = JSON.stringify(input.entries);
      await client.query(
        `insert into app.education_schedule (department_key, class_date, class_group, updated_by)
         select $1, (e->>'date')::date, e->>'group', $3 from jsonb_array_elements($2::jsonb) e
         on conflict (department_key, class_date, class_group) do nothing`,
        [department, payload, actor.id]
      );
      // Só os campos enviados mudam: o cronograma envia tema/evangelizadores; o planejamento, objetivo/material/situação.
      await client.query(
        `update app.education_schedule s set
            theme = coalesce(e->>'theme', s.theme), responsible = coalesce(e->>'responsible', s.responsible),
            objective = coalesce(e->>'objective', s.objective), reference = coalesce(e->>'reference', s.reference),
            resources = coalesce(e->>'resources', s.resources), status = coalesce(e->>'status', s.status),
            updated_by = $3, updated_at = now()
           from jsonb_array_elements($2::jsonb) e
          where s.department_key = $1 and s.class_date = (e->>'date')::date and s.class_group = e->>'group'`,
        [department, payload, actor.id]
      );
      await appendAudit(actor, {
        category: "Edição", action: "Cronograma de aulas atualizado", module: EDUCATION_LABEL[department], section: "Cronograma",
        entityType: "education_schedule", entityId: department, details: `${input.entries.length} linha(s)`
      }, client);
    });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
