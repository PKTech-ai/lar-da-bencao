"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeTab, type Tab } from "@/lib/module-tabs";

/** Barra de abas no desenho do `.sub` do visual v215. */
export function ModuleTabs({ tabs, current, label }: { tabs: readonly Tab[]; current: string | undefined; label: string }) {
  return (
    <nav className="module-tabs no-print" aria-label={label}>
      {tabs.map((tab) => (
        <Link key={tab.href} href={tab.href} className={tab.href === current ? "active" : undefined}
          aria-current={tab.href === current ? "page" : undefined}>{tab.label}</Link>
      ))}
    </nav>
  );
}

export function ModuleTabsByPath({ tabs, label }: { tabs: readonly Tab[]; label: string }) {
  const pathname = usePathname();
  return <ModuleTabs tabs={tabs} current={activeTab(pathname, tabs)?.href} label={label} />;
}
