import { EvangelizandosClient } from "@/components/education/evangelizandos-client";
import { EducationNav } from "@/components/education/education-nav";
import { requireModulePage } from "@/lib/page-auth";

export default async function InfanciaEvangelizandosPage() {
  await requireModulePage("module_infancia", { department: "infancia" });
  return (
    <>
      <header className="page-heading"><div><h1>Evangelizandos — Infância</h1><p>Cadastro individual, responsável, foto e matrícula anual.</p></div></header>
      <EducationNav department="infancia" current="evangelizandos" />
      <EvangelizandosClient department="infancia" />
    </>
  );
}
