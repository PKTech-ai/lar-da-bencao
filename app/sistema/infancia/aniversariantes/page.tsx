import { BirthdaysClient } from "@/components/education/birthdays-client";
import { EducationNav } from "@/components/education/education-nav";
import { requireModulePage } from "@/lib/page-auth";

export default async function InfanciaAniversariantesPage() {
  await requireModulePage("module_infancia", { department: "infancia" });
  return (
    <>
      <header className="page-heading"><div><h1>Aniversariantes — Infância</h1><p>Evangelizandos e evangelizadores por mês ou período.</p></div></header>
      <EducationNav department="infancia" current="aniversariantes" />
      <BirthdaysClient department="infancia" />
    </>
  );
}
