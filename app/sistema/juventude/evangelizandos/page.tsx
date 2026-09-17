import { EvangelizandosClient } from "@/components/education/evangelizandos-client";
import { EducationNav } from "@/components/education/education-nav";
import { requireModulePage } from "@/lib/page-auth";

export default async function JuventudeEvangelizandosPage() {
  await requireModulePage("module_juventude", { department: "juventude" });
  return (
    <>
      <header className="page-heading"><div><h1>Evangelizandos — Juventude</h1><p>Cadastro individual, responsável, foto e matrícula anual.</p></div></header>
      <EducationNav department="juventude" current="evangelizandos" />
      <EvangelizandosClient department="juventude" />
    </>
  );
}
