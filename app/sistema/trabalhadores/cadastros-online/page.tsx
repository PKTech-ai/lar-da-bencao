import Link from "next/link";
import { query } from "@/lib/db";
import { isFlagEnabled } from "@/lib/feature-flags";
import { requireModulePage } from "@/lib/page-auth";
import { PUBLIC_WORKER_FORM_FLAG } from "@/lib/worker-submissions";
import { SubmissionsClient } from "./submissions-client";

/** Fila de revisão dos cadastros online: somente o Administrador. */
export default async function CadastrosOnlinePage() {
  await requireModulePage("module_workers", { resource: "modules", action: "admin" });
  const [departments, open] = await Promise.all([
    query<{ key: string; label: string }>("select key, label from app.departments order by label"),
    isFlagEnabled(PUBLIC_WORKER_FORM_FLAG)
  ]);
  return (
    <>
      <header className="page-heading">
        <div><h1>Cadastros online</h1><p>Envios do formulário público. Nada entra na ficha do trabalhador antes da sua conferência.</p></div>
        <span className="production-badge">Somente administrador</span>
      </header>
      <div className="grid">
        <div className="notice">
          {open
            ? "O formulário público está aberto e recebendo envios."
            : "O formulário público está fechado. Para abrir, ligue “Cadastro online de trabalhadores” em Módulos e ondas."}
          {" "}<Link href="/sistema/trabalhadores/cadastros-online/qr">Ver QR code e cartaz</Link>
        </div>
        <SubmissionsClient departments={departments.rows} />
      </div>
    </>
  );
}
