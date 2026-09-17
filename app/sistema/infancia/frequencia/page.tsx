import { EducationAttendanceClient } from "@/components/education/attendance-client";
import { EducationNav } from "@/components/education/education-nav";
import { requireModulePage } from "@/lib/page-auth";

export default async function InfanciaFrequenciaPage() {
  await requireModulePage("module_infancia", { department: "infancia" });
  return (
    <>
      <header className="page-heading"><div><h1>Chamada e Frequência Mensal — Infância</h1><p>Chamada dominical por evangelizando.</p></div></header>
      <EducationNav department="infancia" current="frequencia" />
      <EducationAttendanceClient department="infancia" />
    </>
  );
}
