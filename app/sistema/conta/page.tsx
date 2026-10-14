import { requirePageActor } from "@/lib/page-auth";
import { AccountClient } from "./account-client";

export default async function AccountPage() {
  await requirePageActor();
  return (
    <>
      <header className="page-heading"><div><h1>Minha área</h1><p>Confira seu cadastro, suas contribuições e suas escalas vinculadas.</p></div></header>
      <AccountClient />
    </>
  );
}
