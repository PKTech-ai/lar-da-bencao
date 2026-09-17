import { StudyLibrary } from "@/components/study-library";
import { requireModulePage } from "@/lib/page-auth";

export default async function EstudosPage() {
  await requireModulePage("module_doutrina", { department: "doutrina" });
  return (
    <>
      <header className="page-heading"><div><h1>Biblioteca de Estudos — Doutrina</h1><p>Roteiros ESE, ESDE, MEP, Obras e temas de palestra com arquivos inspecionados.</p></div></header>
      <StudyLibrary department="doutrina" />
    </>
  );
}
