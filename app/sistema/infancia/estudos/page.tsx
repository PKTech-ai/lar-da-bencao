import { EducationNav } from "@/components/education/education-nav";
import { StudyLibrary } from "@/components/study-library";
import { requireModulePage } from "@/lib/page-auth";

export default async function InfanciaEstudosPage() {
  await requireModulePage("module_infancia", { department: "infancia" });
  return (
    <>
      <header className="page-heading"><div><h1>Biblioteca de Estudos — Infância</h1><p>Materiais da evangelização em pastas e subpastas.</p></div></header>
      <EducationNav department="infancia" current="estudos" />
      <StudyLibrary department="infancia" />
    </>
  );
}
