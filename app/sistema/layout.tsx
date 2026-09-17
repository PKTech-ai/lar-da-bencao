import { Sidebar } from "@/components/sidebar";
import { runtimeEnvironment } from "@/lib/environment";
import { listEnabledFlags } from "@/lib/feature-flags";
import { moduleCatalog } from "@/lib/modules";
import { requirePageActor } from "@/lib/page-auth";
import { hasAnyDepartmentPermission, hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function SystemLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const actor = await requirePageActor();
  const flags = await listEnabledFlags();
  const [audit, attachments, users, moduleAdmin] = await Promise.all([
    hasPermission(actor, "audit", "read"),
    hasPermission(actor, "attachments", "admin"),
    hasPermission(actor, "users", "admin"),
    hasPermission(actor, "modules", "admin")
  ]);

  const modules = [];
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

  return (
    <div className="app-shell">
      <Sidebar actor={actor} capabilities={{ audit, attachments, users, moduleAdmin, modules }} />
      <main className="app-main">
        {runtimeEnvironment().production ? null : <div className="notice no-print" role="note" style={{ marginBottom: 16 }}><strong>{runtimeEnvironment().label}.</strong> Não cadastre dados pessoais reais neste ambiente.</div>}
        {children}
      </main>
    </div>
  );
}
