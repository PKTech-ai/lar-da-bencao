import { requireModulePage } from "@/lib/page-auth";
import { SpeakersClient } from "./speakers-client";

export default async function PalestrantesPage() {
  await requireModulePage("module_doutrina", { department: "doutrina" });
  return (
    <>
      <header className="module-section-head"><div><h2>Palestrantes Externos</h2><p>Casas, cidades e temas. Palestrantes inativos não entram em novas escalas.</p></div></header>
      <SpeakersClient />
    </>
  );
}
