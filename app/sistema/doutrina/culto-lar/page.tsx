import { requireModulePage } from "@/lib/page-auth";
import { cultoLinkUrl } from "@/lib/culto-link";
import { canEditDoutrina } from "@/lib/doutrina-data";
import { programYear } from "@/lib/monthly-saturdays";
import { CultoClient } from "./culto-client";
import { CultoShare } from "./culto-share";

export default async function CultoLarPage() {
  const actor = await requireModulePage("module_doutrina", { department: "doutrina", module: "culto-lar" });
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Manaus" });
  const current = Number(today.slice(0, 4));
  const initial = programYear(today);
  const years = Array.from({ length: 4 }, (_, i) => current - 1 + i);
  // Link do grupo do WhatsApp: só para quem pode alterar a programação (do ano atual em diante).
  const links = (await canEditDoutrina(actor, "culto-lar"))
    ? [...new Set([...years, initial])].filter((y) => y >= current).sort().map((year) => ({ year, url: cultoLinkUrl(year) }))
    : [];
  return (
    <>
      <header className="module-section-head"><div><h2>Culto no Lar</h2><p>Programação do ano: um culto por mês, no penúltimo sábado, das 19:30 às 20:30.</p></div></header>
      {links.length ? <CultoShare links={links} initialYear={initial} /> : null}
      <CultoClient initialYear={initial} years={years.includes(initial) ? years : [...years, initial]} />
    </>
  );
}
