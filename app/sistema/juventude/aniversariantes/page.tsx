import { BirthdaysClient } from "@/components/education/birthdays-client";
import { EducationNav } from "@/components/education/education-nav";
import { requireModulePage } from "@/lib/page-auth";

export default async function JuventudeAniversariantesPage() {
  await requireModulePage("module_juventude", { department: "juventude" });
  return (
    <>
      <header className="page-heading"><div><h1>Aniversariantes — Juventude</h1><p>Evangelizandos e evangelizadores por mês ou período.</p></div></header>
      <EducationNav department="juventude" current="aniversariantes" />
      <BirthdaysClient department="juventude" />
    </>
  );
}
