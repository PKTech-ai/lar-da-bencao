import { ScheduleClient } from "@/components/education/schedule-client";
import { EducationNav } from "@/components/education/education-nav";
import { requireModulePage } from "@/lib/page-auth";

export default async function InfanciaCronogramaPage() {
  await requireModulePage("module_infancia", { department: "infancia" });
  return (
    <>
      <header className="page-heading"><div><h1>Cronograma Mensal — Infância</h1><p>Tema e evangelizadores de cada turma, somente aos domingos.</p></div></header>
      <EducationNav department="infancia" current="cronograma" />
      <ScheduleClient department="infancia" />
    </>
  );
}
