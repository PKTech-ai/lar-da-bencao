"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Brand } from "@/components/brand";
import { createClient } from "@/lib/supabase/client";

export type NavCapability = {
  audit: boolean;
  attachments: boolean;
  users: boolean;
  moduleAdmin: boolean;
  modules: { href: string; label: string }[];
};

export function Sidebar({ actor, capabilities }: { actor: { name: string; role: string; email: string }; capabilities: NavCapability }) {
  const pathname = usePathname();
  const router = useRouter();
  const links = [
    ["/sistema", "Visão Geral", true],
    ...capabilities.modules.map((m) => [m.href, m.label, true] as const),
    ["/sistema/auditoria", "Dedo-duro / Histórico", capabilities.audit],
    ["/sistema/anexos", "Anexos no banco", capabilities.attachments],
    ["/sistema/usuarios", "Usuários e permissões", capabilities.users],
    ["/sistema/modulos", "Módulos e ondas", capabilities.moduleAdmin],
    ["/sistema/importacao", "Importação v215", capabilities.moduleAdmin]
  ] as const;

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
    <aside className="sidebar">
      <Brand />
      <nav className="nav-list" aria-label="Módulos principais">
        {links.filter(([, , visible]) => visible).map(([href, label]) => (
          <Link key={href} className="nav-link" href={href} data-current={pathname === href || (href !== "/sistema" && pathname.startsWith(href))}>{label}</Link>
        ))}
      </nav>
      <div className="sidebar-user">
        <Link href="/sistema/conta" className="nav-link" data-current={pathname === "/sistema/conta"} style={{ padding: 0, minHeight: 0 }}><strong>{actor.name}</strong></Link>
        <small>{actor.role} · {actor.email}</small>
        <button className="button" type="button" onClick={() => void logout("local")}>Sair deste aparelho</button>
        <button className="button" type="button" style={{ marginTop: 8 }} onClick={() => void logout("global")}>Sair de todos os aparelhos</button>
      </div>
    </aside>
  );
}
