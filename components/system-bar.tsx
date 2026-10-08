"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";

export function SystemBar({ actor, environmentLabel }: { actor: { name: string; role: string }; environmentLabel: string | null }) {
  const router = useRouter();
  const initials = actor.name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");

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
      {environmentLabel ? <span className="production-badge">{environmentLabel}</span> : null}
      <Link href="/sistema/conta" className="session-chip">
        <span className="session-avatar" aria-hidden="true">{initials || "LB"}</span>
        <span>
          <strong>{actor.name}</strong>
          <small>{actor.role}</small>
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
