import type { PoolClient } from "pg";
import { z } from "zod";
import { requireActor } from "@/lib/auth";
import { appendAudit } from "@/lib/audit";
import { assertSameOrigin } from "@/lib/csrf";
import { query, transaction } from "@/lib/db";
import {
  DEPARTMENT_MODULES, findDepartmentModule, levelFromMarks, marksFromLevel, type DepartmentLevel, type ModuleMark
} from "@/lib/department-modules";
import { AppError, errorResponse } from "@/lib/errors";
import { assertPermission } from "@/lib/permissions";

/** Acesso por pessoa: em cada departamento, os módulos marcados e, em cada um, se também pode alterar. */
type Marks = Record<string, ModuleMark[]>;

const putSchema = z.object({
  marks: z.record(z.string().regex(/^[a-z_]+$/), z.array(z.object({ module: z.string().regex(/^[a-z-]+$/), edit: z.boolean() })).max(40)),
  copiedFrom: z.string().uuid().nullish()
});

async function userId(context: { params: Promise<{ id: string }> }) {
  return z.string().uuid().parse((await context.params).id);
}

/** Marcas em vigor: as gravadas por módulo; sem elas, o equivalente ao nível que a pessoa já tinha. */
async function loadMarks(run: Pick<PoolClient, "query">, id: string): Promise<Marks> {
  const levels = await run.query<{ department_key: string; access_level: DepartmentLevel }>(
    "select department_key, access_level from app.user_departments where user_id = $1",
    [id]
  );
  const rows = await run.query<{ department_key: string; module_key: string; can_edit: boolean }>(
    "select department_key, module_key, can_edit from app.user_module_access where user_id = $1",
    [id]
  );
  const marks: Marks = {};
  for (const department of Object.keys(DEPARTMENT_MODULES)) {
    const own = rows.rows.filter((r) => r.department_key === department && findDepartmentModule(department, r.module_key));
    marks[department] = own.length
      ? own.map((r) => ({ module: r.module_key, edit: r.can_edit && !findDepartmentModule(department, r.module_key)?.viewOnly }))
      : marksFromLevel(department, levels.rows.find((l) => l.department_key === department)?.access_level);
  }
  return marks;
}

function validated(input: Marks): Marks {
  for (const [department, list] of Object.entries(input)) {
    if (!DEPARTMENT_MODULES[department]) throw new AppError("Departamento inexistente.", 400, "DEPARTMENT_NOT_FOUND");
    const seen = new Set<string>();
    for (const mark of list) {
      const item = findDepartmentModule(department, mark.module);
      if (!item || seen.has(mark.module)) throw new AppError("Módulo inválido.", 400, "MODULE_NOT_FOUND");
      if (mark.edit && item.viewOnly) throw new AppError(`${item.label} só pode ser consultado.`, 400, "MODULE_VIEW_ONLY");
      seen.add(mark.module);
    }
  }
  return input;
}

const key = (list: readonly ModuleMark[]) => JSON.stringify([...list].sort((a, b) => a.module.localeCompare(b.module)));

const describe = (department: string, list: readonly ModuleMark[]) =>
  list.length ? list.map((m) => `${findDepartmentModule(department, m.module)?.label ?? m.module}${m.edit ? " (altera)" : ""}`).join(", ") : "nada";

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
    const [departments, worker, groups, people] = await Promise.all([
      query<{ key: string; label: string; floor: "full" | "read" | null }>(
        `select d.key, d.label, app.page_level_links($1, '{}', '{}', d.page_key) as floor
           from app.departments d where d.active order by d.label`,
        [user.rows[0].role_key]
      ),
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
        : null,
      // Quem já tem algum acesso, para "Copiar acesso de".
      query<{ id: string; full_name: string; departments: string }>(
        `select u.id, u.full_name, string_agg(d.label, ', ' order by d.label) as departments
           from app.users u
           join app.user_departments ud on ud.user_id = u.id
           join app.departments d on d.key = ud.department_key
          where u.id <> $1 and u.status = 'active'
          group by u.id, u.full_name order by u.full_name`,
        [id]
      )
    ]);
    return Response.json({
      user: user.rows[0],
      marks: await loadMarks({ query: query as unknown as PoolClient["query"] }, id),
      departments: departments.rows,
      worker: worker?.rows[0] ?? null,
      groups: groups?.rows ?? [],
      people: people.rows
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
    const next = validated(input.marks);
    const changed = await transaction(async (client) => {
      const target = await client.query<{ full_name: string }>("select full_name from app.users where id = $1 for update", [id]);
      if (!target.rows[0]) throw new AppError("Usuário não encontrado.", 404, "USER_NOT_FOUND");
      const source = input.copiedFrom
        ? await client.query<{ full_name: string }>("select full_name from app.users where id = $1", [input.copiedFrom])
        : null;
      if (input.copiedFrom && !source?.rows[0]) throw new AppError("Pessoa de origem não encontrada.", 404, "USER_NOT_FOUND");
      const labels = await client.query<{ key: string; label: string }>("select key, label from app.departments where active");
      const label = (department: string) => labels.rows.find((d) => d.key === department)?.label;

      const current = await loadMarks(client, id);
      const before: Marks = {};
      const after: Marks = {};
      for (const department of Object.keys(next)) {
        if (!label(department)) throw new AppError("Departamento inexistente.", 400, "DEPARTMENT_NOT_FOUND");
        if (key(current[department] ?? []) === key(next[department])) continue;
        before[department] = current[department] ?? [];
        after[department] = next[department];

        await client.query("delete from app.user_module_access where user_id = $1 and department_key = $2", [id, department]);
        for (const mark of next[department]) {
          await client.query(
            `insert into app.user_module_access (user_id, department_key, module_key, can_edit, updated_by) values ($1, $2, $3, $4, $5)`,
            [id, department, mark.module, mark.edit, actor!.id]
          );
        }
        // O resumo é o que o restante do sistema lê: sempre refeito junto com as marcas.
        const level = levelFromMarks(department, next[department]);
        if (level) {
          await client.query(
            `insert into app.user_departments (user_id, department_key, access_level, updated_at, updated_by) values ($1, $2, $3, now(), $4)
             on conflict (user_id, department_key) do update set access_level = excluded.access_level, updated_at = now(), updated_by = excluded.updated_by`,
            [id, department, level, actor!.id]
          );
        } else {
          await client.query("delete from app.user_departments where user_id = $1 and department_key = $2", [id, department]);
        }
      }
      const departments = Object.keys(after);
      if (!departments.length) return false;
      const lines = departments.map((d) => `${label(d)}: ${describe(d, after[d])}`).join(" · ");
      await appendAudit(actor!, {
        category: "Segurança", action: "Alteração de acesso por módulo", module: "Controle de Acesso", section: "Usuários e Perfis",
        entityType: "user", entityId: id, result: "success",
        details: `${target.rows[0].full_name}${source?.rows[0] ? ` · copiado de ${source.rows[0].full_name}` : ""} · ${lines}`.slice(0, 1800),
        before, after
      }, client);
      return true;
    });
    return Response.json({ status: changed ? "updated" : "unchanged" });
  } catch (error) {
    if (actor) {
      await appendAudit(actor, {
        category: "Segurança", action: "Alteração de acesso por módulo falhou", module: "Controle de Acesso", section: "Usuários e Perfis",
        entityType: "user", result: "failed", reasonCode: error instanceof AppError ? error.code : "UNEXPECTED"
      }).catch(console.error);
    }
    return errorResponse(error);
  }
}
