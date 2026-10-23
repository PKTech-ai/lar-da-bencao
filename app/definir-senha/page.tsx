import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { createClient } from "@/lib/supabase/server";
import { PasswordForm } from "./password-form";

export default async function PasswordPage({ searchParams }: { searchParams: Promise<{ motivo?: string }> }) {
  const supabase = await createClient();
  const user = await supabase.auth.getUser();
  if (!user.data.user) redirect("/login");
  const motivo = (await searchParams).motivo;
  const intro = motivo === "primeiro-acesso"
    ? "Sua senha inicial é o seu CPF. Troque agora por uma senha com pelo menos 6 caracteres."
    : "Escolha uma senha com pelo menos 6 caracteres.";
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Brand prominent />
        <h1>Defina sua senha</h1>
        <p className="muted">{intro}</p>
        <PasswordForm />
      </section>
    </main>
  );
}
