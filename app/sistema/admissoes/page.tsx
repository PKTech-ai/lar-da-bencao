import { notFound } from "next/navigation";
import { isFlagEnabled } from "@/lib/feature-flags";
import { requirePageActor } from "@/lib/page-auth";
import { canSeeAdmissions } from "@/lib/workers";
import { AdmissionsSection } from "./admissions-section";

/** Aprovação de Trabalhadores: Administrador e Presidente, ou quem teve o acesso marcado no convite. */
export default async function AdmissoesPage() {
  const actor = await requirePageActor();
  if (!(await isFlagEnabled("module_workers")) || !(await canSeeAdmissions(actor))) notFound();
  return (
    <>
      <header className="page-heading">
        <div><h1>Aprovação de Trabalhadores</h1><p>A Secretaria e os departamentos cadastram as fichas. Em Abrir ficha você confere os dados e o histórico, edita ou exclui. Aprovar aprova direto; Aprovar todos aprova o lote.</p></div>
      </header>
      <AdmissionsSection actor={actor} />
    </>
  );
}
