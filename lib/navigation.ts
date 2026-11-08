import { cache } from "react";
import type { Actor } from "@/lib/auth";
import { query } from "@/lib/db";
import { listEnabledFlags } from "@/lib/feature-flags";
import { moduleCatalog } from "@/lib/modules";
import { hasAnyDepartmentPermission, hasPermission } from "@/lib/permissions";
import { canSeeAdmissions } from "@/lib/workers";

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
    if (mod.key === "admissoes") {
      if (await canSeeAdmissions(actor)) modules.push({ href: mod.href, label: mod.label });
      continue;
    }
    const allowed = mod.department
      ? await hasPermission(actor, mod.permissionResource, "read", mod.department)
      : mod.permissionResource === "department"
        ? await hasAnyDepartmentPermission(actor, "read")
        : await hasPermission(actor, mod.permissionResource, "read");
    if (allowed) modules.push({ href: mod.href, label: mod.label });
  }
  // Quem tem só a Chamada num departamento da Evangelização vê um atalho direto para a chamada.
  const calls = await query<{ department_key: string }>(
    "select department_key from app.user_departments where user_id = $1 and access_level = 'chamada' and department_key in ('infancia','juventude')",
    [actor.id]
  );
  for (const { department_key: key } of calls.rows) {
    const mod = moduleCatalog.find((item) => item.key === key);
    if (!mod || !flags.get(mod.flagKey) || modules.some((item) => item.href === mod.href)) continue;
    modules.push({ href: `${mod.href}/frequencia`, label: `Chamada · ${mod.label}` });
  }
  const serviceOrders = Boolean(flags.get("module_patrimonio")) && await hasAnyDepartmentPermission(actor, "read");
  return {
    modules,
    roleLabel: role.rows[0]?.label ?? actor.role,
    capabilities: { audit, attachments, users, moduleAdmin, serviceOrders, modules }
  };
});
