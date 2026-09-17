import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { EDUCATION_LABEL, PLAN_STATUSES, firstSundayOfMarch } from "@/lib/education";
import { requireEducation } from "@/lib/education-data";

type Params = { params: Promise<{ department: string }> };
const text = (max: number) => z.string().trim().max(max).optional().default("");
const itemSchema = z.object({
  kind: z.enum(["special", "management"]),
  item_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  month: z.number().int().min(3).max(12).nullable().optional(),
  title: z.string().trim().min(1).max(300),
  item_type: text(60),
  purpose: text(1000),
  audience: text(160),
  location: text(300),
  responsible: text(300),
  requirements: text(1000),
  status: z.enum(PLAN_STATUSES).default("Planejado")
});
const postSchema = itemSchema.extend({ year: z.number().int().min(2020).max(2100) });
const patchSchema = itemSchema.extend({ id: z.string().uuid() });
const deleteSchema = z.object({ id: z.string().uuid() });

function validateDates(year: number, item: z.infer<typeof itemSchema>) {
  if (item.kind === "special" && item.item_date) {
    if (!item.item_date.startsWith(`${year}-`)) throw new AppError("A data precisa estar no ano do planejamento.");
    if (item.item_date < firstSundayOfMarch(year)) throw new AppError(`Recesso: atividades a partir de ${firstSundayOfMarch(year).split("-").reverse().join("/")}.`);
  }
  if (item.kind === "management" && !item.month) throw new AppError("Informe o mês da ação (março a dezembro).");
}

async function planFor(client: { query: (t: string, v: unknown[]) => Promise<{ rows: unknown[] }> }, department: string, where: string, value: unknown) {
  const found = await client.query(`select p.id, p.year from app.education_plans p ${where} and p.department_key=$2 for update of p`, [value, department]);
  const plan = found.rows[0] as { id: string; year: number } | undefined;
  if (!plan) throw new AppError("Salve o planejamento do ano antes de incluir atividades.", 404, "PLAN_NOT_FOUND");
  return plan;
}

export async function POST(request: Request, context: Params) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const department = await requireEducation(actor, (await context.params).department, "update");
    const input = postSchema.parse(await request.json());
    const id = await transaction(async (client) => {
      const plan = await planFor(client, department, "where p.year=$1", input.year);
      validateDates(plan.year, input);
      const inserted = await client.query<{ id: string }>(
        `insert into app.education_plan_items (plan_id, kind, item_date, month, title, item_type, purpose, audience, location, responsible, requirements, status, updated_by)
         values ($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,
        [plan.id, input.kind, input.item_date ?? null, input.month ?? null, input.title, input.item_type, input.purpose, input.audience, input.location, input.responsible, input.requirements, input.status, actor.id]
      );
      await appendAudit(actor, {
        category: "Inclusão", action: input.kind === "special" ? "Atividade especial planejada" : "Ação de organização planejada",
        module: EDUCATION_LABEL[department], section: "Planejamento Anual", entityType: "education_plan_item", entityId: inserted.rows[0].id, details: input.title
      }, client);
      return inserted.rows[0].id;
    });
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: Params) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const department = await requireEducation(actor, (await context.params).department, "update");
    const input = patchSchema.parse(await request.json());
    await transaction(async (client) => {
      const plan = await planFor(client, department, "join app.education_plan_items i on i.plan_id = p.id where i.id=$1", input.id);
      validateDates(plan.year, input);
      await client.query(
        `update app.education_plan_items set kind=$2, item_date=$3::date, month=$4, title=$5, item_type=$6, purpose=$7, audience=$8, location=$9,
            responsible=$10, requirements=$11, status=$12, updated_by=$13, updated_at=now() where id=$1`,
        [input.id, input.kind, input.item_date ?? null, input.month ?? null, input.title, input.item_type, input.purpose, input.audience, input.location, input.responsible, input.requirements, input.status, actor.id]
      );
      await appendAudit(actor, {
        category: "Edição", action: "Item do planejamento atualizado", module: EDUCATION_LABEL[department], section: "Planejamento Anual",
        entityType: "education_plan_item", entityId: input.id, details: `${input.title} · ${input.status}`
      }, client);
    });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: Params) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const department = await requireEducation(actor, (await context.params).department, "update");
    const input = deleteSchema.parse(await request.json());
    await transaction(async (client) => {
      await planFor(client, department, "join app.education_plan_items i on i.plan_id = p.id where i.id=$1", input.id);
      await client.query("delete from app.education_plan_items where id=$1", [input.id]);
      await appendAudit(actor, {
        category: "Exclusão", action: "Item do planejamento excluído", module: EDUCATION_LABEL[department], section: "Planejamento Anual",
        entityType: "education_plan_item", entityId: input.id
      }, client);
    });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
