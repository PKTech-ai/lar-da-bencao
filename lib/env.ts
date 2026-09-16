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
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
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
