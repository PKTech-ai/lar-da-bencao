"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Brand } from "@/components/brand";
import { createClient } from "@/lib/supabase/client";

type Capabilities = { audit: boolean; attachments: boolean; users: boolean };

export function Sidebar({ actor, capabilities }: { actor: { name: string; role: string; email: string }; capabilities: Capabilities }) {
  const pathname = usePathname();
  const router = useRouter();
  const links = [
    ["/sistema", "Visão Geral", true],
    ["/sistema/auditoria", "Dedo-duro / Histórico", capabilities.audit],
    ["/sistema/anexos", "Anexos no banco", capabilities.attachments],
    ["/sistema/usuarios", "Usuários e permissões", capabilities.users]
  ] as const;

  async function logout() {
    const supabase = createClient();
    await fetch("/api/auth/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "logout" }) });
    await supabase.auth.signOut({ scope: "local" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="sidebar">
      <Brand />
      <nav className="nav-list" aria-label="Módulos principais">
        {links.filter(([, , visible]) => visible).map(([href, label]) => (
          <Link key={href} className="nav-link" href={href} data-current={pathname === href}>{label}</Link>
        ))}
      </nav>
      <div className="sidebar-user">
        <strong>{actor.name}</strong>
        <small>{actor.role} · {actor.email}</small>
        <button className="button" type="button" onClick={logout}>Sair deste aparelho</button>
      </div>
    </aside>
  );
}
