import { GroupsClient } from "@/components/education/groups-client";
import { EducationNav } from "@/components/education/education-nav";
import { requireModulePage } from "@/lib/page-auth";

export default async function InfanciaPainelPage() {
  await requireModulePage("module_infancia", { department: "infancia" });
  return (
    <>
      <header className="page-heading"><div><h1>Infância</h1><p>Evangelização aos domingos. Turmas pela idade em 30 de junho; dois evangelizadores por ciclo.</p></div></header>
      <EducationNav department="infancia" current="" />
      <GroupsClient department="infancia" />
    </>
  );
}
