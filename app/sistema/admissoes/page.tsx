import { notFound } from "next/navigation";
import { requireModulePage } from "@/lib/page-auth";
import { workerPageContext } from "@/lib/worker-page";
import { departmentsWith } from "@/lib/workers";
import { AdmissionsClient } from "./admissions-client";

/** Diretoria → Aprovação de Trabalhadores (consulta ampla: Diretoria, Secretaria e administrador). */
export default async function AdmissoesPage() {
  const actor = await requireModulePage("module_workers", { department: "any" });
  const context = await workerPageContext(actor);
  if (!context.canDecide && (await departmentsWith(actor, "read")) !== null) notFound();
  return (
    <>
      <header className="page-heading">
        <div><h1>Aprovação de Trabalhadores</h1><p>A Secretaria e os departamentos cadastram as fichas. A Diretoria aprova ou reprova; só depois da aprovação o trabalhador fica ativo.</p></div>
        <span className="production-badge">Diretoria</span>
      </header>
      <AdmissionsClient departments={context.departments} canDecide={context.canDecide} />
    </>
  );
}
