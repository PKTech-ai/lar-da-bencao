import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { EDUCATION_LABEL, classify, renewalTargetYear } from "@/lib/education";
import {
  EVANGELIZANDO_COLUMNS, allowedGroups, assertGroupAllowed, requireEducation, withEffectiveStatus, type EvangelizandoRow
} from "@/lib/education-data";
import { evangelizandoSchema, evangelizandoValues, validateEvangelizando } from "@/lib/evangelizando-schema";
import { todayInSaoPaulo } from "@/lib/workers";

const patchSchema = z.discriminatedUnion("op", [
  evangelizandoSchema.extend({ op: z.literal("update"), manual_inactive: z.boolean(), version: z.number().int().positive() }),
  z.object({ op: z.literal("renew"), version: z.number().int().positive() }),
  z.object({ op: z.literal("photo"), attachment_id: z.string().uuid().nullable(), version: z.number().int().positive() })
]);

type Client = { query: (text: string, values?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }> };

async function lockEvangelizando(client: Client, id: string) {
  const found = await client.query(`select ${EVANGELIZANDO_COLUMNS} from app.evangelizandos e where e.id=$1 for update`, [id]);
  const row = found.rows[0] as EvangelizandoRow | undefined;
  if (!row) throw new AppError("Evangelizando não encontrado.", 404, "NOT_FOUND");
  return row;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const id = z.string().uuid().parse((await context.params).id);
    const input = patchSchema.parse(await request.json());
    const today = todayInSaoPaulo();
    const currentYear = Number(today.slice(0, 4));
    const result = await transaction(async (client) => {
      const before = await lockEvangelizando(client, id);
      const department = await requireEducation(actor, before.department_key, "update");
      const groups = await allowedGroups(actor, department);
      assertGroupAllowed(groups, withEffectiveStatus(before, currentYear).current_group ?? "");
      if (before.version !== input.version) throw new AppError("Cadastro alterado por outra sessão. Recarregue a página.", 409, "VERSION_CONFLICT");
      const label = EDUCATION_LABEL[department];

      if (input.op === "renew") {
        const target = renewalTargetYear(before, currentYear);
        const c = classify(before.birth_date, department, target);
        if (!c.valid) throw new AppError(`Para ${target}, a idade corresponde a “${c.group}”, fora do Departamento da ${label}. Revise o enquadramento antes da renovação.`, 409, "OUT_OF_RANGE");
        const active = classify(before.birth_date, department, Math.min(currentYear, target));
        await client.query(
          `update app.evangelizandos set valid_through_year=$2, manual_inactive=false, inactive_at=null, inactive_reason=null, status='active',
              class_group=$3, age_reference=$4, updated_by=$5, updated_at=now(), version=version+1 where id=$1`,
          [id, target, active.valid ? active.group : c.group, active.valid ? active.age : c.age, actor.id]
        );
        await client.query(
          "insert into app.evangelizando_renewals (evangelizando_id, year, class_group, renewed_by) values ($1,$2,$3,$4) on conflict (evangelizando_id, year) do nothing",
          [id, target, c.group, actor.id]
        );
        await appendAudit(actor, {
          category: "Edição", action: "Renovação de matrícula", module: label, section: "Evangelizandos", entityType: "evangelizando", entityId: id,
          details: `Matrícula válida até ${target} · ${c.group}`, before: { valid_through_year: before.valid_through_year }, after: { valid_through_year: target }
        }, client);
        return { valid_through_year: target, group: c.group };
      }

      if (input.op === "photo") {
        if (input.attachment_id) {
          const file = await client.query(
            "select 1 from app.attachments where id=$1 and owner_type=$2 and owner_id=$3 and status='active' and mime_type in ('image/jpeg','image/png')",
            [input.attachment_id, `evangelizando_photo_${department}`, id]
          );
          if (!file.rowCount) throw new AppError("Foto não encontrada, não inspecionada ou de outro cadastro.", 409, "ATTACHMENT_INVALID");
        }
        await client.query("update app.evangelizandos set photo_attachment_id=$2, updated_by=$3, updated_at=now(), version=version+1 where id=$1", [id, input.attachment_id, actor.id]);
        await appendAudit(actor, { category: "Edição", action: input.attachment_id ? "Foto do evangelizando atualizada" : "Foto do evangelizando removida", module: label, section: "Evangelizandos", entityType: "evangelizando", entityId: id }, client);
        return { ok: true };
      }

      const reference = before.valid_through_year >= currentYear ? currentYear : before.valid_through_year;
      const c = validateEvangelizando(input, department, today, Math.max(reference, Number(before.filled_date.slice(0, 4))));
      assertGroupAllowed(groups, c.group);
      const inactivating = input.manual_inactive && !before.manual_inactive;
      await client.query(
        `update app.evangelizandos set full_name=$1, birth_date=$2::date, guardian_name=$3, guardian_relation=$4, guardian_phone=$5, whatsapp=$6,
            address=$7, point_reference=$8, father_name=$9, father_contact=$10, mother_name=$11, mother_contact=$12, religion=$13,
            marital_status=$14, rancho_requested=$15, notes=$16, filled_date=coalesce(nullif($17,'')::date, filled_date),
            class_group=$18, age_reference=$19, manual_inactive=$20,
            inactive_at=case when $20 then coalesce(inactive_at, current_date) else null end,
            inactive_reason=case when $20 then 'Inativação manual' else null end,
            status=case when $20 then 'inactive' else 'active' end,
            updated_by=$21, updated_at=now(), version=version+1
          where id=$22`,
        [...evangelizandoValues(input), input.filled_date ?? "", c.group, c.age, input.manual_inactive, actor.id, id]
      );
      await appendAudit(actor, {
        category: "Edição", action: inactivating ? "Matrícula inativada" : "Atualização de matrícula", module: label, section: "Evangelizandos",
        entityType: "evangelizando", entityId: id,
        before: { class_group: before.class_group, manual_inactive: before.manual_inactive },
        after: { class_group: c.group, manual_inactive: input.manual_inactive }
      }, client);
      return { group: c.group };
    });
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

/** Exclusão definitiva da ficha (e da frequência vinculada), como no mock. */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const id = z.string().uuid().parse((await context.params).id);
    await transaction(async (client) => {
      const before = await lockEvangelizando(client, id);
      const department = await requireEducation(actor, before.department_key, "delete");
      assertGroupAllowed(await allowedGroups(actor, department), withEffectiveStatus(before).current_group ?? "");
      const marks = await client.query("delete from app.evangelizando_attendance where evangelizando_id=$1", [id]);
      await client.query("delete from app.evangelizandos where id=$1", [id]);
      await appendAudit(actor, {
        category: "Exclusão", action: "Exclusão definitiva de evangelizando", module: EDUCATION_LABEL[department], section: "Evangelizandos",
        entityType: "evangelizando", entityId: id, details: `${marks.rowCount ?? 0} marcação(ões) de frequência removida(s).`
      }, client);
    });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
