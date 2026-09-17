import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { query, transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { EDUCATION_LABEL, GROUPS, groupNames } from "@/lib/education";
import { allowedGroups, canEditEducation, requireEducation, withEffectiveStatus, EVANGELIZANDO_COLUMNS, type EvangelizandoRow } from "@/lib/education-data";

const putSchema = z.object({ group: z.string(), position: z.union([z.literal(0), z.literal(1)]), worker_id: z.string().uuid().nullable() });
type Params = { params: Promise<{ department: string }> };

/** Turmas/grupos com faixa etária, evangelizadores (2 por turma) e inscritos. */
export async function GET(_request: Request, context: Params) {
  try {
    const actor = await requireActor();
    const department = await requireEducation(actor, (await context.params).department, "read");
    const [links, workers, students] = await Promise.all([
      query<{ class_group: string; position: number; worker_id: string; full_name: string }>(
        `select g.class_group, g.position, g.worker_id, w.full_name from app.education_group_evangelizers g
           join app.workers w on w.id = g.worker_id where g.department_key = $1`,
        [department]
      ),
      query<{ id: string; full_name: string }>(
        `select w.id, w.full_name from app.workers w join app.worker_departments d on d.worker_id = w.id and d.department_key = $1
          where w.status = 'active' order by w.full_name`,
        [department]
      ),
      query<EvangelizandoRow>(`select ${EVANGELIZANDO_COLUMNS} from app.evangelizandos e where e.department_key = $1`, [department])
    ]);
    const active = students.rows.map((row) => withEffectiveStatus(row)).filter((row) => row.active);
    const groups = GROUPS[department].map((g) => ({
      ...g,
      enrolled: active.filter((s) => s.current_group === g.name).length,
      evangelizers: [0, 1].map((position) => {
        const link = links.rows.find((l) => l.class_group === g.name && l.position === position);
        return link ? { worker_id: link.worker_id, name: link.full_name } : null;
      })
    }));
    return Response.json({
      groups,
      workers: workers.rows,
      canEdit: await canEditEducation(actor, department),
      scopedGroups: await allowedGroups(actor, department)
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, context: Params) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const department = await requireEducation(actor, (await context.params).department, "update");
    const input = putSchema.parse(await request.json());
    if (!groupNames(department).includes(input.group)) throw new AppError("Turma inválida.");
    await transaction(async (client) => {
      const before = await client.query<{ worker_id: string }>(
        "select worker_id from app.education_group_evangelizers where department_key=$1 and class_group=$2 and position=$3 for update",
        [department, input.group, input.position]
      );
      if (input.worker_id) {
        const worker = await client.query(
          `select 1 from app.workers w join app.worker_departments d on d.worker_id = w.id and d.department_key = $2
            where w.id = $1 and w.status = 'active'`,
          [input.worker_id, department]
        );
        if (!worker.rowCount) throw new AppError("Evangelizador sem aprovação da Diretoria ou fora do departamento.", 409, "WORKER_NOT_APPROVED");
        const other = await client.query(
          "select 1 from app.education_group_evangelizers where department_key=$1 and class_group=$2 and position<>$3 and worker_id=$4",
          [department, input.group, input.position, input.worker_id]
        );
        if (other.rowCount) throw new AppError("Selecione dois evangelizadores diferentes para a turma.", 409, "DUPLICATE_EVANGELIZER");
        await client.query(
          `insert into app.education_group_evangelizers (department_key, class_group, position, worker_id, updated_by) values ($1,$2,$3,$4,$5)
           on conflict (department_key, class_group, position) do update set worker_id = excluded.worker_id, updated_by = excluded.updated_by, updated_at = now()`,
          [department, input.group, input.position, input.worker_id, actor.id]
        );
      } else {
        await client.query("delete from app.education_group_evangelizers where department_key=$1 and class_group=$2 and position=$3", [department, input.group, input.position]);
      }
      await appendAudit(actor, {
        category: "Edição", action: "Evangelizador da turma atualizado", module: EDUCATION_LABEL[department], section: "Turmas",
        entityType: "class_group", entityId: `${department}:${input.group}`,
        before: { worker_id: before.rows[0]?.worker_id ?? null }, after: { worker_id: input.worker_id, position: input.position }
      }, client);
    });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
