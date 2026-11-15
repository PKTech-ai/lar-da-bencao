import { notFound } from "next/navigation";
import { EducationNav } from "@/components/education/education-nav";
import { GroupsClient } from "@/components/education/groups-client";
import { requireModulePage } from "@/lib/page-auth";
import { departmentModuleAccess } from "@/lib/permissions";

export default async function InfanciaTurmasPage() {
  const actor = await requireModulePage("module_infancia", { department: "infancia" });
  const access = await departmentModuleAccess(actor, "infancia");
  if (!access.can("painel", "read") && !access.can("evangelizadores", "read")) notFound();
  return (
    <>
      <header className="page-heading"><div><h1>Turmas — Infância</h1><p>Escolha os dois evangelizadores de cada turma.</p></div></header>
      <EducationNav department="infancia" current="turmas" />
      <GroupsClient department="infancia" />
    </>
  );
}
