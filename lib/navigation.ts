import { cache } from "react";
import type { Actor } from "@/lib/auth";
import { query } from "@/lib/db";
import { listEnabledFlags } from "@/lib/feature-flags";
import { moduleCatalog } from "@/lib/modules";
import { hasAnyDepartmentPermission, hasPermission } from "@/lib/permissions";

export type VisibleModule = { href: string; label: string };

export function safeInternalPath(value: string | null | undefined, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const base = new URL("https://internal.invalid");
    const resolved = new URL(value, base);
    if (resolved.origin !== base.origin) return fallback;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}

export const loadNavigation = cache(async (actor: Actor) => {
  const flags = await listEnabledFlags();
  const [audit, attachments, users, moduleAdmin, role] = await Promise.all([
    hasPermission(actor, "audit", "read"),
    hasPermission(actor, "attachments", "admin"),
    hasPermission(actor, "users", "admin"),
    hasPermission(actor, "modules", "admin"),
    query<{ label: string }>("select label from app.roles where key = $1", [actor.role])
  ]);
  const modules: VisibleModule[] = [];
  for (const mod of moduleCatalog) {
    if (mod.key === "home") continue;
    if (!flags.get(mod.flagKey)) continue;
    const allowed = mod.department
      ? await hasPermission(actor, mod.permissionResource, "read", mod.department)
      : mod.permissionResource === "department"
        ? await hasAnyDepartmentPermission(actor, "read")
        : await hasPermission(actor, mod.permissionResource, "read");
    if (allowed) modules.push({ href: mod.href, label: mod.label });
  }
  return {
    modules,
    roleLabel: role.rows[0]?.label ?? actor.role,
    capabilities: { audit, attachments, users, moduleAdmin, modules }
  };
});
