import { Sidebar } from "@/components/sidebar";
import { requirePageActor } from "@/lib/page-auth";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function SystemLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const actor = await requirePageActor();
  const [audit, attachments, users] = await Promise.all([
    hasPermission(actor, "audit", "read"),
    hasPermission(actor, "attachments", "admin"),
    hasPermission(actor, "users", "admin")
  ]);
  return (
    <div className="app-shell">
      <Sidebar actor={actor} capabilities={{ audit, attachments, users }} />
      <main className="app-main">{children}</main>
    </div>
  );
}
