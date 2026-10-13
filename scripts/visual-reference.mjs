// Grava o estado final do HTML v215 (depois que todas as camadas de versão terminam).
// Uso: node scripts/visual-reference.mjs  → tmp/visual-215-ref/
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const OUT = resolve("tmp/visual-215-ref");
const SETTLE_MS = 15000;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto(pathToFileURL(resolve("dist/index.html")).href, { timeout: 120000 });
await page.waitForTimeout(SETTLE_MS);

const nav = await page.evaluate(() =>
  [...document.querySelectorAll(".nav button, .nav a")].filter((e) => e.offsetParent).map((e) => e.innerText.replace(/\s+/g, " ").trim()).filter(Boolean)
);
const pageIds = await page.evaluate(() => [...document.querySelectorAll('section[id^="page-"]')].map((s) => s.id.slice(5)));
const pages = {};
for (const id of pageIds) {
  await page.evaluate((p) => go(p), id);
  await page.waitForTimeout(500);
  const tabs = await page.evaluate((p) =>
    [...document.querySelectorAll(`#page-${p} .sub button[data-panel], #page-${p} button[data-panel]`)]
      .filter((b, i, all) => all.findIndex((x) => x.dataset.panel === b.dataset.panel) === i)
      .map((b) => ({ panel: b.dataset.panel, label: b.innerText.replace(/\s+/g, " ").trim() })), id);
  pages[id] = { tabs };
  await page.screenshot({ path: `${OUT}/${id}.png` });
  for (const tab of tabs) {
    await page.evaluate(([p, t]) => activateDepartmentPanel(`page-${p}`, t), [id, tab.panel]);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${id}__${tab.panel}.png` });
  }
}
writeFileSync(`${OUT}/reference.json`, JSON.stringify({ nav, pages }, null, 2));
await browser.close();
console.log(`${Object.keys(pages).length} páginas gravadas em ${OUT}`);
