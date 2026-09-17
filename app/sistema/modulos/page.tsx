import { redirect } from "next/navigation";
import { requirePageActor } from "@/lib/page-auth";
import { hasPermission } from "@/lib/permissions";
import { FlagsClient } from "./flags-client";

export default async function ModulesPage() {
  const actor = await requirePageActor();
  if (!(await hasPermission(actor, "modules", "admin"))) redirect("/sistema");
  return (
    <>
      <header className="page-heading">
        <div><h1>Módulos e ondas</h1><p>Liberação controlada: um módulo de negócio só aceita dados depois do UAT aprovado.</p></div>
        <span className="production-badge">Somente administrador</span>
      </header>
      <FlagsClient />
    </>
  );
}
