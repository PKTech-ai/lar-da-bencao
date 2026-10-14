import { requirePageActor } from "@/lib/page-auth";
import { AccountClient } from "./account-client";

export default async function AccountPage() {
  await requirePageActor();
  return (
    <>
      <header className="page-heading"><div><h1>Minha área</h1><p>Cadastro, contribuições, escalas e segurança da conta.</p></div></header>
      <AccountClient />
    </>
  );
}
