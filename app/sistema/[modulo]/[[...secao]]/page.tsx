import { notFound, redirect } from "next/navigation";
import { ModuleTabs } from "@/components/module-tabs";
import { SuggestionsBox } from "@/components/suggestions-box";
import { DepartmentDashboard } from "@/components/modules/department-dashboard";
import { ModulePanel } from "@/components/modules/panels";
import { ResourceManager } from "@/components/resources/resource-manager";
import { isFlagEnabled } from "@/lib/feature-flags";
import { findModulePage, SECTOR_ROLE_RESOURCE, type SectionAccess } from "@/lib/module-pages";
import { requireModulePage } from "@/lib/page-auth";
import { hasAnyDepartmentPermission, hasPermission } from "@/lib/permissions";
import { canSeeAdmissions } from "@/lib/workers";
import { workerPageContext } from "@/lib/worker-page";
import { RESOURCES } from "@/lib/resources/registry";
import { WorkersClient } from "@/app/sistema/trabalhadores/workers-client";

type Params = { params: Promise<{ modulo: string; secao?: string[] }> };

export default async function ModuleSectionPage({ params }: Params) {
  const { modulo, secao } = await params;
  const page = findModulePage(modulo);
  if (!page || (secao && secao.length > 1)) notFound();
  const actor = await requireModulePage(page.flag, { resource: page.access.resource, department: page.access.department });
  const can = (access: SectionAccess | undefined) =>
    access ? hasPermission(actor, access.resource, "read", access.department) : Promise.resolve(true);
  const sectorResource = SECTOR_ROLE_RESOURCE[actor.role];
  const visible = [];
  for (const section of page.sections) {
    if (sectorResource && section.access?.resource !== sectorResource) continue;
    if (section.panel === "admissoes-atalho" && !(await canSeeAdmissions(actor))) continue;
    if (section.flag && !(await isFlagEnabled(section.flag))) continue;
    // Cadastro de trabalhadores: mesma regra da tela /sistema/trabalhadores (algum departamento do usuário).
    if (section.panel === "trabalhadores-cadastro" && !(await hasAnyDepartmentPermission(actor, "read"))) continue;
    if (await can(section.access)) visible.push(section);
  }
  const current = visible.find((s) => s.slug === (secao?.[0] ?? ""));
  // Sem a aba pedida (ex.: perfil de setor entrando pela raiz do módulo), abre a primeira permitida.
  if (!current && !secao && visible.length) redirect(`/sistema/${page.slug}/${visible[0].slug}`);
  if (!current) notFound();
  const def = current.resource ? RESOURCES[current.resource] : null;

  return (
    <>
      <header className="page-heading"><div><h1>{page.title}</h1><p>{page.intro}</p></div></header>
      <ModuleTabs label={`Seções de ${page.title}`}
        tabs={visible.map((s) => ({ href: `/sistema/${page.slug}${s.slug ? `/${s.slug}` : ""}`, label: s.label }))}
        current={`/sistema/${page.slug}${current.slug ? `/${current.slug}` : ""}`} />
      {def ? <ResourceManager resourceKey={def.key} />
        : current.panel === "trabalhadores-cadastro" ? <WorkersClient {...await workerPageContext(actor)} />
        : current.panel === "painel" ? <DepartmentDashboard page={page} />
        : current.panel ? <ModulePanel name={current.panel} /> : null}
      <SuggestionsBox />
    </>
  );
}
