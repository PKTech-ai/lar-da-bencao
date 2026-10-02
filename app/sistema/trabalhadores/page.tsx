import Link from "next/link";
import { query } from "@/lib/db";
import { requireModulePage } from "@/lib/page-auth";
import { hasPermission } from "@/lib/permissions";
import { workerPageContext } from "@/lib/worker-page";
import { WorkersClient } from "./workers-client";

export default async function TrabalhadoresPage() {
  const actor = await requireModulePage("module_workers", { department: "any" });
  const context = await workerPageContext(actor);
  // Cadastro online (formulário público): a fila de revisão e o QR code são só do Administrador.
  const admin = await hasPermission(actor, "modules", "admin");
  const waiting = admin
    ? (await query<{ count: number }>("select count(*)::int as count from app.worker_submissions where status = 'received'")).rows[0].count
    : 0;
  return (
    <>
      <header className="page-heading">
        <div><h1>Trabalhadores</h1><p>Fichas por departamento. Toda ficha nova ou alterada passa pela aprovação da Diretoria antes da atuação.</p></div>
        {admin ? (
          <div className="row-actions">
            <Link className="button" href="/sistema/trabalhadores/cadastros-online">Cadastros online{waiting ? ` (${waiting})` : ""}</Link>
            <Link className="button" href="/sistema/trabalhadores/cadastros-online/qr">QR code do cadastro online</Link>
          </div>
        ) : null}
      </header>
      <WorkersClient {...context} />
    </>
  );
}
