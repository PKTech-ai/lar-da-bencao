"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeTab, bottomTabs, shortTabLabel, type Tab } from "@/lib/module-tabs";

/** Até esse número de abas, todas ficam à mostra; acima, as seguintes vão para "Mais". */
const VISIBLE_TABS = 6;

/**
 * Barra de abas no desenho do `.sub` do visual v215; as abas que sobram ficam em "Mais".
 * No celular, a mesma navegação vira uma barra fixa embaixo: 3 abas (sempre com a atual) e "Mais".
 */
export function ModuleTabs({ tabs, current, label }: { tabs: readonly Tab[]; current: string | undefined; label: string }) {
  const split = tabs.length > VISIBLE_TABS + 1;
  const shown = split ? tabs.slice(0, VISIBLE_TABS) : tabs;
  const more = split ? tabs.slice(VISIBLE_TABS) : [];
  const moreActive = more.find((tab) => tab.href === current);
  const link = (tab: Tab) => (
    <Link key={tab.href} href={tab.href} className={tab.href === current ? "active" : undefined}
      aria-current={tab.href === current ? "page" : undefined}>{tab.label}</Link>
  );
  const bottom = bottomTabs(tabs, current);
  return (
    <>
      <div className="module-tabs-wrap no-print">
        <nav className="module-tabs" aria-label={label}>{shown.map(link)}</nav>
        {more.length ? (
          <details className="module-tabs-more" key={current}>
            <summary className={moreActive ? "active" : undefined}>{moreActive ? moreActive.label : "Mais"} ▾</summary>
            <nav aria-label={`${label}: mais`}>{more.map(link)}</nav>
          </details>
        ) : null}
      </div>
      {tabs.length > 1 ? (
        <nav className="module-bottom-bar no-print" aria-label={`${label} (celular)`}>
          {bottom.visible.map((tab) => (
            <Link key={tab.href} href={tab.href} aria-current={tab.href === current ? "page" : undefined} title={tab.label}>
              <span>{shortTabLabel(tab.label)}</span>
            </Link>
          ))}
          {bottom.more.length ? (
            <details className="module-bottom-more" key={current}>
              <summary><span>Mais</span></summary>
              <nav aria-label={`${label}: mais (celular)`}>
                {bottom.more.map((tab) => <Link key={tab.href} href={tab.href}>{tab.label}</Link>)}
              </nav>
            </details>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}

export function ModuleTabsByPath({ tabs, label }: { tabs: readonly Tab[]; label: string }) {
  const pathname = usePathname();
  return <ModuleTabs tabs={tabs} current={activeTab(pathname, tabs)?.href} label={label} />;
}
