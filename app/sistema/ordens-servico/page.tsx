import { ServiceOrdersPanel } from "@/components/modules/ordens-servico";
import { requireModulePage } from "@/lib/page-auth";

export default async function ServiceOrdersPage() {
  await requireModulePage("module_patrimonio", { department: "any" });
  return (
    <>
      <header className="page-heading"><div><h1>Ordens de Serviço</h1><p>Pedidos dos departamentos ao Patrimônio, com a posição de cada serviço.</p></div></header>
      <ServiceOrdersPanel />
    </>
  );
}
