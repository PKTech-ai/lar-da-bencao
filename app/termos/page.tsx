import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { TermsForm } from "./terms-form";
import { requireActor } from "@/lib/auth";
import { query } from "@/lib/db";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

export const dynamic = "force-dynamic";

export default async function TermosPage() {
  const actor = await requireActor().catch(() => null);
  if (!actor) redirect("/login");
  // Quem já aceitou esta versão não precisa aceitar de novo (ex.: ao recadastrar o autenticador).
  const accepted = await query("select 1 from app.terms_acceptances where user_id = $1 and terms_version = $2", [actor.id, CURRENT_TERMS_VERSION])
    .catch(() => ({ rowCount: 0 }));
  if (accepted.rowCount) redirect("/sistema");

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <Brand />
        <h1>Termos de uso institucional</h1>
        <p className="muted">Obrigatório no primeiro acesso após autenticação.</p>
        <TermsForm />
      </div>
    </div>
  );
}
