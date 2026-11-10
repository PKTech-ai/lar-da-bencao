import { PainelView } from "@/components/painel";
import { query } from "@/lib/db";
import { departmentCoordinators } from "@/lib/department-coordinators";
import { canEditDoutrina } from "@/lib/doutrina-data";
import { requireDepartmentHome } from "@/lib/page-auth";
import { painelDoutrina } from "@/lib/paineis";
import { DoctrineContactForm } from "./contact-form";

export default async function DoutrinaPage() {
  const actor = await requireDepartmentHome("module_doutrina", "doutrina");
  const [painel, coordinators, contact, canEdit] = await Promise.all([
    painelDoutrina(),
    departmentCoordinators("doutrina"),
    query<{ phone: string | null }>("select phone from app.department_contacts where department_key = 'doutrina'"),
    canEditDoutrina(actor, "escalas")
  ]);

  return (
    <>
      <PainelView painel={painel} />
      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Responsável pelo Departamento de Doutrina</h2>
        <p className="small muted">Estas informações aparecem nas escalas impressas para contato em caso de dúvidas.</p>
        <DoctrineContactForm coordinator={coordinators.join(" / ") || "Sem coordenador vinculado"} phone={contact.rows[0]?.phone ?? ""} canEdit={canEdit} />
      </section>
    </>
  );
}
