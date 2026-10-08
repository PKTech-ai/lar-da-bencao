"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { sessionInitials, sessionShowsRole } from "@/lib/home-dashboard";
import { createClient } from "@/lib/supabase/client";

export function SystemBar({ actor, roleLabel }: { actor: { name: string; role: string }; roleLabel: string }) {
  const router = useRouter();
  const initials = sessionInitials(actor.name) || "LB";
  const showRole = sessionShowsRole(actor.name, roleLabel);

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
      <Link href="/sistema/conta" className="session-chip">
        <span className="session-avatar" aria-hidden="true">{initials}</span>
        <span className="session-text">
          <strong>{actor.name}</strong>
          {showRole ? <small>{roleLabel}</small> : null}
        </span>
      </Link>
      <Link href="/sistema/conta" className="button">Minha área</Link>
      <details className="system-menu">
        <summary className="button">Opções do sistema</summary>
        <div>
          <button className="button" type="button" onClick={() => void logout("local")}>Sair deste aparelho</button>
          <button className="button" type="button" onClick={() => void logout("global")}>Sair de todos os aparelhos</button>
          <ThemeToggle />
        </div>
      </details>
    </div>
  );
}
