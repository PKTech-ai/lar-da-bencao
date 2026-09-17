import { redirect } from "next/navigation";
import { AccessMatrix } from "./access-matrix";
import { requirePageActor } from "@/lib/page-auth";
import { runtimeEnvironment } from "@/lib/environment";
import { hasPermission } from "@/lib/permissions";

export default async function AccessPage() {
  const actor = await requirePageActor();
  if (!(await hasPermission(actor, "users", "admin"))) redirect("/sistema");
  return (
    <>
      <header className="page-heading">
        <div>
          <h1>Controle de Acesso</h1>
          <p>O que cada perfil enxerga em cada página, as exceções registradas e os biênios da Diretoria.</p>
        </div>
      </header>
      <AccessMatrix canSimulate={!runtimeEnvironment().production} />
    </>
  );
}
