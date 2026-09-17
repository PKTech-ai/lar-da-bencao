import Link from "next/link";
import { HomeClient } from "./home-client";
import { runtimeEnvironment } from "@/lib/environment";
import { listEnabledFlags } from "@/lib/feature-flags";
import { moduleCatalog } from "@/lib/modules";
import { requirePageActor } from "@/lib/page-auth";
import { hasAnyDepartmentPermission, hasPermission } from "@/lib/permissions";

export default async function DashboardPage() {
  const actor = await requirePageActor();
  const flags = await listEnabledFlags();
  const [audit, attachments, users] = await Promise.all([
    hasPermission(actor, "audit", "read"),
    hasPermission(actor, "attachments", "read"),
    hasPermission(actor, "users", "admin")
  ]);

  // Só entram os módulos ligados que a pessoa pode abrir.
  const activeModules = [];
  for (const mod of moduleCatalog) {
    if (mod.key === "home" || !flags.get(mod.flagKey)) continue;
    const allowed = mod.department
      ? await hasPermission(actor, mod.permissionResource, "read", mod.department)
      : mod.permissionResource === "department"
        ? await hasAnyDepartmentPermission(actor, "read")
        : await hasPermission(actor, mod.permissionResource, "read");
    if (allowed) activeModules.push(mod);
  }

  const tools = [
    { href: "/sistema/auditoria", label: "Dedo-duro", text: "Auditoria append-only, filtros, impressão e exportação controlada.", visible: audit },
    { href: "/sistema/anexos", label: "Anexos privados", text: "Arquivos fracionados e guardados no PostgreSQL.", visible: attachments },
    { href: "/sistema/usuarios", label: "Usuários e permissões", text: "Contas individuais, perfis, departamentos e MFA.", visible: users },
    { href: "/sistema/acesso", label: "Controle de Acesso", text: "Matriz por página, exceções registradas e biênios da Diretoria.", visible: users }
  ].filter((item) => item.visible);

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="op-eyebrow">LAR DA BÊNÇÃO</p>
          <h1>Visão Geral</h1>
          <p>O que está sob sua responsabilidade hoje.</p>
        </div>
        {runtimeEnvironment().production ? <span className="production-badge">{runtimeEnvironment().label}</span> : <span className="status building">{runtimeEnvironment().label}</span>}
      </header>

      <HomeClient firstName={actor.name.split(" ")[0]} />

      {activeModules.length ? (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>Módulos</h2>
          <div className="grid cards">
            {activeModules.map((mod) => (
              <Link href={mod.href} className="card card-link" key={mod.key}>
                <h3>{mod.label}</h3>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {tools.length ? (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>Ferramentas</h2>
          <div className="grid cards">
            {tools.map((tool) => (
              <Link href={tool.href} className="card card-link" key={tool.href}>
                <h3>{tool.label}</h3>
                <p>{tool.text}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
