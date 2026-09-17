import { requireModulePage } from "@/lib/page-auth";
import { SpeakersClient } from "./speakers-client";

export default async function PalestrantesPage() {
  await requireModulePage("module_doutrina", { department: "doutrina" });
  return (
    <>
      <header className="page-heading"><div><h1>Palestrantes Externos</h1><p>Casas, cidades e temas. Palestrantes inativos não entram em novas escalas.</p></div></header>
      <SpeakersClient />
    </>
  );
}
