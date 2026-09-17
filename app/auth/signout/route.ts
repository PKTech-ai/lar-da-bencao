import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Limpa os cookies de uma sessão recusada pelo servidor (ex.: revogada) e volta ao login. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  const login = new URL("/login", url.origin);
  if (url.searchParams.get("motivo") === "sessao") login.searchParams.set("motivo", "sessao");
  return NextResponse.redirect(login);
}
