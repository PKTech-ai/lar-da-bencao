import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rotas com autenticação própria (Bearer/segredo) também ficam fora do redirecionamento de login.
const publicPaths = ["/login", "/recuperar", "/auth/callback", "/auth/signout", "/api/auth/login", "/api/health", "/api/bootstrap", "/api/maintenance"];

export async function proxy(request: NextRequest) {
  if (process.env.VERCEL_ENV === "production" && process.env.APP_URL) {
    const canonical = new URL(process.env.APP_URL);
    const host = request.headers.get("host")?.split(":")[0];
    if (host && host !== canonical.hostname && !request.nextUrl.pathname.startsWith("/api/maintenance/")) {
      const target = new URL(request.nextUrl.pathname + request.nextUrl.search, canonical);
      return NextResponse.redirect(target, 308);
    }
  }

  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  const { data } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isPublic = publicPaths.some((path) => pathname === path || pathname.startsWith(path + "/"));
  const isStatic = pathname.startsWith("/_next/") || pathname === "/favicon.ico";

  if (!data.user && !isPublic && !isStatic) {
    // APIs respondem 401 em JSON (fetch não deve receber a página de login).
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Autenticação necessária.", code: "UNAUTHENTICATED" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (data.user && pathname === "/login") {
    const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const target = request.nextUrl.clone();
    target.pathname = assurance.data?.currentLevel === "aal2" ? "/sistema" : "/mfa";
    target.search = "";
    return NextResponse.redirect(target);
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"]
};
