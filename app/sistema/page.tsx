import { HomeClient } from "./home-client";
import { requirePageActor } from "@/lib/page-auth";

export default async function DashboardPage() {
  const actor = await requirePageActor();

  return (
    <>
      <header className="page-heading">
        <div>
          <h1>Visão Geral do Sistema</h1>
          <p>Acesse cada departamento pelo seu próprio módulo.</p>
        </div>
      </header>
      <HomeClient firstName={actor.name.split(" ")[0]} />
    </>
  );
}
