import { redirect } from "next/navigation";
import { isFlagEnabled } from "@/lib/feature-flags";
import { requirePageActor } from "@/lib/page-auth";
import { hasPermission } from "@/lib/permissions";
import { ImportClient } from "./import-client";

export default async function ImportPage() {
  const actor = await requirePageActor();
  if (!(await hasPermission(actor, "modules", "admin"))) redirect("/sistema");
  const enabled = await isFlagEnabled("legacy_import");
  return (
    <>
      <header className="page-heading">
        <div><h1>Importação do backup v215</h1><p>Leva para o Postgres os cadastros da onda 1 de um backup completo (ZIP) gerado na versão HTML.</p></div>
        <span className="production-badge">Somente administrador</span>
      </header>
      {enabled ? <ImportClient /> : <div className="notice">A importação está desligada. Ligue a flag “legacy_import” em Módulos e ondas quando a Diretoria definir a fonte oficial dos dados.</div>}
    </>
  );
}
