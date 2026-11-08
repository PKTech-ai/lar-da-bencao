import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { query, transaction } from "@/lib/db";
import { AppError, errorResponse } from "@/lib/errors";
import { assertPermission } from "@/lib/permissions";

/** Acesso por pessoa: em cada departamento, Nenhum, Chamada (só Evangelização), Consulta ou Coordenação. */
const LEVELS = ["nenhum", "chamada", "consulta", "coordenacao"] as const;
const CALL_DEPARTMENTS = ["infancia", "juventude"];
const LEVEL_LABEL: Record<(typeof LEVELS)[number], string> = { nenhum: "Nenhum", chamada: "Chamada", consulta: "Consulta", coordenacao: "Coordenação" };

const putSchema = z.object({
  department: z.string().regex(/^[a-z_]+$/),
  level: z.enum(LEVELS)
});

async function userId(context: { params: Promise<{ id: string }> }) {
  return z.string().uuid().parse((await context.params).id);
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    await assertPermission(actor, "users", "admin");
    const id = await userId(context);
    const user = await query<{ id: string; full_name: string; email: string; role_key: string; role_label: string; worker_id: string | null }>(
      `select u.id, u.full_name, u.email, u.role_key, coalesce(r.label, u.role_key) as role_label, u.worker_id
         from app.users u left join app.roles r on r.key = u.role_key where u.id = $1`,
      [id]
    );
    if (!user.rows[0]) throw new AppError("Usuário não encontrado.", 404, "USER_NOT_FOUND");
    const workerId = user.rows[0].worker_id;
    const [links, departments, worker, groups] = await Promise.all([
      query<{ department_key: string; access_level: string; updated_at: string; updated_by_name: string | null }>(
        `select ud.department_key, ud.access_level, ud.updated_at, b.full_name as updated_by_name
           from app.user_departments ud left join app.users b on b.id = ud.updated_by
          where ud.user_id = $1 order by ud.department_key`,
        [id]
      ),
      query<{ key: string; label: string }>("select key, label from app.departments where active order by label"),
      workerId
        ? query<{ functions: string[]; departments: string[] }>(
          `select w.functions, coalesce(array_agg(wd.department_key) filter (where wd.department_key is not null), '{}') as departments
             from app.workers w left join app.worker_departments wd on wd.worker_id = w.id
            where w.id = $1 group by w.id`,
          [workerId]
        )
        : null,
      workerId
        ? query<{ department_key: string; class_group: string }>(
          "select department_key, class_group from app.education_group_evangelizers where worker_id = $1 order by department_key, class_group",
          [workerId]
        )
        : null
    ]);
    return Response.json({
      user: user.rows[0],
      links: links.rows,
      departments: departments.rows,
      worker: worker?.rows[0] ?? null,
      groups: groups?.rows ?? [],
      callDepartments: CALL_DEPARTMENTS
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  let actor = null;
  try {
    assertSameOrigin(request);
    actor = await requireActor();
    // Só o Administrador libera acesso.
    await assertPermission(actor, "users", "admin");
    const id = await userId(context);
    const input = putSchema.parse(await request.json());
    if (input.level === "chamada" && !CALL_DEPARTMENTS.includes(input.department)) {
      throw new AppError("A Chamada existe só na Infância e na Juventude.", 400, "CALL_NOT_AVAILABLE");
    }
    await transaction(async (client) => {
      const target = await client.query<{ full_name: string }>("select full_name from app.users where id = $1", [id]);
      if (!target.rows[0]) throw new AppError("Usuário não encontrado.", 404, "USER_NOT_FOUND");
      const department = await client.query<{ label: string }>("select label from app.departments where key = $1 and active", [input.department]);
      if (!department.rows[0]) throw new AppError("Departamento inexistente.", 400, "DEPARTMENT_NOT_FOUND");
      const current = await client.query<{ access_level: (typeof LEVELS)[number] }>(
        "select access_level from app.user_departments where user_id = $1 and department_key = $2 for update",
        [id, input.department]
      );
      const before = current.rows[0]?.access_level ?? "nenhum";
      if (before === input.level) return;
      if (input.level === "nenhum") {
        await client.query("delete from app.user_departments where user_id = $1 and department_key = $2", [id, input.department]);
      } else {
        await client.query(
          `insert into app.user_departments (user_id, department_key, access_level, updated_at, updated_by) values ($1, $2, $3, now(), $4)
           on conflict (user_id, department_key) do update set access_level = excluded.access_level, updated_at = now(), updated_by = excluded.updated_by`,
          [id, input.department, input.level, actor!.id]
        );
      }
      await appendAudit(actor!, {
        category: "Segurança", action: "Alteração de acesso por departamento", module: "Controle de Acesso", section: "Usuários e Perfis",
        entityType: "user", entityId: id, result: "success",
        details: `${target.rows[0].full_name} · ${department.rows[0].label}: ${LEVEL_LABEL[before]} → ${LEVEL_LABEL[input.level]}.`,
        before: { department: input.department, level: before }, after: { department: input.department, level: input.level }
      }, client);
    });
    return Response.json({ status: "updated" });
  } catch (error) {
    if (actor) {
      await appendAudit(actor, {
        category: "Segurança", action: "Alteração de acesso por departamento falhou", module: "Controle de Acesso", section: "Usuários e Perfis",
        entityType: "user", result: "failed", reasonCode: error instanceof AppError ? error.code : "UNEXPECTED"
      }).catch(console.error);
    }
    return errorResponse(error);
  }
}
