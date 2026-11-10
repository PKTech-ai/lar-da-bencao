import { ModuleTabsByPath } from "@/components/module-tabs";
import { SuggestionsBox } from "@/components/suggestions-box";
import { doutrinaSubnav } from "@/lib/modules";
import { requireModulePage } from "@/lib/page-auth";
import { departmentModuleAccess } from "@/lib/permissions";

export default async function DoutrinaLayout({ children }: { children: React.ReactNode }) {
  // Sem acesso, a página daria 404 dentro deste layout e ainda mostraria o cabeçalho e as abas.
  const actor = await requireModulePage("module_doutrina", { department: "doutrina" });
  const access = await departmentModuleAccess(actor, "doutrina");
  const tabs = doutrinaSubnav.filter((tab) => access.can(tab.module, "read"));
  return (
    <>
      <header className="page-heading no-print">
        <div><h1>Dpto de Doutrina</h1><p>Treinamentos, escalas, estudos, palestras, Culto no Lar e trabalhadores.</p></div>
      </header>
      <ModuleTabsByPath tabs={tabs} label="Seções da Doutrina" />
      {children}
      <SuggestionsBox />
    </>
  );
}
