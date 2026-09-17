import { redirect } from "next/navigation";
import { InstitutionForm } from "./institution-form";
import { requirePageActor } from "@/lib/page-auth";
import { hasPermission } from "@/lib/permissions";

export default async function InstitutionPage() {
  const actor = await requirePageActor();
  if (!(await hasPermission(actor, "users", "admin"))) redirect("/sistema");
  return (
    <>
      <header className="page-heading"><div><h1>Dados da instituição</h1><p>Nome, fundação e contatos usados na Visão Geral e nas impressões.</p></div></header>
      <InstitutionForm />
    </>
  );
}
