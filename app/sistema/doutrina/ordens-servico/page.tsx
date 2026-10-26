import { ServiceOrdersPanel } from "@/components/modules/ordens-servico";
import { requireModulePage } from "@/lib/page-auth";

export default async function DoutrinaOrdensServicoPage() {
  await requireModulePage("module_patrimonio", { department: "doutrina" });
  return (
    <>
      <header className="module-section-head"><div><h2>Ordens de Serviço</h2><p>Pedidos da Doutrina ao Patrimônio.</p></div></header>
      <ServiceOrdersPanel department="doutrina" />
    </>
  );
}
