import { redirect } from "next/navigation";
import { UserManager } from "./user-manager";
import { requirePageActor } from "@/lib/page-auth";
import { hasPermission } from "@/lib/permissions";

export default async function UsersPage() {
  const actor = await requirePageActor();
  if (!(await hasPermission(actor, "users", "admin"))) redirect("/sistema");
  return (
    <>
      <header className="page-heading"><div><h1>Usuários e permissões</h1><p>Contas individuais, vínculo institucional e acesso aplicado no servidor.</p></div><span className="production-badge">MFA obrigatório</span></header>
      <UserManager />
    </>
  );
}
