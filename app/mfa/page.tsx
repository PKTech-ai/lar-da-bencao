import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { createClient } from "@/lib/supabase/server";
import { MfaForm } from "./mfa-form";

export const dynamic = "force-dynamic";

export default async function MfaPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.data?.currentLevel === "aal2") redirect("/sistema");

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="mfa-title">
        <Brand />
        <h1 id="mfa-title">Confirmação em duas etapas</h1>
        <p className="muted">Use um aplicativo autenticador. O código muda a cada 30 segundos.</p>
        <MfaForm />
      </section>
    </main>
  );
}
