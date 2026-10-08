"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/brand";
import { NavIcon } from "@/components/nav-icon";

export type NavCapability = {
  audit: boolean;
  attachments: boolean;
  users: boolean;
  moduleAdmin: boolean;
  modules: { href: string; label: string }[];
};

const DIRETORIA = ["/sistema/presidencia", "/sistema/secretaria", "/sistema/tesouraria", "/sistema/conselhofiscal"];
const PLACED = new Set(["/sistema/documentos", ...DIRETORIA]);

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
  const diretoria = DIRETORIA.flatMap((href) => {
    const mod = byHref.get(href);
    return mod && show(mod.label) ? [mod] : [];
  });
  const rest = capabilities.modules.filter((mod) => !PLACED.has(mod.href) && show(mod.label));
  const tools = [
    { href: "/sistema/auditoria", label: "Dedo-duro / Histórico", shown: capabilities.audit },
    { href: "/sistema/anexos", label: "Anexos no banco", shown: capabilities.attachments },
    { href: "/sistema/usuarios", label: "Usuários e permissões", shown: capabilities.users },
    { href: "/sistema/instituicao", label: "Dados da instituição", shown: capabilities.users },
    { href: "/sistema/sugestoes", label: "Sugestões", shown: true },
    { href: "/sistema/modulos", label: "Módulos e ondas", shown: capabilities.moduleAdmin },
    { href: "/sistema/importacao", label: "Importação v215", shown: capabilities.moduleAdmin }
  ].filter((item) => item.shown && show(item.label));
  const diretoriaOpen = diretoria.some((mod) => current(mod.href)) || needle.length > 0;

  return (
    <aside className="sidebar">
      <Brand subtitle="Sistema integrado" />
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
          <details className="nav-group" open={diretoriaOpen || undefined}>
            <summary>Diretoria</summary>
            {diretoria.map((mod) => <NavItem key={mod.href} href={mod.href} label={mod.label} current={current(mod.href)} />)}
          </details>
        ) : null}
        {rest.map((mod) => <NavItem key={mod.href} href={mod.href} label={mod.label} current={current(mod.href)} />)}
        {tools.map((item) => <NavItem key={item.href} href={item.href} label={item.label} current={current(item.href)} />)}
      </nav>
    </aside>
  );
}
