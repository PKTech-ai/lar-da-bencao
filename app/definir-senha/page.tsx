import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { createClient } from "@/lib/supabase/server";
import { PasswordForm } from "./password-form";

export default async function PasswordPage() {
  const supabase = await createClient(); const user = await supabase.auth.getUser();
  if (!user.data.user) redirect("/login");
  return <main className="auth-shell"><section className="auth-card"><Brand/><h1>Defina sua senha</h1><p className="muted">Use uma senha exclusiva, com pelo menos 14 caracteres.</p><PasswordForm /></section></main>;
}
