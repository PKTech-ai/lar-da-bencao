import { requireModulePage } from "@/lib/page-auth";
import { programYear } from "@/lib/monthly-saturdays";
import { CultoClient } from "./culto-client";

export default async function CultoLarPage() {
  await requireModulePage("module_doutrina", { department: "doutrina", module: "culto-lar" });
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Manaus" });
  const current = Number(today.slice(0, 4));
  const initial = programYear(today);
  const years = Array.from({ length: 4 }, (_, i) => current - 1 + i);
  return (
    <>
      <header className="module-section-head"><div><h2>Culto no Lar</h2><p>Programação do ano: um culto por mês, no penúltimo sábado.</p></div></header>
      <CultoClient initialYear={initial} years={years.includes(initial) ? years : [...years, initial]} />
    </>
  );
}
