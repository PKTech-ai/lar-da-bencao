import Link from "next/link";
import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import { isFlagEnabled } from "@/lib/feature-flags";
import { requirePageActor } from "@/lib/page-auth";
import { hasPermission } from "@/lib/permissions";
import { workerPageContext } from "@/lib/worker-page";
import { canSeeAdmissions } from "@/lib/workers";
import { AdmissionsClient } from "./admissions-client";

/** Aprovação de Trabalhadores: Administrador e Presidente, ou quem teve o acesso marcado no convite. */
export default async function AdmissoesPage() {
  const actor = await requirePageActor();
  if (!(await isFlagEnabled("module_workers")) || !(await canSeeAdmissions(actor))) notFound();
  const context = await workerPageContext(actor);
  const admin = await hasPermission(actor, "modules", "admin");
  const waiting = admin
    ? (await query<{ count: number }>("select count(*)::int as count from app.worker_submissions where status = 'received'")).rows[0].count
    : 0;
  return (
    <>
      <header className="page-heading">
        <div><h1>Aprovação de Trabalhadores</h1><p>A Secretaria e os departamentos cadastram as fichas. Em Abrir ficha você confere os dados e o histórico, edita ou exclui. Aprovar aprova direto; Aprovar todos aprova o lote.</p></div>
        {admin ? (
          <div className="row-actions">
            <Link className="button" href="/sistema/admissoes/cadastros-online">Cadastros online{waiting ? ` (${waiting})` : ""}</Link>
            <Link className="button" href="/sistema/admissoes/cadastros-online/qr">QR code do cadastro online</Link>
          </div>
        ) : <span className="production-badge">Diretoria</span>}
      </header>
      <AdmissionsClient departments={context.departments} canDecide={context.canDecide} canEditFicha={context.canEditFicha} />
    </>
  );
}
