import { z } from "zod";

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  DATABASE_URL: z.string().min(20),
  CRON_SECRET: z.string().min(32),
  BOOTSTRAP_SECRET: z.string().min(40),
  ANTIMALWARE_API_URL: z.string().url(),
  ANTIMALWARE_API_TOKEN: z.string().min(20),
  APP_URL: z.string().url()
}).superRefine((env, ctx) => {
  // Em produção o scanner precisa ser um serviço real sob HTTPS (nunca o scanner local de desenvolvimento).
  if (process.env.VERCEL_ENV !== "production") return;
  const scanner = new URL(env.ANTIMALWARE_API_URL);
  if (scanner.protocol !== "https:" || ["localhost", "127.0.0.1", "::1"].includes(scanner.hostname)) {
    ctx.addIssue({ code: "custom", path: ["ANTIMALWARE_API_URL"], message: "Em produção, use um scanner HTTPS externo." });
  }
  if (new URL(env.APP_URL).protocol !== "https:") {
    ctx.addIssue({ code: "custom", path: ["APP_URL"], message: "Em produção, APP_URL deve usar HTTPS." });
  }
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  // BL-059: previews estão desligados em vercel.json; se algum for publicado, não acessa segredos nem banco.
  if (process.env.VERCEL_ENV === "preview") throw new Error("Pré-visualizações não podem acessar o banco ou segredos de produção.");
  cached = serverSchema.parse(process.env);
  return cached;
}

export function publicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase não configurado. Defina as variáveis Production descritas em .env.example.");
  }
  return { url, key };
}
