import { EducationAttendanceClient } from "@/components/education/attendance-client";
import { EducationNav } from "@/components/education/education-nav";
import { requireAttendancePage } from "@/lib/page-auth";

export default async function JuventudeFrequenciaPage() {
  const { seesDepartment } = await requireAttendancePage("module_juventude", "juventude");
  return (
    <>
      <header className="page-heading"><div><h1>Chamada e Frequência Mensal — Juventude</h1><p>Chamada dominical por evangelizando.</p></div></header>
      {seesDepartment ? <EducationNav department="juventude" current="frequencia" /> : null}
      <EducationAttendanceClient department="juventude" />
    </>
  );
}
