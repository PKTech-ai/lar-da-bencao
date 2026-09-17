import { PlanClient } from "@/components/education/plan-client";
import { EducationNav } from "@/components/education/education-nav";
import { requireModulePage } from "@/lib/page-auth";

export default async function JuventudePlanejamentoPage() {
  await requireModulePage("module_juventude", { department: "juventude" });
  return (
    <>
      <header className="page-heading"><div><h1>Planejamento Anual — Juventude</h1><p>Conteúdos, atividades especiais e acompanhamento do departamento.</p></div></header>
      <EducationNav department="juventude" current="planejamento" />
      <PlanClient department="juventude" />
    </>
  );
}
