import { SuggestionsClient } from "./suggestions-client";
import { requirePageActor } from "@/lib/page-auth";

export default async function SuggestionsPage() {
  await requirePageActor();
  return (
    <>
      <header className="page-heading"><div><h1>Sugestões e elogios</h1><p>O que você escrever chega à Diretoria. Você acompanha a resposta por aqui.</p></div></header>
      <SuggestionsClient />
    </>
  );
}
