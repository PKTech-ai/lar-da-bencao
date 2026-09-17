import Link from "next/link";
import { notFound } from "next/navigation";
import { ModulePanel } from "@/components/modules/panels";
import { ResourceManager } from "@/components/resources/resource-manager";
import { findModulePage, type SectionAccess } from "@/lib/module-pages";
import { requireModulePage } from "@/lib/page-auth";
import { hasPermission } from "@/lib/permissions";
import { RESOURCES } from "@/lib/resources/registry";

type Params = { params: Promise<{ modulo: string; secao?: string[] }> };

export default async function ModuleSectionPage({ params }: Params) {
  const { modulo, secao } = await params;
  const page = findModulePage(modulo);
  if (!page || (secao && secao.length > 1)) notFound();
  const actor = await requireModulePage(page.flag, { resource: page.access.resource, department: page.access.department });
  const can = (access: SectionAccess | undefined) =>
    access ? hasPermission(actor, access.resource, "read", access.department) : Promise.resolve(true);
  const visible = [];
  for (const section of page.sections) if (await can(section.access)) visible.push(section);
  const current = visible.find((s) => s.slug === (secao?.[0] ?? ""));
  if (!current) notFound();
  const def = current.resource ? RESOURCES[current.resource] : null;

  return (
    <>
      <header className="page-heading"><div><h1>{page.title}</h1><p>{page.intro}</p></div></header>
      <nav className="row-actions no-print" aria-label={`Seções de ${page.title}`} style={{ marginBottom: 16 }}>
        {visible.map((s) => (
          <Link key={s.slug} className={`button${s === current ? " primary" : ""}`} aria-current={s === current ? "page" : undefined}
            href={`/sistema/${page.slug}${s.slug ? `/${s.slug}` : ""}`}>{s.label}</Link>
        ))}
      </nav>
      {def ? <ResourceManager resourceKey={def.key} /> : current.panel ? <ModulePanel name={current.panel} /> : null}
    </>
  );
}
