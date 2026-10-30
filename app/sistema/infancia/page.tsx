import { GroupsClient } from "@/components/education/groups-client";
import { PainelView } from "@/components/painel";
import { EducationNav } from "@/components/education/education-nav";
import { requireModulePage } from "@/lib/page-auth";
import { painelEvangelizacao } from "@/lib/paineis";

export default async function InfanciaPainelPage() {
  await requireModulePage("module_infancia", { department: "infancia" });
  return (
    <>
      <header className="page-heading"><div><h1>Infância</h1><p>Evangelização aos domingos, turmas pela idade em 30 de junho.</p></div></header>
      <EducationNav department="infancia" current="" />
      <PainelView painel={await painelEvangelizacao("infancia")} />
      <GroupsClient department="infancia" />
    </>
  );
}
