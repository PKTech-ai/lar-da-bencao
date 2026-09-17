import { EducationNav } from "@/components/education/education-nav";
import { StudyLibrary } from "@/components/study-library";
import { requireModulePage } from "@/lib/page-auth";

export default async function JuventudeEstudosPage() {
  await requireModulePage("module_juventude", { department: "juventude" });
  return (
    <>
      <header className="page-heading"><div><h1>Biblioteca de Estudos — Juventude</h1><p>Materiais da evangelização em pastas e subpastas.</p></div></header>
      <EducationNav department="juventude" current="estudos" />
      <StudyLibrary department="juventude" />
    </>
  );
}
