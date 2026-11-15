import { notFound } from "next/navigation";
import { EducationNav } from "@/components/education/education-nav";
import { GroupsClient } from "@/components/education/groups-client";
import { requireModulePage } from "@/lib/page-auth";
import { departmentModuleAccess } from "@/lib/permissions";

export default async function JuventudeTurmasPage() {
  const actor = await requireModulePage("module_juventude", { department: "juventude" });
  const access = await departmentModuleAccess(actor, "juventude");
  if (!access.can("painel", "read") && !access.can("evangelizadores", "read")) notFound();
  return (
    <>
      <header className="page-heading"><div><h1>Grupos — Juventude</h1><p>Escolha os dois evangelizadores de cada grupo.</p></div></header>
      <EducationNav department="juventude" current="turmas" />
      <GroupsClient department="juventude" />
    </>
  );
}
