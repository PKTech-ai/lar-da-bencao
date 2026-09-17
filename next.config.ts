import type { NextConfig } from "next";

/** Origem do Supabase configurada (domínio próprio ou local), além dos domínios padrão. */
function supabaseOrigins() {
  const origins = new Set(["https://*.supabase.co", "wss://*.supabase.co"]);
  const configured = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (configured) {
    const url = new URL(configured);
    origins.add(url.origin);
    origins.add(`${url.protocol === "https:" ? "wss" : "ws"}://${url.host}`);
  }
  return [...origins].join(" ");
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      `connect-src 'self' ${supabaseOrigins()}`,
      "media-src 'self' blob:",
      "worker-src 'self' blob:",
      ...(process.env.APP_URL?.startsWith("https://") ? ["upgrade-insecure-requests"] : [])
    ].join("; ")
  }
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders
      }
    ];
  }
};

export default nextConfig;
