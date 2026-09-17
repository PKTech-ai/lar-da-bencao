import { createHmac } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { Client } from "pg";

export const OWNER_URL = process.env.E2E_OWNER_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
export const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";
export const BOOTSTRAP_SECRET = process.env.E2E_BOOTSTRAP_SECRET ?? "local_bootstrap_secret_00000000000000000000000000";
export const CRON_SECRET = process.env.E2E_CRON_SECRET ?? "local_cron_secret_000000000000000000000000";
export const PASSWORD = "Senha-Forte-E2e-2026!";

/** TOTP (RFC 6238) a partir da chave manual exibida na ativação. */
export function totp(secret: string, offsetSteps = 0) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of secret.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000) + offsetSteps));
  const hmac = createHmac("sha1", key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  return String((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

/** Aguarda a próxima janela de 30 s (o Auth recusa reuso do mesmo código). */
export async function freshTotp(secret: string, used: Set<string>) {
  for (let i = 0; i < 40; i += 1) {
    const code = totp(secret);
    if (!used.has(code)) { used.add(code); return code; }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Sem novo código TOTP");
}

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

/** Ativação do MFA na tela /mfa: lê a chave manual, confirma e guarda os códigos de recuperação. */
export async function enrollMfa(page: Page, used: Set<string>) {
  await expect(page.getByRole("heading", { name: "Confirmação em duas etapas" })).toBeVisible();
  const secret = await page.getByLabel("Chave manual").inputValue();
  await page.getByLabel("Código de 6 dígitos").fill(await freshTotp(secret, used));
  await page.getByRole("button", { name: "Confirmar e entrar" }).click();
  await expect(page.getByText("Guarde estes códigos agora")).toBeVisible();
  const codes = await page.locator("ul li code").allTextContents();
  expect(codes).toHaveLength(10);
  await page.getByRole("button", { name: "Já salvei — continuar" }).click();
  return { secret, codes };
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

export async function loginWithMfa(page: Page, email: string, secret: string, used: Set<string>) {
  await login(page, email);
  await expect(page).toHaveURL(/\/mfa/);
  await page.getByLabel("Código de 6 dígitos").fill(await freshTotp(secret, used));
  await page.getByRole("button", { name: "Confirmar e entrar" }).click();
  await expect(page).toHaveURL(/\/(sistema|termos)/);
}

/** Nenhuma tela pode cair no erro genérico. */
export async function expectHealthyPage(page: Page, path: string, heading?: RegExp) {
  const response = await page.goto(path);
  expect(response?.status(), path).toBeLessThan(400);
  await expect(page.getByText("Não foi possível carregar esta página")).toHaveCount(0);
  if (heading) await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
}
