"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeTab, type Tab } from "@/lib/module-tabs";

/** Até esse número de abas, todas ficam à mostra; acima, as seguintes vão para "Mais". */
const VISIBLE_TABS = 6;

/** Barra de abas no desenho do `.sub` do visual v215; as abas que sobram ficam em "Mais". */
export function ModuleTabs({ tabs, current, label }: { tabs: readonly Tab[]; current: string | undefined; label: string }) {
  const split = tabs.length > VISIBLE_TABS + 1;
  const shown = split ? tabs.slice(0, VISIBLE_TABS) : tabs;
  const more = split ? tabs.slice(VISIBLE_TABS) : [];
  const moreActive = more.find((tab) => tab.href === current);
  const link = (tab: Tab) => (
    <Link key={tab.href} href={tab.href} className={tab.href === current ? "active" : undefined}
      aria-current={tab.href === current ? "page" : undefined}>{tab.label}</Link>
  );
  return (
    <div className="module-tabs-wrap no-print">
      <nav className="module-tabs" aria-label={label}>{shown.map(link)}</nav>
      {more.length ? (
        <details className="module-tabs-more" key={current}>
          <summary className={moreActive ? "active" : undefined}>{moreActive ? moreActive.label : "Mais"} ▾</summary>
          <nav aria-label={`${label}: mais`}>{more.map(link)}</nav>
        </details>
      ) : null}
    </div>
  );
}

export function ModuleTabsByPath({ tabs, label }: { tabs: readonly Tab[]; label: string }) {
  const pathname = usePathname();
  return <ModuleTabs tabs={tabs} current={activeTab(pathname, tabs)?.href} label={label} />;
}
