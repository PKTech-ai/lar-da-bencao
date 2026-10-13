// Gera lib/department-info.ts a partir de DEPT_PANEL_INFO do HTML v215.
// Uso: node scripts/extract-department-info.mjs
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const KEYS = {
  "Doutrina": "doutrina", "Infância": "infancia", "Juventude": "juventude", "Assistência e Promoção Social": "assistencia",
  "Tesouraria": "tesouraria", "Conselho Fiscal": "conselhofiscal", "Patrimônio": "patrimonio", "Eventos": "eventos",
  "Divulgação": "divulgacao", "Jurídico": "juridico", "Secretaria": "secretaria", "Diretoria": "presidencia"
};

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(resolve("dist/index.html")).href, { timeout: 120000 });
await page.waitForTimeout(8000);
const raw = await page.evaluate(() => DEPT_PANEL_INFO);
await browser.close();

const data = {};
for (const [name, key] of Object.entries(KEYS)) {
  const info = raw[name];
  if (!info) throw new Error(`DEPT_PANEL_INFO sem "${name}"`);
  data[key] = { title: info.title, basis: info.basis ?? "", purpose: info.purpose, activities: info.activities ?? [], flow: info.flow ?? "" };
}

const body = `/**
 * Quadro "Sobre o departamento" — gerado por scripts/extract-department-info.mjs a partir do HTML v215.
 * Não editar à mão: rode o script de novo.
 */
export type DepartmentInfo = { title: string; basis: string; purpose: string; activities: string[]; flow: string };
export type DepartmentInfoKey = ${Object.values(KEYS).map((k) => JSON.stringify(k)).join(" | ")};

export const DEPARTMENT_INFO: Record<DepartmentInfoKey, DepartmentInfo> = ${JSON.stringify(data, null, 2)};

export function departmentInfoFor(moduleSlug: string): DepartmentInfo | null {
  return (DEPARTMENT_INFO as Record<string, DepartmentInfo>)[moduleSlug] ?? null;
}
`;
writeFileSync("lib/department-info.ts", body);
console.log(`lib/department-info.ts: ${Object.keys(data).length} departamentos`);
