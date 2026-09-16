import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/navigation";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const target = safeInternalPath(next, "/mfa");
  if (code) {
    const supabase = await createClient();
    const result = await supabase.auth.exchangeCodeForSession(code);
    if (!result.error) return NextResponse.redirect(new URL(target, url.origin));
  }
  return NextResponse.redirect(new URL("/login?erro=convite", url.origin));
}
