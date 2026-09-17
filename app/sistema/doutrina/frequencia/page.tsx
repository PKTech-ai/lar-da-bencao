import { requireModulePage } from "@/lib/page-auth";
import { DoctrineAttendanceClient } from "./doctrine-attendance-client";

export default async function FrequenciaPage() {
  await requireModulePage("module_doutrina", { department: "doutrina" });
  return (
    <>
      <header className="page-heading"><div><h1>Frequência — Doutrina</h1><p>Controle mensal de participações por atividade.</p></div></header>
      <DoctrineAttendanceClient />
    </>
  );
}
