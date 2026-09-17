import type { Actor } from "@/lib/auth";
import { query } from "@/lib/db";
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
