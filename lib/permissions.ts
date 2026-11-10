import type { Actor } from "@/lib/auth";
import { query } from "@/lib/db";
import { resolveModuleLevel, type DepartmentLevel, type ModuleLevel } from "@/lib/department-modules";
import { AuthorizationError } from "@/lib/errors";

export const actions = ["read", "create", "update", "delete", "approve", "export", "print", "download", "admin"] as const;
export type PermissionAction = (typeof actions)[number];

type PermissionRow = { allowed: boolean };

export async function hasPermission(
  actor: Actor,
  resource: string,
  action: PermissionAction,
  department?: string | null
): Promise<boolean> {
  const result = await query<PermissionRow>("select app.has_permission($1, $2, $3, $4) as allowed", [
    actor.id,
    resource,
    action,
    department ?? null
  ]);
  return result.rows[0]?.allowed === true;
}

export async function assertPermission(
  actor: Actor,
  resource: string,
  action: PermissionAction,
  department?: string | null
) {
  if (!(await hasPermission(actor, resource, action, department))) throw new AuthorizationError();
}

/** Departamentos em que o ator tem a ação (considera perfil, página e vínculo). */
export async function departmentsWithPermission(actor: Actor, action: PermissionAction): Promise<string[]> {
  const result = await query<{ key: string }>(
    "select key from app.departments d where d.active and app.has_permission($1, 'department', $2, d.key) order by key",
    [actor.id, action]
  );
  return result.rows.map((row) => row.key);
}

/** Para telas transversais (trabalhadores/admissões) quando o escopo é “qualquer departamento do ator”. */
export async function hasAnyDepartmentPermission(actor: Actor, action: PermissionAction) {
  return (await departmentsWithPermission(actor, action)).length > 0;
}

export async function assertAnyDepartmentPermission(actor: Actor, action: PermissionAction) {
  if (!(await hasAnyDepartmentPermission(actor, action))) throw new AuthorizationError();
}

export type PageLevel = "full" | "read" | null;

export async function pageLevel(actor: Actor, page: string): Promise<PageLevel> {
  const result = await query<{ level: PageLevel }>("select app.page_level($1, $2) as level", [actor.id, page]);
  return result.rows[0]?.level ?? null;
}

type ModuleAccessRow = { department: string; floor: "full" | "read" | null; access_level: DepartmentLevel | null; marks: Record<string, boolean> };

const READ_ACTIONS: readonly PermissionAction[] = ["read", "print", "export", "download"];

export function levelAllows(level: ModuleLevel, action: PermissionAction) {
  return level === "full" || (level === "read" && READ_ACTIONS.includes(action));
}

/** O que vem do perfil (`floor`), o nível antigo e as marcas por módulo, departamento a departamento. */
const MODULE_ACCESS_SQL = `
  select d.key as department,
         app.page_level_links(u.role_key, '{}', '{}', d.page_key) as floor,
         ud.access_level,
         coalesce((select json_object_agg(m.module_key, m.can_edit) from app.user_module_access m
                    where m.user_id = u.id and m.department_key = d.key), '{}'::json) as marks
    from app.users u
    join app.departments d on d.active
    left join app.user_departments ud on ud.user_id = u.id and ud.department_key = d.key
   where u.id = $1 and app.user_access_allowed(u.id)`;

function toAccess(row: ModuleAccessRow | undefined) {
  const levelOf = (module: string): ModuleLevel =>
    row ? resolveModuleLevel({ module, floor: row.floor, level: row.access_level, marks: row.marks }) : null;
  return {
    levelOf,
    can: (module: string | readonly string[], action: PermissionAction) =>
      (typeof module === "string" ? [module] : module).some((item) => levelAllows(levelOf(item), action)),
    /** A pessoa tem marcas por módulo neste departamento (e não só o nível antigo). */
    fine: Boolean(row && Object.keys(row.marks).length > 0),
    /** O módulo foi marcado para a pessoa em Usuários › Acesso. */
    marked: (module: string) => Boolean(row && module in row.marks)
  };
}

/** Acesso da pessoa aos módulos de um departamento, em uma consulta: pergunte por vários módulos sem voltar ao banco. */
export async function departmentModuleAccess(actor: Pick<Actor, "id">, department: string) {
  const result = await query<ModuleAccessRow>(`${MODULE_ACCESS_SQL} and d.key = $2`, [actor.id, department]);
  return toAccess(result.rows[0]);
}

/** O módulo (ou algum dos módulos) aberto para esta ação. Substitui a checagem por departamento nas telas e gravações. */
export async function hasModule(actor: Pick<Actor, "id">, department: string, module: string | readonly string[], action: PermissionAction) {
  return (await departmentModuleAccess(actor, department)).can(module, action);
}

export async function assertModule(actor: Pick<Actor, "id">, department: string, module: string | readonly string[], action: PermissionAction) {
  if (!(await hasModule(actor, department, module, action))) throw new AuthorizationError();
}

/** Departamentos em que a pessoa tem o módulo. `module` pode variar por departamento. */
export async function departmentsWithModule(actor: Pick<Actor, "id">, module: string | ((department: string) => string), action: PermissionAction) {
  const result = await query<ModuleAccessRow>(`${MODULE_ACCESS_SQL} order by d.key`, [actor.id]);
  return result.rows
    .filter((row) => toAccess(row).can(typeof module === "string" ? module : module(row.department), action))
    .map((row) => row.department);
}
