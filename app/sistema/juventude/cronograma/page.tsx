import { ScheduleClient } from "@/components/education/schedule-client";
import { EducationNav } from "@/components/education/education-nav";
import { requireModulePage } from "@/lib/page-auth";

export default async function JuventudeCronogramaPage() {
  await requireModulePage("module_juventude", { department: "juventude" });
  return (
    <>
      <header className="page-heading"><div><h1>Cronograma Mensal — Juventude</h1><p>Tema e evangelizadores de cada turma, somente aos domingos.</p></div></header>
      <EducationNav department="juventude" current="cronograma" />
      <ScheduleClient department="juventude" />
    </>
  );
}
