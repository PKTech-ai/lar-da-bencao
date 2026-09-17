import { requireModulePage } from "@/lib/page-auth";
import { ScalesClient } from "./scales-client";

export default async function EscalasPage() {
  await requireModulePage("module_doutrina", { department: "doutrina" });
  return (
    <>
      <header className="page-heading">
        <div><h1>Escala Mensal — Doutrina</h1><p>Gerar, conferir, aprovar e publicar. Somente trabalhadores aprovados pela Diretoria aparecem nas opções.</p></div>
      </header>
      <ScalesClient />
    </>
  );
}
