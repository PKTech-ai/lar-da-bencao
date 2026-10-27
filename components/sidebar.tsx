"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Brand } from "@/components/brand";
import { NavIcon } from "@/components/nav-icon";
import { ThemeToggle } from "@/components/theme-toggle";
import { adminTools, type ToolCapabilities } from "@/lib/admin-tools";
import { createClient } from "@/lib/supabase/client";

export type NavCapability = ToolCapabilities;

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
  const [collapsed, setCollapsed] = useState(false);
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
  const rest = capabilities.modules
    .filter((mod) => !PLACED.has(mod.href) && !(mod.href === IN_SECRETARIA && byHref.has("/sistema/secretaria")))
    .map((mod) => ({ ...mod, label: menuLabel(mod.href, mod.label) }))
    .filter((mod) => show(mod.label))
    .sort((a, b) => {
      const left = MENU_ORDER.indexOf(a.href);
      const right = MENU_ORDER.indexOf(b.href);
      return (left === -1 ? 99 : left) - (right === -1 ? 99 : right);
    });

  useEffect(() => {
    setCollapsed(localStorage.getItem("sidebar-collapsed") === "1");
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
      return next;
    });
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
    <aside className={`${collapsed ? "sidebar is-collapsed" : "sidebar"}${menuOpen ? " menu-open" : ""}`}>
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
        {capabilities.users && show("Controle de Acesso") ? <NavItem href="/sistema/acesso" label="Controle de Acesso" current={current("/sistema/acesso")} /> : null}
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
        {tools.map((tool) => <NavItem key={tool.href} href={tool.href} label={tool.label} current={current(tool.href)} />)}
      </nav>
      <div className="sidebar-session">
        {show("Sair deste aparelho") ? <button className="button" type="button" title="Sair deste aparelho" onClick={() => void logout("local")}><span className="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M10 7V4h10v16H10v-3M4 12h11m0 0-3-3m3 3-3 3"/></svg></span><span className="nav-label">Sair deste aparelho</span></button> : null}
        {show("Sair de todos os aparelhos") ? <button className="button" type="button" title="Sair de todos os aparelhos" onClick={() => void logout("global")}><span className="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 7V4h11v16H9v-3M3 12h12m0 0-3-3m3 3-3 3"/></svg></span><span className="nav-label">Sair de todos os aparelhos</span></button> : null}
        {show("Tema") ? <ThemeToggle /> : null}
      </div>
    </aside>
  );
}
