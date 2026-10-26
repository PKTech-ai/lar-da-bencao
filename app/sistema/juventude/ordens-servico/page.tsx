import { EducationNav } from "@/components/education/education-nav";
import { ServiceOrdersPanel } from "@/components/modules/ordens-servico";
import { requireModulePage } from "@/lib/page-auth";

export default async function JuventudeOrdensServicoPage() {
  await requireModulePage("module_juventude", { department: "juventude" });
  await requireModulePage("module_patrimonio", { department: "juventude" });
  return (
    <>
      <header className="page-heading"><div><h1>Ordens de Serviço — Juventude</h1><p>Pedidos ao Patrimônio e a posição de cada serviço.</p></div></header>
      <EducationNav department="juventude" current="ordens-servico" />
      <ServiceOrdersPanel department="juventude" />
    </>
  );
}
