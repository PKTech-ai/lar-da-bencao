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
          <h1>Visão Geral</h1>
        </div>
      </header>
      <HomeClient modules={nav.modules} showAccess={nav.capabilities.users} />
    </>
  );
}
