import { PainelView } from "@/components/painel";
import { query } from "@/lib/db";
import { canEditDoutrina } from "@/lib/doutrina-data";
import { requireModulePage } from "@/lib/page-auth";
import { painelDoutrina } from "@/lib/paineis";
import { DoctrineContactForm } from "./contact-form";

export default async function DoutrinaPage() {
  const actor = await requireModulePage("module_doutrina", { department: "doutrina" });
  const [painel, contact, canEdit] = await Promise.all([
    painelDoutrina(),
    query<{ coordinator: string | null; phone: string | null }>(
      `select (select string_agg(u.full_name, ' / ' order by u.full_name) from app.users u
                 join app.user_departments ud on ud.user_id = u.id and ud.department_key = 'doutrina'
                where u.status = 'active' and u.role_key = 'coordenador') as coordinator,
              (select phone from app.department_contacts where department_key = 'doutrina') as phone`
    ),
    canEditDoutrina(actor)
  ]);

  return (
    <>
      <PainelView painel={painel} />
      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Responsável pelo Departamento de Doutrina</h2>
        <p className="small muted">Estas informações aparecem nas escalas impressas para contato em caso de dúvidas.</p>
        <DoctrineContactForm coordinator={contact.rows[0]?.coordinator ?? "Sem coordenador vinculado"} phone={contact.rows[0]?.phone ?? ""} canEdit={canEdit} />
      </section>
    </>
  );
}
