import Link from "next/link";
import type { Actor } from "@/lib/auth";
import { query } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { workerPageContext } from "@/lib/worker-page";
import { AdmissionsClient } from "./admissions-client";

/** Aprovação de Trabalhadores: atalhos do cadastro online (Administrador) e a lista de fichas. */
export async function AdmissionsSection({ actor }: { actor: Actor }) {
  const context = await workerPageContext(actor);
  const admin = await hasPermission(actor, "modules", "admin");
  const waiting = admin
    ? (await query<{ count: number }>("select count(*)::int as count from app.worker_submissions where status = 'received'")).rows[0].count
    : 0;
  return (
    <>
      {admin ? (
        <div className="row-actions no-print" style={{ marginBottom: 12 }}>
          <Link className="button" href="/sistema/admissoes/cadastros-online">Cadastros online{waiting ? ` (${waiting})` : ""}</Link>
          <Link className="button" href="/sistema/admissoes/cadastros-online/qr">QR code do cadastro online</Link>
        </div>
      ) : null}
      <AdmissionsClient departments={context.departments} canDecide={context.canDecide} canEditFicha={context.canEditFicha} />
    </>
  );
}
