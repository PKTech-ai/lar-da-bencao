import { GroupsClient } from "@/components/education/groups-client";
import { PainelView } from "@/components/painel";
import { EducationNav } from "@/components/education/education-nav";
import { requireModulePage } from "@/lib/page-auth";
import { painelEvangelizacao } from "@/lib/paineis";

export default async function JuventudePainelPage() {
  await requireModulePage("module_juventude", { department: "juventude" });
  return (
    <>
      <header className="page-heading"><div><h1>Juventude</h1><p>Pré-Juventude (13 e 14 anos) e Juventude (15 a 21 anos), idade em 30 de junho.</p></div></header>
      <EducationNav department="juventude" current="" />
      <PainelView painel={await painelEvangelizacao("juventude")} />
      <GroupsClient department="juventude" />
    </>
  );
}
