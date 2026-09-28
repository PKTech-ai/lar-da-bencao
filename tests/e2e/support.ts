import { expect, type Page } from "@playwright/test";
import { Client } from "pg";

export const OWNER_URL = process.env.E2E_OWNER_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
export const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";
export const BOOTSTRAP_SECRET = process.env.E2E_BOOTSTRAP_SECRET ?? "local_bootstrap_secret_00000000000000000000000000";
export const CRON_SECRET = process.env.E2E_CRON_SECRET ?? "local_cron_secret_000000000000000000000000";
export const PASSWORD = "Senha-Forte-E2e-2026!";

export async function sql<T = Record<string, unknown>>(text: string, values: unknown[] = []) {
  const client = new Client({ connectionString: OWNER_URL });
  await client.connect();
  try {
    return (await client.query(text, values)).rows as T[];
  } finally {
    await client.end();
  }
}

type MailSummary = { ID: string; To: { Address: string }[]; Subject: string; Created: string };

/** Último e-mail recebido pelo destinatário no Mailpit (Supabase local). */
export async function latestMail(to: string, subjectIncludes: string) {
  for (let i = 0; i < 30; i += 1) {
    const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)).json() as { messages: MailSummary[] };
    const found = list.messages.find((m) => m.Subject.includes(subjectIncludes));
    if (found) return (await fetch(`${MAILPIT}/api/v1/message/${found.ID}`)).json() as Promise<{ HTML: string; Text: string; Subject: string }>;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`E-mail "${subjectIncludes}" não chegou para ${to}`);
}

export function linkFrom(html: string) {
  const match = html.match(/href="([^"]*auth\/callback[^"]*)"/);
  if (!match) throw new Error("Link de callback não encontrado no e-mail");
  return match[1].replace(/&amp;/g, "&");
}

export async function acceptTerms(page: Page) {
  await expect(page.getByRole("heading", { name: "Termos de uso institucional" })).toBeVisible();
  await page.getByRole("button", { name: "Li e aceito" }).click();
  await expect(page).toHaveURL(/\/sistema$/);
}

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("E-mail institucional").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Continuar" }).click();
}

/** Nenhuma tela pode cair no erro genérico. */
export async function expectHealthyPage(page: Page, path: string, heading?: RegExp) {
  const response = await page.goto(path);
  expect(response?.status(), path).toBeLessThan(400);
  await expect(page.getByText("Não foi possível carregar esta página")).toHaveCount(0);
  if (heading) await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
}
