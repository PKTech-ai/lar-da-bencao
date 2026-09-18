import { requireModulePage } from "@/lib/page-auth";

export default async function CultoLarPage() {
  await requireModulePage("module_doutrina", { department: "doutrina" });
  return (
    <>
      <header className="page-heading"><div><h1>Culto no Lar</h1><p>Registros mensais.</p></div></header>
    </>
  );
}
