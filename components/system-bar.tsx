"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { adminTools, type ToolCapabilities } from "@/lib/admin-tools";
import { sessionInitials } from "@/lib/home-dashboard";
import { createClient } from "@/lib/supabase/client";

export function SystemBar({ actor, roleLabel, capabilities }: { actor: { name: string; role: string }; roleLabel: string; capabilities: ToolCapabilities }) {
  const router = useRouter();
  const initials = sessionInitials(actor.name) || "LB";
  // Como no visual: quem administra abre o Controle de Acesso pelo chip; os demais, a própria área.
  const chipHref = capabilities.users ? "/sistema/acesso" : "/sistema/conta";
  const tools = adminTools(capabilities);

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
    <div className="system-bar">
      <Link href={chipHref} className="session-chip" title={roleLabel} aria-label={`${actor.name} — ${roleLabel}`}>
        <span className="session-avatar" aria-hidden="true">{initials}</span>
        <span className="session-text"><strong>{actor.name}</strong></span>
      </Link>
      <Link href="/sistema/conta" className="button">Minha área</Link>
      <details className="system-menu">
        <summary className="button">Opções do sistema</summary>
        <div>
          {tools.length ? (
            <nav className="system-menu-tools" aria-label="Ferramentas do sistema">
              {tools.map((tool) => <Link key={tool.href} className="system-menu-link" href={tool.href}>{tool.label}</Link>)}
            </nav>
          ) : null}
          <button className="button" type="button" onClick={() => void logout("local")}>Sair deste aparelho</button>
          <button className="button" type="button" onClick={() => void logout("global")}>Sair de todos os aparelhos</button>
          <ThemeToggle />
        </div>
      </details>
    </div>
  );
}
