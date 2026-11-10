import { requireModulePage } from "@/lib/page-auth";
import { DoctrineAttendanceClient } from "./doctrine-attendance-client";

export default async function FrequenciaPage() {
  await requireModulePage("module_doutrina", { department: "doutrina", module: "frequencia" });
  return (
    <>
      <header className="module-section-head"><div><h2>Frequência — Doutrina</h2><p>Controle mensal de participações por atividade.</p></div></header>
      <DoctrineAttendanceClient />
    </>
  );
}
