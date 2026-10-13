import { requireModulePage } from "@/lib/page-auth";

export default async function CultoLarPage() {
  await requireModulePage("module_doutrina", { department: "doutrina" });
  return (
    <>
      <header className="module-section-head"><div><h2>Culto no Lar</h2><p>Registros mensais.</p></div></header>
    </>
  );
}
