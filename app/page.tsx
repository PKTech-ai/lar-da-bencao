import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  redirect(assurance.data?.currentLevel === "aal2" ? "/sistema" : "/mfa");
}
