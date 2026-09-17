import { defineConfig, devices } from "@playwright/test";

/**
 * E2E contra o Supabase LOCAL (`npx supabase start`) e o app em `pnpm dev`.
 * Nunca aponte para produção: o setup recria o banco local (`supabase db reset`).
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: process.env.E2E_TRACE ? "retain-on-failure" : "off",
    screenshot: "only-on-failure",
    // Contorno para macOS quando o Chromium não registra portas Mach (serviços do sistema degradados).
    launchOptions: process.env.E2E_SINGLE_PROCESS ? { args: ["--single-process"] } : {}
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } }
  ]
});
