import { requireModulePage } from "@/lib/page-auth";
import { workerPageContext } from "@/lib/worker-page";
import { WorkersClient } from "./workers-client";

export default async function TrabalhadoresPage() {
  const actor = await requireModulePage("module_workers", { department: "any" });
  const context = await workerPageContext(actor);
  return (
    <>
      <header className="page-heading">
        <div><h1>Trabalhadores</h1><p>Fichas por departamento. Toda ficha nova ou alterada passa pela aprovação da Diretoria antes da atuação.</p></div>
      </header>
      <WorkersClient {...context} />
    </>
  );
}
