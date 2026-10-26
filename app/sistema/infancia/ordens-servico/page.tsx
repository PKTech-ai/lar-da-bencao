import { EducationNav } from "@/components/education/education-nav";
import { ServiceOrdersPanel } from "@/components/modules/ordens-servico";
import { requireModulePage } from "@/lib/page-auth";

export default async function InfanciaOrdensServicoPage() {
  await requireModulePage("module_infancia", { department: "infancia" });
  await requireModulePage("module_patrimonio", { department: "infancia" });
  return (
    <>
      <header className="page-heading"><div><h1>Ordens de Serviço — Infância</h1><p>Pedidos ao Patrimônio e a posição de cada serviço.</p></div></header>
      <EducationNav department="infancia" current="ordens-servico" />
      <ServiceOrdersPanel department="infancia" />
    </>
  );
}
