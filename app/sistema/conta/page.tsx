import { requirePageActor } from "@/lib/page-auth";
import { AccountClient } from "./account-client";

export default async function AccountPage() {
  await requirePageActor();
  return (
    <>
      <header className="page-heading"><div><h1>Minha conta</h1><p>Senha e últimos eventos de segurança.</p></div></header>
      <AccountClient />
    </>
  );
}
