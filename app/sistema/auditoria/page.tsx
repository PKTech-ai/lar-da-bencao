import { redirect } from "next/navigation";
import { AuditClient } from "./audit-client";
import { requirePageActor } from "@/lib/page-auth";
import { hasPermission } from "@/lib/permissions";

export default async function AuditPage() {
  const actor = await requirePageActor();
  if (!(await hasPermission(actor, "audit", "read"))) redirect("/sistema");
  const canExport = await hasPermission(actor, "audit", "export");
  return (
    <>
      <header className="page-heading"><div><h1>Dedo-duro — Histórico</h1><p>Eventos confirmados pelo servidor, protegidos contra edição e exclusão.</p></div><span className="production-badge">Append-only</span></header>
      <AuditClient canExport={canExport} />
    </>
  );
}
