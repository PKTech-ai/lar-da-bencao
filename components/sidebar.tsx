"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Brand } from "@/components/brand";
import { NavIcon } from "@/components/nav-icon";
import { ThemeToggle } from "@/components/theme-toggle";
import { adminTools, type ToolCapabilities } from "@/lib/admin-tools";
import { createClient } from "@/lib/supabase/client";

export type NavCapability = ToolCapabilities;

/**
 * Menu recolhido (só ícones): a escolha da pessoa fica no aparelho; sem escolha, recolhe em telas de até 1199 px
 * (tablet). O atributo `data-sidebar` do <html> é definido antes da pintura, em app/layout.tsx.
 */
export const SIDEBAR_KEY = "sidebar-collapsed";
const CONFIG_TOOLS = new Set(["/sistema/auditoria", "/sistema/anexos", "/sistema/usuarios", "/sistema/instituicao", "/sistema/modulos", "/sistema/importacao"]);
const subscribeSidebar = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-sidebar"] });
  return () => observer.disconnect();
};
const sidebarCollapsed = () => document.documentElement.dataset.sidebar === "collapsed";

const DIRETORIA = ["/sistema/presidencia", "/sistema/secretaria", "/sistema/tesouraria"];
// Trabalhadores fica dentro da Secretaria (aba própria); a tela /sistema/trabalhadores continua para os atalhos.
const PLACED = new Set(["/sistema/documentos", "/sistema/conselhofiscal", "/sistema/trabalhadores", ...DIRETORIA]);
// Admissões também é aba da Secretaria; quem não vê a Secretaria (acesso só à admissão) continua com o item no menu.
const IN_SECRETARIA = "/sistema/admissoes";
const MENU_LABEL: Record<string, string> = {
  "/sistema/doutrina": "Dpto de Doutrina",
  "/sistema/infancia": "Dpto da Infância",
  "/sistema/juventude": "Dpto da Juventude",
  "/sistema/assistencia": "Dpto de Assist. e Prom. Social",
  "/sistema/patrimonio": "Dpto de Patrimônio",
  "/sistema/eventos": "Dpto de Eventos",
  "/sistema/divulgacao": "Dpto de Divulgação",
  "/sistema/juridico": "Dpto Jurídico"
};
const MENU_ORDER = [
  "/sistema/doutrina", "/sistema/infancia", "/sistema/juventude", "/sistema/assistencia",
  "/sistema/patrimonio", "/sistema/eventos", "/sistema/divulgacao", "/sistema/juridico"
];

function menuLabel(href: string, fallback: string) {
  return MENU_LABEL[href] ?? fallback;
}

function NavItem({ href, label, current }: { href: string; label: string; current: boolean }) {
  return (
    <Link className="nav-link" href={href} data-current={current} data-nav-label={label} title={label}>
      <NavIcon href={href} />
      <span className="nav-label">{label}</span>
    </Link>
  );
}

export function Sidebar({ capabilities }: { actor: { name: string; role: string; email: string }; capabilities: NavCapability }) {
  const pathname = usePathname();
  const router = useRouter();
  const collapsed = useSyncExternalStore(subscribeSidebar, sidebarCollapsed, () => false);
  // No celular o menu fica fechado atrás do botão "Menu" para a tela começar no conteúdo.
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const needle = query.trim().toLocaleLowerCase("pt-BR");
  const show = (label: string) => label.toLocaleLowerCase("pt-BR").includes(needle);
  const current = (href: string) => pathname === href || (href !== "/sistema" && pathname.startsWith(href));
  const byHref = new Map(capabilities.modules.map((mod) => [mod.href, mod]));
  const documentos = byHref.get("/sistema/documentos");
  const conselho = byHref.get("/sistema/conselhofiscal");
  const diretoria = DIRETORIA.flatMap((href) => {
    const mod = byHref.get(href);
    const label = mod ? menuLabel(mod.href, mod.label) : "";
    return mod && show(label) ? [{ ...mod, label }] : [];
  });
  const tools = adminTools(capabilities).filter((tool) => show(tool.label));
  // Ferramentas de administração ficam juntas em "Configurações" (fechado, abre quando uma delas está aberta).
  const settings = [
    ...(capabilities.users && show("Controle de Acesso") ? [{ href: "/sistema/acesso", label: "Controle de Acesso" }] : []),
    ...tools.filter((tool) => CONFIG_TOOLS.has(tool.href))
  ];
  const rest = capabilities.modules
    .filter((mod) => !PLACED.has(mod.href) && !(mod.href === IN_SECRETARIA && byHref.has("/sistema/secretaria")))
    .map((mod) => ({ ...mod, label: menuLabel(mod.href, mod.label) }))
    .filter((mod) => show(mod.label))
    .sort((a, b) => {
      const left = MENU_ORDER.indexOf(a.href);
      const right = MENU_ORDER.indexOf(b.href);
      return (left === -1 ? 99 : left) - (right === -1 ? 99 : right);
    });

  function toggleCollapsed() {
    const next = !sidebarCollapsed();
    document.documentElement.dataset.sidebar = next ? "collapsed" : "open";
    try { localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0"); } catch { /* sem armazenamento */ }
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

  return (
    <aside className={`sidebar${menuOpen ? " menu-open" : ""}`}>
      <button className="sidebar-collapse" type="button" aria-pressed={collapsed} aria-label={collapsed ? "Expandir menu" : "Recolher menu"} onClick={toggleCollapsed}>
        <span className="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h10M4 18h16"/></svg></span>
        <span className="nav-label">{collapsed ? "Expandir" : "Recolher"}</span>
      </button>
      <Brand subtitle="Sistema Integrado — Demonstração Funcional com Dados Fictícios" />
      <button className="sidebar-mobile-toggle" type="button" aria-expanded={menuOpen} aria-controls="menu-principal" onClick={() => setMenuOpen((open) => !open)}>
        <span aria-hidden="true">{menuOpen ? "✕" : "☰"}</span> {menuOpen ? "Fechar" : "Menu"}
      </button>
      <label className="module-search">
        Encontrar módulo
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome do departamento" aria-label="Encontrar módulo" />
      </label>
      <nav id="menu-principal" className="nav-list" aria-label="Módulos principais"
        onClick={(event) => { if ((event.target as HTMLElement).closest("a")) setMenuOpen(false); }}>
        {show("Visão Geral") ? <NavItem href="/sistema" label="Visão Geral" current={current("/sistema")} /> : null}
        {show("Demonstração") ? <NavItem href="/visual" label="Demonstração" current={false} /> : null}
        {documentos && show(documentos.label) ? <NavItem href={documentos.href} label={documentos.label} current={current(documentos.href)} /> : null}
        {show("Organograma") ? <NavItem href="/sistema/organograma" label="Organograma" current={current("/sistema/organograma")} /> : null}
        {diretoria.length ? (
          <details className="nav-group" open>
            <summary><span className="nav-label">Diretoria</span></summary>
            <div className="diretoria-nav-items">
              {diretoria.map((mod) => <NavItem key={mod.href} href={mod.href} label={mod.label} current={current(mod.href)} />)}
            </div>
          </details>
        ) : null}
        {conselho && show(conselho.label) ? <NavItem href={conselho.href} label={conselho.label} current={current(conselho.href)} /> : null}
        {rest.map((mod) => <NavItem key={mod.href} href={mod.href} label={mod.label} current={current(mod.href)} />)}
        {tools.filter((tool) => !CONFIG_TOOLS.has(tool.href)).map((tool) => <NavItem key={tool.href} href={tool.href} label={tool.label} current={current(tool.href)} />)}
        {settings.length ? (
          <details className="nav-group settings-group" open={settings.some((tool) => current(tool.href)) || Boolean(needle)}>
            <summary title="Configurações">
              <span className="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg></span>
              <span className="nav-label">Configurações</span>
            </summary>
            <div className="diretoria-nav-items">
              {settings.map((tool) => <NavItem key={tool.href} href={tool.href} label={tool.label} current={current(tool.href)} />)}
            </div>
          </details>
        ) : null}
      </nav>
      <div className="sidebar-session">
        {/* No celular o topo do sistema fica oculto: Minha área vem para o menu. */}
        <Link className="button mobile-only" href="/sistema/conta" onClick={() => setMenuOpen(false)}>
          <span className="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg></span><span className="nav-label">Minha área</span>
        </Link>
        {show("Sair deste aparelho") ? <button className="button" type="button" title="Sair deste aparelho" onClick={() => void logout("local")}><span className="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M10 7V4h10v16H10v-3M4 12h11m0 0-3-3m3 3-3 3"/></svg></span><span className="nav-label">Sair deste aparelho</span></button> : null}
        {show("Sair de todos os aparelhos") ? <button className="button" type="button" title="Sair de todos os aparelhos" onClick={() => void logout("global")}><span className="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 7V4h11v16H9v-3M3 12h12m0 0-3-3m3 3-3 3"/></svg></span><span className="nav-label">Sair de todos os aparelhos</span></button> : null}
        {show("Tema") ? <ThemeToggle /> : null}
      </div>
    </aside>
  );
}
