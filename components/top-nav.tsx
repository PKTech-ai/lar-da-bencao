"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { NavIcon } from "@/components/nav-icon";
import { ThemeToggle } from "@/components/theme-toggle";
import type { ToolCapabilities } from "@/lib/admin-tools";
import { sessionInitials } from "@/lib/home-dashboard";
import { navGroups, type NavEntry, type NavGroup } from "@/lib/nav-groups";
import { createClient } from "@/lib/supabase/client";

type Panel = NavGroup["key"] | "busca" | "conta" | "menu" | null;

const SEARCH_ICON = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3" /></svg>;
const HOME: NavEntry = { href: "/sistema", label: "Visão Geral", tone: "c1" };
const ACCOUNT: NavEntry = { href: "/sistema/conta", label: "Minha área", tone: "c7" };

function Item({ entry, current }: { entry: NavEntry; current: boolean }) {
  return (
    <Link className="nav-link tn-item" href={entry.href} aria-current={current ? "page" : undefined} data-nav-label={entry.label}>
      <span className={`tn-dot ${entry.tone}`}><NavIcon href={entry.href} /></span>
      <span className="nav-label">{entry.label}</span>
    </Link>
  );
}

export function TopNav({ actor, roleLabel, capabilities }: { actor: { name: string; role: string; email: string }; roleLabel: string; capabilities: ToolCapabilities }) {
  const pathname = usePathname();
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const lastPath = useRef(pathname);
  const fromHistory = useRef(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [query, setQuery] = useState("");
  const groups = navGroups(capabilities);
  const opened = groups.find((group) => group.key === panel);
  const isCurrent = (href: string) => pathname === href || (href !== "/sistema" && pathname.startsWith(`${href}/`));
  const needle = query.trim().toLocaleLowerCase("pt-BR");
  const results = [HOME, ACCOUNT, ...groups.flatMap((group) => group.items)].filter((item) => item.label.toLocaleLowerCase("pt-BR").includes(needle));

  // O menu fica preso no alto: tela nova abre sempre do começo; o botão Voltar do navegador mantém a posição.
  useEffect(() => {
    const onPop = () => { fromHistory.current = true; };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    if (fromHistory.current) fromHistory.current = false;
    else window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    if (!panel) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setPanel(null); };
    const onDown = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setPanel(null); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [panel]);

  function toggle(next: Exclude<Panel, null>) {
    setQuery("");
    setPanel((current) => (current === next ? null : next));
  }

  function closeOnLink(event: MouseEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("a")) setPanel(null);
  }

  async function logout(scope: "local" | "global") {
    const supabase = createClient();
    await fetch("/api/auth/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: scope === "global" ? "logout_global" : "logout" })
    });
    await supabase.auth.signOut({ scope });
    router.replace("/login");
    router.refresh();
  }

  const accountActions = (
    <div className="tn-acts">
      <button className="button" type="button" onClick={() => void logout("local")}>
        <span className="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M10 7V4h10v16H10v-3M4 12h11m0 0-3-3m3 3-3 3" /></svg></span>
        <span className="nav-label">Sair deste aparelho</span>
      </button>
      <button className="button" type="button" onClick={() => void logout("global")}>
        <span className="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 7V4h11v16H9v-3M3 12h12m0 0-3-3m3 3-3 3" /></svg></span>
        <span className="nav-label">Sair de todos os aparelhos</span>
      </button>
    </div>
  );

  return (
    <div className="tn-root" ref={root}>
      {panel ? <button type="button" className="tn-veil" aria-label="Fechar" tabIndex={-1} onClick={() => setPanel(null)} /> : null}
      <header className="tn">
        <Link href="/sistema" className="tn-brand" aria-label="Lar da Bênção, ir para a Visão Geral">
          <img className="tn-logo" src="/marca-lar-da-bencao.png" alt="" width={801} height={840} />
          <strong>Lar da Bênção</strong>
        </Link>
        <nav className="tn-nav" aria-label="Áreas do sistema">
          <Link className="nav-link tn-tab" href="/sistema" data-current={!opened && pathname === "/sistema"} aria-current={pathname === "/sistema" ? "page" : undefined}>
            <span className="nav-label">Início</span>
          </Link>
          {groups.map((group) => (
            <button
              key={group.key} type="button" className="tn-tab" aria-expanded={panel === group.key} aria-controls="tn-painel"
              data-current={panel === group.key || (!opened && group.items.some((item) => isCurrent(item.href)))}
              onClick={() => toggle(group.key)}
            >
              {group.label}
              <svg className="tn-ch" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </button>
          ))}
        </nav>
        <div className="tn-tools">
          <button type="button" className="tn-ib" aria-label="Encontrar módulo" aria-expanded={panel === "busca"} onClick={() => toggle("busca")}>{SEARCH_ICON}</button>
          <ThemeToggle />
          <button type="button" className="tn-av" title={roleLabel} aria-label={`${actor.name}, opções da conta`} aria-expanded={panel === "conta"} onClick={() => toggle("conta")}>{sessionInitials(actor.name) || "LB"}</button>
          <button type="button" className="tn-ib tn-burger" aria-label={panel === "menu" ? "Fechar menu" : "Menu"} aria-expanded={panel === "menu"} aria-controls="tn-painel" onClick={() => toggle("menu")}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={panel === "menu" ? "M18 6 6 18M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} /></svg>
          </button>
        </div>
      </header>

      {opened ? (
        <div className="tn-panelw">
          <div className="tn-panel" id="tn-painel" onClick={closeOnLink}>
            <div className="tn-grid">{opened.items.map((item) => <Item key={item.href} entry={item} current={isCurrent(item.href)} />)}</div>
          </div>
        </div>
      ) : null}

      {panel === "busca" ? (
        <div className="tn-panelw">
          <div className="tn-panel search" onClick={closeOnLink}>
            <label className="tn-search">
              {SEARCH_ICON}
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome do módulo ou departamento" aria-label="Encontrar módulo" autoFocus />
            </label>
            <div className="tn-results">
              {results.slice(0, 8).map((item) => <Item key={item.href} entry={item} current={isCurrent(item.href)} />)}
              {!results.length ? <p>Nada encontrado.</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      {panel === "conta" ? (
        <div className="tn-panelw" data-side="end">
          <div className="tn-panel narrow" onClick={closeOnLink}>
            <div className="tn-me"><strong>{actor.name}</strong><small>{roleLabel}</small></div>
            <Item entry={ACCOUNT} current={isCurrent(ACCOUNT.href)} />
            <div className="tn-sheet-sep">{accountActions}</div>
          </div>
        </div>
      ) : null}

      {panel === "menu" ? (
        <div className="tn-panelw">
          <div className="tn-panel" id="tn-painel" onClick={closeOnLink}>
            <div className="tn-grid">
              <Item entry={HOME} current={pathname === "/sistema"} />
              <Item entry={ACCOUNT} current={isCurrent(ACCOUNT.href)} />
            </div>
            {groups.map((group) => (
              <div key={group.key}>
                <p className="tn-sheet-title">{group.label}</p>
                <div className="tn-grid">{group.items.map((item) => <Item key={item.href} entry={item} current={isCurrent(item.href)} />)}</div>
              </div>
            ))}
            <div className="tn-sheet-sep">
              <div className="tn-me"><strong>{actor.name}</strong><small>{roleLabel}</small></div>
              {accountActions}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
