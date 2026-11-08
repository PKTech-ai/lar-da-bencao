import { EducationAttendanceClient } from "@/components/education/attendance-client";
import { EducationNav } from "@/components/education/education-nav";
import { requireAttendancePage } from "@/lib/page-auth";

export default async function InfanciaFrequenciaPage() {
  const { seesDepartment } = await requireAttendancePage("module_infancia", "infancia");
  return (
    <>
      <header className="page-heading"><div><h1>Chamada e Frequência Mensal — Infância</h1><p>Chamada dominical por evangelizando.</p></div></header>
      {seesDepartment ? <EducationNav department="infancia" current="frequencia" /> : null}
      <EducationAttendanceClient department="infancia" />
    </>
  );
}
