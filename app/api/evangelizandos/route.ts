import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { query, transaction } from "@/lib/db";
import { errorResponse } from "@/lib/errors";
import { EDUCATION_LABEL } from "@/lib/education";
import {
  EVANGELIZANDO_COLUMNS, allowedGroups, assertGroupAllowed, canEditEducation, educationDepartment, requireEducation, withEffectiveStatus,
  type EvangelizandoRow
} from "@/lib/education-data";
import { evangelizandoSchema, evangelizandoValues, validateEvangelizando } from "@/lib/evangelizando-schema";
import { todayInSaoPaulo } from "@/lib/workers";

const createSchema = evangelizandoSchema.extend({ department_key: educationDepartment });

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const department = await requireEducation(actor, new URL(request.url).searchParams.get("department") ?? "", "read");
    const groups = await allowedGroups(actor, department);
    const result = await query<EvangelizandoRow>(
      `select ${EVANGELIZANDO_COLUMNS} from app.evangelizandos e where e.department_key = $1 order by e.full_name`,
      [department]
    );
    const rows = result.rows.map((row) => withEffectiveStatus(row)).filter((row) => !groups || groups.includes(row.current_group ?? ""));
    return Response.json(
      { evangelizandos: rows, canEdit: await canEditEducation(actor, department), scopedGroups: groups },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const input = createSchema.parse(await request.json());
    const department = await requireEducation(actor, input.department_key, "create");
    const today = todayInSaoPaulo();
    const filled = input.filled_date || today;
    const year = Number(filled.slice(0, 4));
    const c = validateEvangelizando(input, department, today, year);
    assertGroupAllowed(await allowedGroups(actor, department), c.group);
    const id = await transaction(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `insert into app.evangelizandos (full_name, birth_date, guardian_name, guardian_relation, guardian_phone, whatsapp, address,
            point_reference, father_name, father_contact, mother_name, mother_contact, religion, marital_status, rancho_requested, notes,
            department_key, filled_date, class_group, age_reference, valid_through_year, year_enrolled, status, created_by, updated_by)
         values ($1,$2::date,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::date,$19,$20,$21,$21,'active',$22,$22)
         returning id`,
        [...evangelizandoValues(input), department, filled, c.group, c.age, year, actor.id]
      );
      await appendAudit(actor, {
        category: "Inclusão", action: "Matrícula de evangelizando", module: EDUCATION_LABEL[department], section: "Evangelizandos",
        entityType: "evangelizando", entityId: inserted.rows[0].id,
        details: `${c.group} · matrícula ${year}${input.rancho_requested ? " · rancho solicitado ao Dpto Social" : ""}`
      }, client);
      return inserted.rows[0].id;
    });
    return Response.json({ id, group: c.group }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
