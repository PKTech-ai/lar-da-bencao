/** Abas dos módulos: qual aba está ativa para um caminho. Módulo puro. */
export type Tab = { href: string; label: string };

export function activeTab(pathname: string, tabs: readonly Tab[]): Tab | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const root = tabs.reduce((a, b) => (a.href.length <= b.href.length ? a : b), tabs[0]);
  let best: Tab | undefined;
  for (const tab of tabs) {
    const hit = tab === root ? path === tab.href : path === tab.href || path.startsWith(`${tab.href}/`);
    if (hit && (!best || tab.href.length > best.href.length)) best = tab;
  }
  return best;
}
