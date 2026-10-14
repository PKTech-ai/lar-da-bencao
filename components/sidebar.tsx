"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/brand";
import { NavIcon } from "@/components/nav-icon";
import { TOOL_MODULES, type ToolCapabilities } from "@/lib/admin-tools";

export type NavCapability = ToolCapabilities;

const DIRETORIA = ["/sistema/presidencia", "/sistema/secretaria", "/sistema/tesouraria"];
const PLACED = new Set(["/sistema/documentos", "/sistema/conselhofiscal", ...DIRETORIA]);
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
    <Link className="nav-link" href={href} data-current={current}>
      <NavIcon href={href} />
      {label}
    </Link>
  );
}

export function Sidebar({ capabilities }: { actor: { name: string; role: string; email: string }; capabilities: NavCapability }) {
  const pathname = usePathname();
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
  const rest = capabilities.modules
    .filter((mod) => !PLACED.has(mod.href) && !TOOL_MODULES.includes(mod.href))
    .map((mod) => ({ ...mod, label: menuLabel(mod.href, mod.label) }))
    .filter((mod) => show(mod.label))
    .sort((a, b) => {
      const left = MENU_ORDER.indexOf(a.href);
      const right = MENU_ORDER.indexOf(b.href);
      return (left === -1 ? 99 : left) - (right === -1 ? 99 : right);
    });

  return (
    <aside className="sidebar">
      <Brand subtitle="Sistema Integrado — Demonstração Funcional com Dados Fictícios" />
      <label className="module-search">
        Encontrar módulo
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome do departamento" aria-label="Encontrar módulo" />
      </label>
      <nav className="nav-list" aria-label="Módulos principais">
        {show("Visão Geral") ? <NavItem href="/sistema" label="Visão Geral" current={current("/sistema")} /> : null}
        {documentos && show(documentos.label) ? <NavItem href={documentos.href} label={documentos.label} current={current(documentos.href)} /> : null}
        {show("Organograma") ? <NavItem href="/sistema/organograma" label="Organograma" current={current("/sistema/organograma")} /> : null}
        {capabilities.users && show("Controle de Acesso") ? <NavItem href="/sistema/acesso" label="Controle de Acesso" current={current("/sistema/acesso")} /> : null}
        {diretoria.length ? (
          <details className="nav-group" open>
            <summary>Diretoria</summary>
            <div className="diretoria-nav-items">
              {diretoria.map((mod) => <NavItem key={mod.href} href={mod.href} label={mod.label} current={current(mod.href)} />)}
            </div>
          </details>
        ) : null}
        {conselho && show(conselho.label) ? <NavItem href={conselho.href} label={conselho.label} current={current(conselho.href)} /> : null}
        {rest.map((mod) => <NavItem key={mod.href} href={mod.href} label={mod.label} current={current(mod.href)} />)}
      </nav>
    </aside>
  );
}
