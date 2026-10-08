import { HomeClient } from "./home-client";
import { loadNavigation } from "@/lib/navigation";
import { requirePageActor } from "@/lib/page-auth";

export default async function DashboardPage() {
  const actor = await requirePageActor();
  const nav = await loadNavigation(actor);

  return (
    <>
      <header className="page-heading">
        <div>
          <h1>Visão Geral do Sistema</h1>
          <p>Acesse cada departamento pelo seu próprio módulo.</p>
        </div>
      </header>
      <HomeClient moduleCount={nav.modules.length} />
    </>
  );
}
