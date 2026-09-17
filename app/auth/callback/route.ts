import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/navigation";

const OTP_TYPES = new Set<EmailOtpType>(["invite", "recovery", "email", "email_change", "signup", "magiclink"]);

/**
 * Retorno dos links de e-mail do Supabase Auth.
 * - `token_hash` + `type`: convites e recuperação (templates de e-mail do projeto; funciona em qualquer navegador)
 * - `code`: fluxo PKCE iniciado neste navegador
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = safeInternalPath(url.searchParams.get("next"), "/mfa");
  const supabase = await createClient();
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");

  if (tokenHash && type && OTP_TYPES.has(type)) {
    const result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!result.error) return NextResponse.redirect(new URL(target, url.origin));
  } else if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code);
    if (!result.error) return NextResponse.redirect(new URL(target, url.origin));
  }
  const reason = type === "recovery" ? "recuperacao" : "convite";
  return NextResponse.redirect(new URL(`/login?erro=${reason}`, url.origin));
}
