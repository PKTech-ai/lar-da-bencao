import { HomeClient } from "./home-client";
import { loadNavigation } from "@/lib/navigation";
import { requirePageActor } from "@/lib/page-auth";

export default async function DashboardPage() {
  const actor = await requirePageActor();
  const nav = await loadNavigation(actor);

  return <HomeClient modules={nav.modules} firstName={actor.name.trim().split(/\s+/)[0] ?? ""} />;
}
