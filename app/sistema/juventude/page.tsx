import { GroupsClient } from "@/components/education/groups-client";
import { EducationNav } from "@/components/education/education-nav";
import { requireModulePage } from "@/lib/page-auth";

export default async function JuventudePainelPage() {
  await requireModulePage("module_juventude", { department: "juventude" });
  return (
    <>
      <header className="page-heading"><div><h1>Juventude</h1><p>Pré-Juventude (13 e 14 anos) e Juventude (15 a 21 anos). Idade considerada em 30 de junho; responsável obrigatório para menores de 18 anos.</p></div></header>
      <EducationNav department="juventude" current="" />
      <GroupsClient department="juventude" />
    </>
  );
}
