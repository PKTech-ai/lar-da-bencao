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
