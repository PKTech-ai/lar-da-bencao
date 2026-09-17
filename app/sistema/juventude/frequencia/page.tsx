import { EducationAttendanceClient } from "@/components/education/attendance-client";
import { EducationNav } from "@/components/education/education-nav";
import { requireModulePage } from "@/lib/page-auth";

export default async function JuventudeFrequenciaPage() {
  await requireModulePage("module_juventude", { department: "juventude" });
  return (
    <>
      <header className="page-heading"><div><h1>Chamada e Frequência Mensal — Juventude</h1><p>Chamada dominical por evangelizando.</p></div></header>
      <EducationNav department="juventude" current="frequencia" />
      <EducationAttendanceClient department="juventude" />
    </>
  );
}
