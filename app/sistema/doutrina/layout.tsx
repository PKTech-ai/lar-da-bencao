import { ModuleTabsByPath } from "@/components/module-tabs";
import { doutrinaSubnav } from "@/lib/modules";
import { requireModulePage } from "@/lib/page-auth";

export default async function DoutrinaLayout({ children }: { children: React.ReactNode }) {
  // Sem acesso, a página daria 404 dentro deste layout e ainda mostraria o cabeçalho e as abas.
  await requireModulePage("module_doutrina", { department: "doutrina" });
  return (
    <>
      <header className="page-heading no-print">
        <div><h1>Dpto de Doutrina</h1><p>Treinamentos, escalas, estudos, palestras, Culto no Lar e trabalhadores.</p></div>
      </header>
      <ModuleTabsByPath tabs={doutrinaSubnav} label="Seções da Doutrina" />
      {children}
    </>
  );
}
