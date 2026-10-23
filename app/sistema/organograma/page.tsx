import { OrganogramClient } from "./organogram-client";
import { requirePageActor } from "@/lib/page-auth";

export default async function OrganogramPage() {
  await requirePageActor();
  return (
    <>
      <header className="page-heading"><div><h1>Organograma</h1><p>Visão sintética e analítica da estrutura institucional conforme Estatuto e Regimento.</p></div></header>
      <OrganogramClient />
    </>
  );
}
