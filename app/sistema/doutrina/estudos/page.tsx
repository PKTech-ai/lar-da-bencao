import { StudyLibrary } from "@/components/study-library";
import { requireModulePage } from "@/lib/page-auth";

export default async function EstudosPage() {
  await requireModulePage("module_doutrina", { department: "doutrina" });
  return (
    <>
      <header className="module-section-head"><div><h2>Biblioteca de Estudos — Doutrina</h2><p>Roteiros ESE, ESDE, MEP, Obras e temas de palestra com arquivos inspecionados.</p></div></header>
      <StudyLibrary department="doutrina" />
    </>
  );
}
