"use client";

import Link from "next/link";
import type { ToolCapabilities } from "@/lib/admin-tools";
import { sessionInitials } from "@/lib/home-dashboard";

export function SystemBar({ actor, roleLabel, capabilities }: { actor: { name: string; role: string }; roleLabel: string; capabilities: ToolCapabilities }) {
  const initials = sessionInitials(actor.name) || "LB";
  // Como no visual: quem administra abre o Controle de Acesso pelo chip; os demais, a própria área.
  const chipHref = capabilities.users ? "/sistema/acesso" : "/sistema/conta";

  return (
    <div className="system-bar">
      <Link href={chipHref} className="session-chip" title={roleLabel} aria-label={`${actor.name} — ${roleLabel}`}>
        <span className="session-avatar" aria-hidden="true">{initials}</span>
        <span className="session-text"><strong>{actor.name}</strong></span>
      </Link>
      <Link href="/sistema/conta" className="button">Minha área</Link>
    </div>
  );
}
