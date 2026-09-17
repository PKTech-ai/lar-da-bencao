import { OrganogramClient } from "./organogram-client";
import { requirePageActor } from "@/lib/page-auth";

export default async function OrganogramPage() {
  await requirePageActor();
  return (
    <>
      <header className="page-heading"><div><h1>Organograma</h1><p>Diretoria do biênio e coordenação de cada departamento.</p></div></header>
      <OrganogramClient />
    </>
  );
}
