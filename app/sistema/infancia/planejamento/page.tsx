import { PlanClient } from "@/components/education/plan-client";
import { EducationNav } from "@/components/education/education-nav";
import { requireModulePage } from "@/lib/page-auth";

export default async function InfanciaPlanejamentoPage() {
  await requireModulePage("module_infancia", { department: "infancia" });
  return (
    <>
      <header className="page-heading"><div><h1>Planejamento Anual — Infância</h1><p>Conteúdos, atividades especiais e acompanhamento do departamento.</p></div></header>
      <EducationNav department="infancia" current="planejamento" />
      <PlanClient department="infancia" />
    </>
  );
}
