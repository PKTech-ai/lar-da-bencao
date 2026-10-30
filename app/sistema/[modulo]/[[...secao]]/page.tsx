import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ModuleTabs } from "@/components/module-tabs";
import { SuggestionsBox } from "@/components/suggestions-box";
import { DepartmentDashboard } from "@/components/modules/department-dashboard";
import { ModulePanel } from "@/components/modules/panels";
import { ResourceManager } from "@/components/resources/resource-manager";
import { isFlagEnabled } from "@/lib/feature-flags";
import { findModulePage, SECTOR_ROLE_RESOURCE, type ModuleSection, type SectionAccess } from "@/lib/module-pages";
import { requireModulePage } from "@/lib/page-auth";
import { hasAnyDepartmentPermission, hasPermission } from "@/lib/permissions";
import { canSeeAdmissions } from "@/lib/workers";
import { workerPageContext } from "@/lib/worker-page";
import { RESOURCES } from "@/lib/resources/registry";
import { WorkersClient } from "@/app/sistema/trabalhadores/workers-client";
import { AdmissionsSection } from "@/app/sistema/admissoes/admissions-section";

type Params = { params: Promise<{ modulo: string; secao?: string[] }> };

export default async function ModuleSectionPage({ params }: Params) {
  const { modulo, secao } = await params;
  const page = findModulePage(modulo);
  if (!page || (secao && secao.length > 1)) notFound();
  const actor = await requireModulePage(page.flag, { resource: page.access.resource, department: page.access.department });
  const can = (access: SectionAccess | undefined) =>
    access ? hasPermission(actor, access.resource, "read", access.department) : Promise.resolve(true);
  const sectorResource = SECTOR_ROLE_RESOURCE[actor.role];
  const visible: ModuleSection[] = [];
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
  // Grupos (ex.: Assistência): uma aba por grupo, apontando para a primeira seção visível; sub-abas dentro.
  const href = (s: { slug: string }) => `/sistema/${page.slug}${s.slug ? `/${s.slug}` : ""}`;
  const tabs = visible.filter((s, i) => !s.group || visible.findIndex((o) => o.group === s.group) === i)
    .map((s) => ({ href: href(s), label: s.group ?? s.label, group: s.group }));
  const currentTab = tabs.find((t) => (current.group ? t.group === current.group : t.href === href(current)));
  const siblings = current.group ? visible.filter((s) => s.group === current.group) : [];

  return (
    <>
      <header className="page-heading"><div><h1>{page.title}</h1><p>{page.intro}</p></div></header>
      <ModuleTabs label={`Seções de ${page.title}`} tabs={tabs.map(({ href: h, label }) => ({ href: h, label }))} current={currentTab?.href} />
      {siblings.length > 1 ? (
        <nav className="sub-tabs no-print" aria-label={current.group}>
          {siblings.map((s) => <Link key={s.slug} href={href(s)} aria-current={s === current ? "page" : undefined}>{s.label}</Link>)}
        </nav>
      ) : null}
      {def ? <ResourceManager resourceKey={def.key} />
        : current.panel === "trabalhadores-cadastro" ? <WorkersClient {...await workerPageContext(actor)} />
        : current.panel === "admissoes-atalho" ? <AdmissionsSection actor={actor} />
        : current.panel === "painel" ? <DepartmentDashboard page={page} actor={actor} />
        : current.panel ? <ModulePanel name={current.panel} /> : null}
      <SuggestionsBox />
    </>
  );
}
