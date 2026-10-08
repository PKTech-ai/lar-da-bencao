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

export function Sidebar({ capabilities }: { actor: { name: string; role: string; email: string }; capabilities: NavCapability }) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const links = [
    ["/sistema", "Visão Geral", true],
    ...capabilities.modules.map((m) => [m.href, m.label, true] as const),
    ["/sistema/auditoria", "Dedo-duro / Histórico", capabilities.audit],
    ["/sistema/anexos", "Anexos no banco", capabilities.attachments],
    ["/sistema/usuarios", "Usuários e permissões", capabilities.users],
    ["/sistema/acesso", "Controle de Acesso", capabilities.users],
    ["/sistema/instituicao", "Dados da instituição", capabilities.users],
    ["/sistema/organograma", "Organograma", true],
    ["/sistema/sugestoes", "Sugestões", true],
    ["/sistema/modulos", "Módulos e ondas", capabilities.moduleAdmin],
    ["/sistema/importacao", "Importação v215", capabilities.moduleAdmin]
  ] as const;

  const visible = links.filter(([, label, shown]) => shown && label.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR")));

  return (
    <aside className="sidebar">
      <Brand subtitle="Sistema integrado" />
      <label className="module-search">
        Encontrar módulo
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome do departamento" aria-label="Encontrar módulo" />
      </label>
      <nav className="nav-list" aria-label="Módulos principais">
        {visible.map(([href, label]) => (
          <Link key={href} className="nav-link" href={href} data-current={pathname === href || (href !== "/sistema" && pathname.startsWith(href))}>
            <NavIcon href={href} />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
