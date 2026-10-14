# Paridade v215 — todas as lacunas restantes (fases 2 a 8)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cobrir tudo o que o `/visual` (HTML v215, estado final) tem e o `/sistema` ainda não tem: telas, abas, formulários, regras, impressões, mobile e tema escuro, com dados reais no Postgres.

**Architecture:** O plano parte da fase 1 já pronta: abas `ModuleTabs`, `SuggestionsBox`, `DepartmentAbout` e o Painel genérico. Depois vem um bloco comum (fase 2: relatório no formato do visual e "Quem coordena" por papel). Em seguida, módulo por módulo (fases 3 a 7), e por fim casca e mobile (fase 8). Sempre que der, cadastro novo entra pelo motor declarativo `lib/resources` (definição em `lib/resources/defs/*.ts` e tela pronta no `ResourceManager`). Regras com cálculo ficam em funções puras em `lib/`, com teste Vitest. Telas próprias entram como painéis em `components/modules/` e são ligadas em `lib/module-pages.ts` ou `components/modules/panels.tsx`.

**Tech Stack:** Next.js 16.3 (App Router), React 19.3, Postgres (Supabase) via `lib/db.ts`, zod, Vitest, Playwright (`@playwright/test`). Antes de usar qualquer API do Next, leia `node_modules/next/dist/docs/`.

**Spec:** a seção "Inventário" abaixo, tirada do HTML por `scripts/visual-panels.mjs` (Task 0). O plano anterior, `docs/plans/2026-10-13-paridade-visual-v215.md`, continua valendo para a casca.

---

## Ponto de partida

- Branch base: `feat/paridade-v215-fase1` (7 commits, ainda sem merge). Crie `feat/paridade-v215-lacunas` a partir dela. Se a fase 1 já tiver entrado na `main`, crie a partir da `main`.
- Referência visual: `node scripts/visual-reference.mjs` grava `tmp/visual-215-ref/*.png`. A Task 0 acrescenta `panels.json`, com os campos e as colunas de cada aba.
- Banco local: Supabase em `127.0.0.1:54322` (OrbStack). `next dev` já pode estar rodando em `:3010`; confira com `curl localhost:3010/api/health` antes de subir outro. Admin local: `admin@lar.local` / `Senha-Forte-E2e-2026!` (crie pelo bootstrap se o banco tiver sido recriado; veja `docs/LOCAL_SETUP.md`).

## Global Constraints

- Não embutir o HTML nem portar o mecanismo dele (`localStorage`, IndexedDB, `go()`). Copiar só desenho, textos, ordem e regras.
- Dados só no Postgres. Migração nova em `supabase/migrations/AAAAMMDDHHMM_nome.sql`, idempotente (`if not exists`), entre `begin;` e `commit;`, com `grant` para `lar_app`. Tabelas do motor de cadastros precisam de `archived_at`, `archived_by`, `archive_reason`, `version`, `created_at`, `created_by`, `updated_at` e `updated_by`.
- Toda rota de API segue o padrão de `app/api/doutrina/culto/route.ts`: `requireActor()`; `assertSameOrigin(request)` em escrita; checagem de permissão; zod; `transaction` com `version` para concorrência; `appendAudit` em toda escrita; e `errorResponse` no `catch`.
- Texto da demonstração não entra no app: "Demonstração Funcional", "dados fictícios", "Carregar extrato fictício", "Cenário fictício", "Perfil demonstrativo" e números de exemplo. A frase "Ambiente de teste · dados fictícios" só aparece quando `runtimeEnvironment().production` é falso.
- Aba nova respeita `hasPermission`, flags e `SECTOR_ROLE_RESOURCE`. Sem permissão, a aba não aparece.
- O formulário de usuário mantém o campo E-mail (o login é pelo Supabase Auth).
- Não rodar `tests/e2e/fundacao-onda1.spec.ts` nem `tests/e2e/global-setup.ts`: eles chamam `supabase db reset`. Para conferir telas, use scripts Playwright contra o `next dev` (o modelo está na Task 0).
- CSS novo vai em `app/globals.css`, com variante `:root[data-theme="dark"]`. Medidas copiadas de `theme-215/theme.css` ou dos blocos `<style>` do HTML.
- Commits: uma mensagem por tarefa, no estilo do repositório (`feat:` / `fix:` em português), terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nada de push sem pedido do Ryan.
- Antes de cada commit: `pnpm typecheck && pnpm lint && pnpm vitest run` precisam passar.

## Review Focus

1. **Rancho com evangelizando sem chamada no mês.** A família não pode aparecer como "Apta". O HTML exige chamada registrada de todos os evangelizandos e o mínimo individual. (Teste na Task 9.)
2. **Dois evangelizandos com o mesmo responsável grafado diferente** ("Maria  da Silva" e "maria da silva"). Os dois caem na mesma família, que recebe 1 rancho. (Teste na Task 9.)
3. **Competência da Tesouraria ainda aberta.** A aba Parecer do Conselho Fiscal mostra "Relatório ainda indisponível" e não deixa registrar parecer. (Teste na Task 14.)
4. **Documento Word com campo vazio.** O .docx gerado mantém o marcador (`[PREENCHER]`, `[DATA]`) e não quebra o arquivo. (Teste na Task 21.)
5. **Tela de 390 px.** Nenhuma tela nova cria rolagem horizontal na página; tabelas largas rolam dentro do próprio contêiner. (Script na Task 27.)

---

## Inventário (HTML final × app)

Legenda: 🗄 a tabela existe, falta API e tela · 🔌 a API ou o componente existe, falta a tela ou a ligação · ❌ não existe · 🎨 existe, mas o desenho ou a regra é diferente.

| Fase | Lacuna | Situação no app | Task |
| --- | --- | --- | --- |
| 2 | Relatório Anual no formato do visual (De/Até, Sintético com "Consolidação mensal" e "Totais por frente de trabalho", Analítico com os registros) | 🎨 tabela anual simples (`components/modules/relatorio-anual.tsx`) | 1 |
| 2 | "Quem coordena" com dois nomes (Coordenador/Subcoordenador; Secretário/Subsecretário; Presidente/Vice; Conselheiros/Apoio) | 🎨 só `role_key = 'coordenador'` | 2 |
| 3 | Painel da Doutrina com Trabalhadores ativos, Posições, Preenchidas, Frequência no mês, Média/encontro e Conflitos | 🎨 outros indicadores | 3 |
| 3 | Culto no Lar | 🔌 a API `app/api/doutrina/culto` está completa; a página só tem o título | 4 |
| 3 | Caravana no Lar | 🗄 `app.caravana_activities` | 5 |
| 3 | Planejamento de Treinamentos | 🗄 `app.doctrine_trainings` e `doctrine_training_sessions`; a lógica está em `lib/doutrina-extras.ts` | 6 |
| 3 | WhatsApp e Relatório Anual da Doutrina | 🔌 `WhatsappQueue scope="doutrina"` e `lib/reports.ts` | 7 |
| 4 | Painel da Assistência (6 indicadores e a tabela de setores) | ❌ | 8 |
| 4 | Rancho dos Evangelizandos (família pelo responsável, frequência mínima de 75% ajustável, Aprovar, Rejeitar, Liberar 1 rancho, Registrar entrega) | ❌ só existe `evangelizandos.rancho_requested` | 9 |
| 4 | Doação de Rancho (famílias sem evangelizando: análise, aprovação e doação) | 🎨 cadastro "Famílias" sem aprovação | 10 |
| 4 | Relação de Entrega (as duas origens, ordem alfabética, coluna de assinatura) | ❌ | 11 |
| 4 | Clube de Mães numa aba só (Livro caixa, Cadastros, Relação de enxoval, Entregas), com estoque de enxoval, entrega por itens e devolução | 🎨 3 abas; a entrega é texto livre e não há estoque | 12 |
| 5 | Painel da Tesouraria (Contribuições pagas e pendentes, Receitas e Despesas do mês, Caixa) | ❌ hoje é o Painel genérico | 13 |
| 5 | Aba "Conselho Fiscal" da Tesouraria: relatório mensal impresso ao CF, com resumo por conta e movimentações | ❌ | 13 |
| 5 | Conselho Fiscal em 5 abas (Painel, Análise Mensal com comprovantes, Parecer, Histórico, Relatório Anual) | 🎨 uma aba "Análises e Pareceres" | 14, 15 |
| 6 | Presidência: Painel com 6 indicadores, Situação dos Módulos, Trabalhadores e Relatório Anual | 🎨 parcial | 16 |
| 6 | Secretaria: abre em "Reuniões e Atas", com o gravador dentro (1. Dados, 2. Gravação e transcrição, 3. Ata); Painel com cadastros e dados da instituição (CNPJ, Natureza Jurídica, Atividade Principal, Endereço); Trabalhadores; Relatório Anual | 🎨 parcial | 17, 18 |
| 6 | Patrimônio, Eventos, Divulgação e Jurídico: Painéis com o conteúdo do visual | 🎨 Painel genérico | 19 |
| 7 | Jurídico/Eleições: Regras e orientações, Organizar eleição, Conferência de participantes, Documentos para cartório (6 .docx e ZIP) | 🎨 só o cadastro de etapas | 20, 21, 22 |
| 7 | Divulgação: "Controle da Livraria" numa aba (Inventário de empréstimos, Estoque para revenda, Empréstimos, Livro caixa/vendas) | 🎨 4 abas separadas | 23 |
| 7 | Infância e Juventude: aba Evangelizadores; na Juventude, Aniversariantes por último | 🎨 link para `/sistema/trabalhadores` | 23 |
| 8 | Controle de Acesso com 8 abas, Painel com indicadores e modal "Cadastrar acesso" no desenho do visual | 🎨 telas espalhadas em 5 rotas | 24, 25 |
| 8 | Backup e restauração | 🎨 só a importação v215 | 24 |
| 8 | Minha área (cadastro, contribuições e escalas da pessoa) | 🎨 `/sistema/conta` mostra só a conta | 26 |
| 8 | Mobile: topo com menu, gaveta lateral, seletor "Você está em", barra inferior (Minha área, Início, Módulos, Ajuda) e diálogo "Como usar" | ❌ | 27 |
| 8 | Tema escuro: título da página e menu lateral ilegíveis | 🎨 bug dos commits de 08–09/10 | 28 |
| 8 | Conferência final tela a tela | — | 29 |

## Ordem e dependências

Task 0 → Fase 2 (1, 2) → Fases 3 a 7 (em qualquer ordem entre fases; dentro de cada fase, na ordem) → Fase 8. As tasks 1 e 2 mudam componentes usados por todos os Painéis e Relatórios, por isso vêm primeiro.

---

## Fase 0 — referência de campos

### Task 0: Extrair campos, colunas e diálogos de cada aba do HTML

**Files:**
- Create: `scripts/visual-panels.mjs`

**Interfaces:**
- Produces: `tmp/visual-215-ref/panels.json`, no formato `{ "<pagina>/<painel>": { panel: { headings, kpis, tables, buttons, fields, notices }, dialogs: { "<botão>": {...} } } }`. Cada task de tela confere seus rótulos contra esse arquivo.

- [ ] **Step 1: Escrever o script**

```js
// Grava o conteúdo de cada aba do HTML v215 (títulos, indicadores, colunas, botões, campos e diálogos).
// Uso: node scripts/visual-panels.mjs  → tmp/visual-215-ref/panels.json
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const OUT = resolve("tmp/visual-215-ref");
mkdirSync(OUT, { recursive: true });
const reference = JSON.parse(readFileSync(`${OUT}/reference.json`, "utf8"));
const targets = Object.entries(reference.pages).flatMap(([page, { tabs }]) => (tabs.length ? tabs.map((t) => [page, t.panel]) : [[page, ""]]));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on("dialog", (d) => d.dismiss().catch(() => {}));
await page.goto(pathToFileURL(resolve("dist/index.html")).href, { timeout: 120000 });
await page.waitForTimeout(15000);

const dump = (selector) => page.evaluate((selector) => {
  const root = document.querySelector(selector);
  if (!root) return null;
  const vis = (e) => !!(e.offsetParent || e.getClientRects().length);
  const t = (e) => (e.innerText || e.textContent || "").replace(/\s+/g, " ").trim();
  const label = (el) => {
    const l = el.closest("label") || (el.id && document.querySelector(`label[for="${el.id}"]`));
    return ((l ? t(l) : "") || el.placeholder || el.name || el.id || "").slice(0, 80);
  };
  const field = (e) => `${e.tagName.toLowerCase()}:${e.type || ""}${e.required ? "*" : ""} ${label(e)}`
    + (e.tagName === "SELECT" ? ` [${[...e.options].slice(0, 12).map((o) => o.text.trim()).join(" | ")}]` : "");
  return {
    headings: [...root.querySelectorAll("h1,h2,h3,h4")].filter(vis).map(t).filter(Boolean).slice(0, 25),
    kpis: [...root.querySelectorAll(".kpi")].filter(vis).map(t).slice(0, 16),
    tables: [...root.querySelectorAll("table")].filter(vis).map((tb) => [...tb.querySelectorAll("thead th")].map(t).join(" | ")).filter(Boolean),
    buttons: [...new Set([...root.querySelectorAll("button")].filter(vis).map(t).filter((x) => x && x.length < 60))].slice(0, 40),
    fields: [...root.querySelectorAll("input,select,textarea")].filter((e) => e.type !== "hidden" && vis(e)).map(field).slice(0, 60),
    notices: [...root.querySelectorAll(".notice,.small.muted,p")].filter(vis).map(t).filter((x) => x.length > 30).slice(0, 8)
  };
}, selector);

const result = {};
for (const [pg, panel] of targets) {
  await page.evaluate((p) => go(p), pg);
  await page.waitForTimeout(400);
  if (panel) { await page.evaluate(([p, t]) => activateDepartmentPanel(`page-${p}`, t), [pg, panel]); await page.waitForTimeout(500); }
  const selector = panel ? `#${panel}` : `#page-${pg}`;
  const entry = { panel: await dump(selector), dialogs: {} };
  const openers = await page.evaluate((selector) => [...(document.querySelector(selector)?.querySelectorAll("button") ?? [])]
    .filter((b) => b.offsetParent && /^(\+|Novo|Nova|Cadastrar|Registrar|Adicionar|Agendar|Lançar|Solicitar|Anexar|Gerar)/i.test(b.innerText.trim()))
    .map((b) => b.innerText.replace(/\s+/g, " ").trim()), selector);
  for (const label of [...new Set(openers)].slice(0, 6)) {
    try {
      await page.locator(selector).getByRole("button", { name: label, exact: true }).first().click({ timeout: 3000 });
      await page.waitForTimeout(600);
      const found = await page.evaluate(() => {
        const open = [...document.querySelectorAll("dialog[open], .modal, [role=dialog]")].filter((x) => x.open || (x.offsetParent && getComputedStyle(x).display !== "none"));
        const last = open[open.length - 1];
        if (!last) return false;
        last.setAttribute("data-dump", "1");
        return true;
      });
      entry.dialogs[label] = found ? await dump('[data-dump="1"]') : "(sem diálogo)";
      await page.evaluate(() => { const x = document.querySelector('[data-dump="1"]'); if (!x) return; x.removeAttribute("data-dump"); if (x.close) x.close(); else x.style.display = "none"; });
      await page.keyboard.press("Escape");
    } catch (error) {
      entry.dialogs[label] = `(não abriu: ${String(error).slice(0, 60)})`;
    }
  }
  result[`${pg}/${panel}`] = entry;
}
writeFileSync(`${OUT}/panels.json`, JSON.stringify(result, null, 1));
await browser.close();
console.log(`${Object.keys(result).length} abas gravadas em ${OUT}/panels.json`);
```

- [ ] **Step 2: Rodar**

Run: `node scripts/visual-reference.mjs && node scripts/visual-panels.mjs`
Expected: `… abas gravadas em …/panels.json`. Em `panels.json`, `"doutrina/p-caravana-lar".dialogs["Registrar atividade"].fields` lista "Atividade / tema *", "Data *", "Horário", "Local", "Responsável *", "Situação *", "Quantidade de participantes" e "Observações / resultados".

- [ ] **Step 3: Commit**

```bash
git add scripts/visual-panels.mjs
git commit -m "chore: extrair campos e colunas de cada aba do visual v215"
```

### Modelo de conferência visual (usado em todas as tasks de tela)

Cada task de tela termina com uma conferência no navegador. Use este script, salvo em `scripts/app-shots.mjs` na Task 3 e reaproveitado depois:

```js
// Uso: node scripts/app-shots.mjs <largura> <claro|escuro> <caminho...>  → tmp/app-shots/
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const [width, theme, ...paths] = process.argv.slice(2);
const BASE = process.env.APP_URL_LOCAL ?? "http://localhost:3010";
mkdirSync("tmp/app-shots", { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: Number(width), height: 1000 }, baseURL: BASE });
const page = await ctx.newPage();
await page.goto("/login", { timeout: 120000 });
await page.getByLabel("E-mail institucional").fill(process.env.LOCAL_ADMIN_EMAIL ?? "admin@lar.local");
await page.getByLabel("Senha").fill(process.env.LOCAL_ADMIN_PASSWORD ?? "Senha-Forte-E2e-2026!");
await page.getByRole("button", { name: "Continuar" }).click();
await page.waitForURL(/\/(sistema|termos)/, { timeout: 120000 });
await page.goto("/sistema", { timeout: 180000 });
if (page.url().includes("/termos")) await page.getByRole("button", { name: "Li e aceito" }).click();
for (const p of paths) {
  const response = await page.goto(p, { timeout: 180000 });
  if (theme === "escuro") await page.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
  await page.waitForTimeout(800);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log(p, response?.status(), overflow ? "ROLAGEM-HORIZONTAL" : "ok");
  await page.screenshot({ path: `tmp/app-shots/${p.replace(/\//g, "_")}-${width}-${theme}.png` });
}
await browser.close();
```

O resultado esperado em toda conferência é: status 200, nenhuma linha com `ROLAGEM-HORIZONTAL` em 390 px, e a captura igual à de `tmp/visual-215-ref/` correspondente em ordem de abas, títulos, colunas e rótulos.

---

## Fase 2 — peças comuns

### Task 1: Relatório Anual no formato do visual

O visual mostra, em todos os departamentos: filtros **De** e **Até** (mês); botões **Relatório Sintético** e **Relatório Analítico**; **Consultar sintético** e **Consultar analítico**; o cabeçalho com o período ("Período: janeiro de 2026 a outubro de 2026. Registros considerados até DD/MM/AAAA."); a tabela **Consolidação mensal** (`Mês | Atividades confirmadas | Registros operacionais`); a tabela **Totais por frente de trabalho** (`Frente / fonte | Atividades confirmadas | Registros operacionais`); e o texto "Consulte o Relatório Analítico para nomes, datas, responsáveis, descrições e observações de cada registro. Os dois relatórios utilizam a mesma base de realizações." O analítico lista cada registro.

**Files:**
- Modify: `lib/reports.ts` (fontes ganham `kind`, `describe`, `responsible`; consulta por período)
- Create: `lib/report-period.ts`, `lib/report-period.test.ts`
- Modify: `app/api/relatorios/[department]/route.ts` (aceita `from`, `to` e `mode`)
- Modify: `components/modules/relatorio-anual.tsx` (nova tela)
- Test: `lib/report-period.test.ts`

**Interfaces:**
- Produces: `type ReportSource = { label: string; table: string; dateColumn: string; where?: string; kind: "atividade" | "registro"; describe: string; responsible?: string; amount?: string }`; `parsePeriod(from: string, to: string): { from: string; to: string; months: string[] }` (lança `AppError` se `to < from` ou se o período passar de 24 meses); `consolidate(rows: { month: string; kind: "atividade" | "registro"; source: string }[], months: string[]): { byMonth: { month: string; atividades: number; registros: number }[]; bySource: { source: string; atividades: number; registros: number }[] }`; `GET /api/relatorios/[department]?from=AAAA-MM&to=AAAA-MM&mode=sintetico|analitico` → `{ department, period, byMonth, bySource, records? }`. O componente mantém o nome `AnnualReport({ department })`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, expect, it } from "vitest";
import { consolidate, parsePeriod } from "@/lib/report-period";

describe("período do relatório", () => {
  it("lista os meses do intervalo, inclusive virando o ano", () => {
    expect(parsePeriod("2025-11", "2026-02").months).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
  it("recusa período invertido ou maior que 24 meses", () => {
    expect(() => parsePeriod("2026-05", "2026-01")).toThrow("O mês final");
    expect(() => parsePeriod("2023-01", "2026-01")).toThrow("24 meses");
  });
  it("recusa mês inválido", () => {
    expect(() => parsePeriod("2026-13", "2026-12")).toThrow("Mês inválido");
  });
});

describe("consolidação", () => {
  it("conta atividades e registros por mês e por frente, com meses vazios", () => {
    const result = consolidate([
      { month: "2026-01", kind: "atividade", source: "Caravana no Lar" },
      { month: "2026-01", kind: "registro", source: "Escala mensal" },
      { month: "2026-03", kind: "atividade", source: "Caravana no Lar" }
    ], ["2026-01", "2026-02", "2026-03"]);
    expect(result.byMonth).toEqual([
      { month: "2026-01", atividades: 1, registros: 1 },
      { month: "2026-02", atividades: 0, registros: 0 },
      { month: "2026-03", atividades: 1, registros: 0 }
    ]);
    expect(result.bySource).toEqual([
      { source: "Caravana no Lar", atividades: 2, registros: 0 },
      { source: "Escala mensal", atividades: 0, registros: 1 }
    ]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run lib/report-period.test.ts`
Expected: FAIL com `Cannot find package '@/lib/report-period'`.

- [ ] **Step 3: Implementar `lib/report-period.ts`**

```ts
/** Período e consolidação do Relatório Anual (Sintético/Analítico do visual). Módulo puro. */
import { AppError } from "@/lib/errors";

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function parsePeriod(from: string, to: string) {
  if (!MONTH.test(from) || !MONTH.test(to)) throw new AppError("Mês inválido. Use o formato AAAA-MM.");
  if (to < from) throw new AppError("O mês final precisa ser igual ou posterior ao inicial.");
  const months: string[] = [];
  let [y, m] = from.split("-").map(Number);
  while (`${y}-${String(m).padStart(2, "0")}` <= to) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    if (months.length > 24) throw new AppError("Escolha um período de até 24 meses.");
    m += 1;
    if (m === 13) { m = 1; y += 1; }
  }
  return { from, to, months };
}

export function consolidate(rows: { month: string; kind: "atividade" | "registro"; source: string }[], months: string[]) {
  const byMonth = months.map((month) => ({
    month,
    atividades: rows.filter((r) => r.month === month && r.kind === "atividade").length,
    registros: rows.filter((r) => r.month === month && r.kind === "registro").length
  }));
  const sources = [...new Set(rows.map((r) => r.source))];
  const bySource = sources.map((source) => ({
    source,
    atividades: rows.filter((r) => r.source === source && r.kind === "atividade").length,
    registros: rows.filter((r) => r.source === source && r.kind === "registro").length
  }));
  return { byMonth, bySource };
}
```

- [ ] **Step 4: Rodar o teste**

Run: `pnpm vitest run lib/report-period.test.ts`
Expected: 4 PASS.

- [ ] **Step 5: Fontes por período em `lib/reports.ts`**

Troque o tipo e a função. As fontes que já existem ganham `kind`, `describe` e `responsible`:

```ts
import { query } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { consolidate, parsePeriod } from "@/lib/report-period";

export type ReportSource = {
  label: string; table: string; dateColumn: string; where?: string;
  kind: "atividade" | "registro";
  /** Expressão SQL (colunas da tabela `r`) com o texto do registro no analítico. */
  describe: string;
  responsible?: string;
};

export const REPORT_SOURCES: Record<string, ReportSource[]> = {
  patrimonio: [
    { label: "Bens cadastrados", table: "patrimony_assets", dateColumn: "entry_date", where: "r.archived_at is null", kind: "registro", describe: "r.tombamento || ' — ' || r.description" },
    { label: "Baixas autorizadas", table: "patrimony_disposals", dateColumn: "disposal_date", where: "r.status = 'approved'", kind: "atividade", describe: "'Baixa ' || coalesce(r.memo_number, '')" },
    { label: "Escalas de limpeza", table: "cleaning_roster", dateColumn: "clean_date", where: "r.status <> 'cancelled'", kind: "atividade", describe: "'Limpeza de domingo'" }
  ],
  assistencia_social: [
    { label: "Entregas de rancho", table: "social_rancho_deliveries", dateColumn: "delivery_date", where: "r.archived_at is null and r.status = 'Entregue'", kind: "atividade", describe: "'Rancho entregue'", responsible: "r.responsible" },
    { label: "Kits de higiene", table: "social_hygiene_kits", dateColumn: "delivery_date", where: "r.archived_at is null and r.status = 'Realizada'", kind: "atividade", describe: "'Kits de higiene'" },
    { label: "Atividades realizadas", table: "social_activities", dateColumn: "effective_date", where: "r.archived_at is null and r.status = 'Realizada'", kind: "atividade", describe: "r.title" }
  ],
  eventos: [
    { label: "Eventos realizados", table: "events", dateColumn: "event_date", where: "r.archived_at is null and r.status = 'Realizado'", kind: "atividade", describe: "r.name" },
    { label: "Itens previstos", table: "event_items", dateColumn: "created_at", where: "r.archived_at is null", kind: "registro", describe: "r.item" }
  ],
  divulgacao: [
    { label: "Empréstimos", table: "book_loans", dateColumn: "loan_date", where: "r.archived_at is null", kind: "registro", describe: "'Empréstimo de livro'" },
    { label: "Vendas", table: "book_sales", dateColumn: "sale_date", where: "r.archived_at is null", kind: "registro", describe: "'Venda de livro'" }
  ],
  secretaria: [
    { label: "Reuniões", table: "meetings", dateColumn: "meeting_date", where: "r.archived_at is null", kind: "atividade", describe: "r.title", responsible: "r.secretary" }
  ],
  juridico: [
    { label: "Etapas de eleição", table: "elections", dateColumn: "notice_date", where: "r.archived_at is null", kind: "atividade", describe: "r.title || ' — ' || r.stage" }
  ]
};

export async function departmentReport(department: string, from: string, to: string, mode: "sintetico" | "analitico") {
  const sources = REPORT_SOURCES[department];
  if (!sources) throw new AppError("Este departamento ainda não tem relatório anual.", 404, "NOT_FOUND");
  const period = parsePeriod(from, to);
  const rows: { month: string; kind: "atividade" | "registro"; source: string; date: string; text: string; responsible: string }[] = [];
  for (const s of sources) {
    const result = await query<{ month: string; date: string; text: string; responsible: string }>(
      `select to_char(r.${s.dateColumn}, 'YYYY-MM') as month, to_char(r.${s.dateColumn}, 'YYYY-MM-DD') as date,
              coalesce(${s.describe}, '') as text, coalesce(${s.responsible ?? "''"}, '') as responsible
         from app.${s.table} r
        where to_char(r.${s.dateColumn}, 'YYYY-MM') between $1 and $2 ${s.where ? `and ${s.where}` : ""}
        order by r.${s.dateColumn}`,
      [period.from, period.to]
    );
    for (const row of result.rows) rows.push({ ...row, kind: s.kind, source: s.label });
  }
  const { byMonth, bySource } = consolidate(rows, period.months);
  return { department, period, byMonth, bySource, records: mode === "analitico" ? rows : undefined };
}
```

Antes de gravar, confira cada nome de coluna usado em `describe` e `responsible` com o `create table` da migração correspondente (`grep -n "create table if not exists app.<tabela>" -A25 supabase/migrations/*.sql`). Troque qualquer coluna que não exista pela que existe; o valor exibido precisa identificar o registro.

- [ ] **Step 6: Rota**

Em `app/api/relatorios/[department]/route.ts`, troque a leitura de `year` por:

```ts
const params = new URL(request.url).searchParams;
const now = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()).slice(0, 7);
const from = params.get("from") ?? `${now.slice(0, 4)}-01`;
const to = params.get("to") ?? now;
const mode = z.enum(["sintetico", "analitico"]).parse(params.get("mode") ?? "sintetico");
const report = await departmentReport(department, from, to, mode);
```

e o `details` da auditoria por ``${department} · ${from} a ${to} · ${mode}``.

- [ ] **Step 7: Tela**

Reescreva `components/modules/relatorio-anual.tsx` (cliente) com: título `Relatório Anual — {departmentTitle}`; texto "Prestação de contas das atividades e registros do departamento no período selecionado."; filtros `De` e `Até` (`input type="month"`, padrão janeiro do ano corrente até o mês corrente); botões `Relatório Sintético` e `Relatório Analítico` (alternam o modo, com a classe `primary` no ativo); `Consultar sintético` ou `Consultar analítico` (busca); e `⎙ Imprimir`. No modo sintético, mostre o bloco "Relatório Sintético — prévia" com a linha do período, a tabela "Consolidação mensal" (o mês por extenso, como "janeiro de 2026") e "Totais por frente de trabalho". No modo analítico, mostre uma tabela `Data | Frente / fonte | Registro | Responsável` com todos os `records`. Sem registros, use o texto do visual: "Não há atividades realizadas ou registros operacionais confirmados para este período. As atribuições institucionais não são contadas como realizações." O componente recebe `department` (chave) e `title` (rótulo); ajuste as chamadas em `components/modules/panels.tsx` para passar `title`.

- [ ] **Step 8: Verificar**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run`
Expected: tudo PASS.

Run: `node scripts/app-shots.mjs 1440 claro /sistema/eventos/relatorio /sistema/patrimonio/relatorio`
Expected: status 200 e o desenho de `tmp/visual-215-ref/eventos__evt-relatorio.png`.

- [ ] **Step 9: Commit**

```bash
git add lib/report-period.ts lib/report-period.test.ts lib/reports.ts "app/api/relatorios/[department]/route.ts" components/modules/relatorio-anual.tsx components/modules/panels.tsx
git commit -m "feat: relatório anual sintético e analítico no formato do visual v215"
```

### Task 2: "Quem coordena" por papel

No visual, o quadro mostra dois nomes, e os rótulos mudam por módulo: Doutrina e os demais departamentos usam "Coordenador(a)" e "Subcoordenador(a)"; Secretaria usa "Secretário(a)" e "Subsecretário(a)"; Presidência usa "Presidente" e "Vice-presidente"; Conselho Fiscal usa "Conselheiro(s) fiscal(is)" e "Apoio definido no acesso". O mesmo par aparece no cabeçalho do Relatório Anual.

**Files:**
- Create: `lib/department-leaders.ts`, `lib/department-leaders.test.ts`
- Modify: `components/department-about.tsx` (recebe `leaders` em vez de `coordinators`)
- Modify: `components/department-about.test.tsx`
- Modify: `components/modules/department-dashboard.tsx` (busca os líderes)
- Modify: `app/sistema/doutrina/page.tsx` (passa a mostrar o `DepartmentAbout`)

**Interfaces:**
- Produces: `type LeaderSlot = { label: string; roles: string[]; byDepartment: boolean }`; `leaderSlots(moduleSlug: string): [LeaderSlot, LeaderSlot]`; `leaderNames(rows: { role_key: string; full_name: string; department_key: string | null }[], slot: LeaderSlot, department: string): string` (nomes unidos por " / ", ou "" se não houver ninguém); `<DepartmentAbout info leaders={{ label: string; names: string }[]} />`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, expect, it } from "vitest";
import { leaderNames, leaderSlots } from "@/lib/department-leaders";

describe("quem coordena", () => {
  it("usa coordenador e subcoordenador do departamento", () => {
    const [coord, sub] = leaderSlots("patrimonio");
    expect([coord.label, sub.label]).toEqual(["Coordenador(a)", "Subcoordenador(a)"]);
    const rows = [
      { role_key: "coordenador", full_name: "Ana", department_key: "patrimonio" },
      { role_key: "coordenador", full_name: "Bia", department_key: "eventos" },
      { role_key: "subcoordenador", full_name: "Caio", department_key: "patrimonio" }
    ];
    expect(leaderNames(rows, coord, "patrimonio")).toBe("Ana");
    expect(leaderNames(rows, sub, "patrimonio")).toBe("Caio");
  });
  it("Secretaria, Presidência e Conselho usam o papel, sem departamento", () => {
    expect(leaderSlots("secretaria").map((s) => s.label)).toEqual(["Secretário(a)", "Subsecretário(a)"]);
    expect(leaderSlots("presidencia").map((s) => s.label)).toEqual(["Presidente", "Vice-presidente"]);
    expect(leaderSlots("conselhofiscal")[0].label).toBe("Conselheiro(s) fiscal(is)");
    const rows = [{ role_key: "presidente", full_name: "Marcel", department_key: null }];
    expect(leaderNames(rows, leaderSlots("presidencia")[0], "diretoria")).toBe("Marcel");
  });
  it("vários nomes saem separados por barra, em ordem alfabética", () => {
    const rows = [
      { role_key: "conselheiro_fiscal", full_name: "Sérgio", department_key: null },
      { role_key: "conselheiro_fiscal", full_name: "Ana", department_key: null }
    ];
    expect(leaderNames(rows, leaderSlots("conselhofiscal")[0], "conselho_fiscal")).toBe("Ana / Sérgio");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run lib/department-leaders.test.ts`
Expected: FAIL (o módulo ainda não existe).

- [ ] **Step 3: Implementar**

```ts
/** Rótulos e papéis do quadro "Quem coordena" (visual v215). Módulo puro. */
export type LeaderSlot = { label: string; roles: string[]; byDepartment: boolean };

const BY_MODULE: Record<string, [LeaderSlot, LeaderSlot]> = {
  secretaria: [{ label: "Secretário(a)", roles: ["secretario"], byDepartment: false }, { label: "Subsecretário(a)", roles: ["subsecretario"], byDepartment: false }],
  presidencia: [{ label: "Presidente", roles: ["presidente"], byDepartment: false }, { label: "Vice-presidente", roles: ["vice_presidente"], byDepartment: false }],
  conselhofiscal: [{ label: "Conselheiro(s) fiscal(is)", roles: ["conselheiro_fiscal"], byDepartment: false }, { label: "Apoio definido no acesso", roles: ["subcoordenador"], byDepartment: true }],
  tesouraria: [{ label: "Tesoureiro(a)", roles: ["tesoureiro"], byDepartment: false }, { label: "Subcoordenador(a)", roles: ["subcoordenador"], byDepartment: true }]
};
const DEFAULT: [LeaderSlot, LeaderSlot] = [
  { label: "Coordenador(a)", roles: ["coordenador"], byDepartment: true },
  { label: "Subcoordenador(a)", roles: ["subcoordenador"], byDepartment: true }
];

export function leaderSlots(moduleSlug: string): [LeaderSlot, LeaderSlot] {
  return BY_MODULE[moduleSlug] ?? DEFAULT;
}

export function leaderNames(rows: { role_key: string; full_name: string; department_key: string | null }[], slot: LeaderSlot, department: string) {
  return rows
    .filter((r) => slot.roles.includes(r.role_key) && (!slot.byDepartment || r.department_key === department))
    .map((r) => r.full_name)
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .join(" / ");
}
```

O papel `subsecretario` não existe em `app.roles`. O slot continua no código e mostra vazio até que o papel seja criado; não crie papel novo nesta task.

- [ ] **Step 4: Rodar o teste**

Run: `pnpm vitest run lib/department-leaders.test.ts`
Expected: 3 PASS.

- [ ] **Step 5: Ligar no quadro e no Painel**

Em `components/department-about.tsx`, troque a prop `coordinators: string[]` por `leaders: { label: string; names: string }[]`. O cartão "Quem coordena" passa a listar, para cada líder, `<p><strong>{l.label}:</strong> {l.names || "Sem vínculo no Controle de Acesso"}</p>`. Atualize `components/department-about.test.tsx`: o primeiro teste passa `leaders={[{ label: "Coordenador(a)", names: "Ana Souza" }, { label: "Subcoordenador(a)", names: "" }]}` e espera `"Coordenador(a):"`, `"Ana Souza"` e `"Sem vínculo no Controle de Acesso"`; o segundo teste é removido, porque o texto vazio já está coberto.

Em `components/modules/department-dashboard.tsx`, troque a consulta de coordenadores por:

```ts
query<{ role_key: string; full_name: string; department_key: string | null }>(
  `select u.role_key, u.full_name, ud.department_key from app.users u
     left join app.user_departments ud on ud.user_id = u.id
    where u.status = 'active' and u.role_key in ('coordenador','subcoordenador','secretario','presidente','vice_presidente','conselheiro_fiscal','tesoureiro')`)
```

e monte `leaders = leaderSlots(page.slug).map((slot) => ({ label: slot.label, names: leaderNames(rows, slot, key) }))`.

Em `app/sistema/doutrina/page.tsx`, acrescente no topo do Painel `<DepartmentAbout info={DEPARTMENT_INFO.doutrina} leaders={…} />` com a mesma consulta e `leaderSlots("doutrina")`.

- [ ] **Step 6: Verificar e commitar**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run`
Expected: tudo PASS.

```bash
git add lib/department-leaders.ts lib/department-leaders.test.ts components/department-about.tsx components/department-about.test.tsx components/modules/department-dashboard.tsx app/sistema/doutrina/page.tsx
git commit -m "feat: quem coordena por papel, como no visual v215"
```

---

## Fase 3 — Doutrina

As abas da Doutrina ficam, no fim desta fase, nesta ordem (`lib/modules.ts`, `doutrinaSubnav`): Painel, Trabalhadores, Palestrantes Externos, Biblioteca de Estudos, Escala Mensal, Frequência, Culto no Lar, Caravana no Lar (`/sistema/doutrina/caravana`), Planejamento de Treinamentos (`/sistema/doutrina/treinamentos`), WhatsApp (`/sistema/doutrina/whatsapp`) e Relatório Anual (`/sistema/doutrina/relatorio`).

### Task 3: Painel da Doutrina com os indicadores do visual

Indicadores do visual, nesta ordem: **Trabalhadores ativos**, **Posições** (vagas da escala do mês), **Preenchidas**, **Frequência no mês** (soma das presenças registradas), **Média/encontro** (frequência ÷ número de encontros com registro, arredondada) e **Conflitos**. Abaixo vêm os **Alertas** e o cartão "Responsável pelo Departamento de Doutrina", que já existem.

**Files:**
- Create: `lib/doutrina-dashboard.ts`, `lib/doutrina-dashboard.test.ts`
- Create: `scripts/app-shots.mjs` (o modelo da Fase 0)
- Modify: `app/sistema/doutrina/page.tsx`

**Interfaces:**
- Consumes: `loadScale`, `loadScaleOptions` e `reviewScale` (de `lib/doutrina-data.ts`).
- Produces: `doutrinaKpis(input: { workers: number; positions: number; filled: number; attendance: number; meetings: number; conflicts: number }): { label: string; value: string }[]`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, expect, it } from "vitest";
import { doutrinaKpis } from "@/lib/doutrina-dashboard";

describe("indicadores da Doutrina", () => {
  it("segue a ordem e os rótulos do visual", () => {
    const kpis = doutrinaKpis({ workers: 42, positions: 316, filled: 300, attendance: 1507, meetings: 25, conflicts: 2 });
    expect(kpis).toEqual([
      { label: "Trabalhadores ativos", value: "42" },
      { label: "Posições", value: "316" },
      { label: "Preenchidas", value: "300" },
      { label: "Frequência no mês", value: "1507" },
      { label: "Média/encontro", value: "60" },
      { label: "Conflitos", value: "2" }
    ]);
  });
  it("sem encontros, a média é zero (não divide por zero)", () => {
    expect(doutrinaKpis({ workers: 0, positions: 0, filled: 0, attendance: 0, meetings: 0, conflicts: 0 })[4].value).toBe("0");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run lib/doutrina-dashboard.test.ts`
Expected: FAIL (o módulo ainda não existe).

- [ ] **Step 3: Implementar**

```ts
/** Indicadores do Painel da Doutrina (visual v215). Módulo puro. */
export function doutrinaKpis(i: { workers: number; positions: number; filled: number; attendance: number; meetings: number; conflicts: number }) {
  return [
    { label: "Trabalhadores ativos", value: String(i.workers) },
    { label: "Posições", value: String(i.positions) },
    { label: "Preenchidas", value: String(i.filled) },
    { label: "Frequência no mês", value: String(i.attendance) },
    { label: "Média/encontro", value: String(i.meetings ? Math.round(i.attendance / i.meetings) : 0) },
    { label: "Conflitos", value: String(i.conflicts) }
  ];
}
```

- [ ] **Step 4: Rodar o teste**

Run: `pnpm vitest run lib/doutrina-dashboard.test.ts`
Expected: 2 PASS.

- [ ] **Step 5: Ligar na página**

Em `app/sistema/doutrina/page.tsx`, calcule:
- `positions = active ? scale.assignments.size : 0`;
- `filled = active ? [...scale.assignments.values()].filter(Boolean).length : 0`;
- `conflicts = review ? review.conflicts.length + review.invalid.length : 0`;
- `meetings` com a consulta `select count(distinct sheet_date)::int from app.attendance_counts where department_key = 'doutrina' and sheet_date >= date_trunc('month', current_date) and sheet_date < date_trunc('month', current_date) + interval '1 month'`, somada à consulta de contagens que já existe.

Troque a grade de KPIs por `doutrinaKpis({...}).map(...)`, no mesmo markup `card kpi`.

- [ ] **Step 6: Verificar e commitar**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run && node scripts/app-shots.mjs 1440 claro /sistema/doutrina`
Expected: tudo PASS; status 200; seis indicadores na ordem do visual.

```bash
git add lib/doutrina-dashboard.ts lib/doutrina-dashboard.test.ts scripts/app-shots.mjs app/sistema/doutrina/page.tsx
git commit -m "feat: painel da Doutrina com os indicadores do visual v215"
```

### Task 4: Culto no Lar (tela sobre a API pronta)

A API `app/api/doutrina/culto/route.ts` já tem GET (mês, opções e `canEdit`), PUT (salvar) e POST (`generate` / `delete`). Falta a tela. No visual, ela tem: o texto de propósito (`CULTO_PURPOSE`); "Realizado no penúltimo sábado de cada mês, mediante solicitação de um trabalhador ao Departamento de Doutrina."; os campos **Mês**, **Data do Culto** (somente leitura), **Trabalhador solicitante / anfitrião**, **Nome do lar / casa onde será realizado**, **Dirigente** e **Expositor**; os botões **Gerar escala em branco**, **Excluir escala do período** e **⎙ Escala**; a tabela `Data | Lar / Anfitrião | Dirigente | Expositor | Situação`; e o aviso "A escala é gerada sem trabalhadores preenchidos. A escolha do Dirigente e do Expositor é feita manualmente pelo Departamento de Doutrina." "Gerar escala em branco" pede confirmação ("Gerar a escala novamente?") quando já existe registro no mês.

**Files:**
- Create: `lib/culto-view.ts`, `lib/culto-view.test.ts`
- Create: `app/sistema/doutrina/culto-lar/culto-client.tsx`
- Modify: `app/sistema/doutrina/culto-lar/page.tsx`

**Interfaces:**
- Consumes: `GET /api/doutrina/culto?month=AAAA-MM` → `{ culto: { id, culto_date, requester_id, house, leader_id, speaker_id, deleted_at, version, status, saved }, options: { requester, leader, speaker: { id, name }[] }, canEdit }`; `PUT` com `{ month, requester_id, house, leader_id, speaker_id, version }`; `POST` com `{ month, action: "generate" | "delete", version }`; `CULTO_PURPOSE` de `lib/doutrina-extras.ts`.
- Produces: `cultoRow(culto, options): { date: string; house: string; leader: string; speaker: string; status: string }` (data em dd/mm/aaaa; nome ou "—").

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, expect, it } from "vitest";
import { cultoRow } from "@/lib/culto-view";

const options = {
  requester: [{ id: "r1", name: "Ana" }],
  leader: [{ id: "l1", name: "Bruno" }],
  speaker: [{ id: "s1", name: "Carla" }]
};

describe("linha do Culto no Lar", () => {
  it("mostra data, lar com anfitrião, dirigente, expositor e situação", () => {
    expect(cultoRow({ culto_date: "2026-10-24", requester_id: "r1", house: "Casa da Ana", leader_id: "l1", speaker_id: "s1", status: "Escala definida" }, options))
      .toEqual({ date: "24/10/2026", house: "Casa da Ana — Ana", leader: "Bruno", speaker: "Carla", status: "Escala definida" });
  });
  it("campos vazios viram travessão", () => {
    expect(cultoRow({ culto_date: "2026-10-24", requester_id: null, house: "", leader_id: null, speaker_id: null, status: "Aguardando definição pela Doutrina" }, options))
      .toMatchObject({ house: "—", leader: "—", speaker: "—" });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run lib/culto-view.test.ts`
Expected: FAIL (o módulo ainda não existe).

- [ ] **Step 3: Implementar**

```ts
/** Linha da tabela do Culto no Lar. Módulo puro. */
type Option = { id: string; name: string };
type Culto = { culto_date: string; requester_id: string | null; house: string; leader_id: string | null; speaker_id: string | null; status: string };

const nameOf = (list: Option[], id: string | null) => list.find((o) => o.id === id)?.name ?? "";

export function cultoRow(c: Culto, o: { requester: Option[]; leader: Option[]; speaker: Option[] }) {
  const host = nameOf(o.requester, c.requester_id);
  const house = [c.house.trim(), host].filter(Boolean).join(" — ");
  return {
    date: c.culto_date.split("-").reverse().join("/"),
    house: house || "—",
    leader: nameOf(o.leader, c.leader_id) || "—",
    speaker: nameOf(o.speaker, c.speaker_id) || "—",
    status: c.status
  };
}
```

- [ ] **Step 4: Rodar o teste**

Run: `pnpm vitest run lib/culto-view.test.ts`
Expected: 2 PASS.

- [ ] **Step 5: Tela**

`app/sistema/doutrina/culto-lar/culto-client.tsx` ("use client"). Use `api` e `postJson` de `lib/client-api.ts` (confira se existe `putJson`; se não existir, use `fetch` com `method: "PUT"`, `headers: { "Content-Type": "application/json" }` e `credentials: "same-origin"`, como em `lib/client-api.ts`). O estado guarda `month` (padrão: o mês atual em São Paulo), `data` (a resposta do GET), `form` (requester_id, house, leader_id, speaker_id), `error` e `message`. O layout:

```tsx
<section className="card">
  <p>{CULTO_PURPOSE}</p>
  <p className="small muted">Realizado no penúltimo sábado de cada mês, mediante solicitação de um trabalhador ao Departamento de Doutrina.</p>
  <div className="filters">
    <label>Mês<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
    <label>Data do Culto<input readOnly value={row.date} /></label>
    <label>Trabalhador solicitante / anfitrião<select value={form.requester_id ?? ""} onChange={…} disabled={!data.canEdit}><option value="">— escolher —</option>{data.options.requester.map(…)}</select></label>
    <label>Nome do lar / casa onde será realizado<input value={form.house} maxLength={200} onChange={…} disabled={!data.canEdit} /></label>
    <label>Dirigente<select …>{data.options.leader…}</select></label>
    <label>Expositor<select …>{data.options.speaker…}</select></label>
  </div>
  <div className="row-actions no-print">
    {data.canEdit ? <button className="button primary" onClick={save}>Salvar escala do mês</button> : null}
    {data.canEdit ? <button className="button" onClick={generate}>Gerar escala em branco</button> : null}
    {data.canEdit && data.culto.saved && !data.culto.deleted_at ? <button className="button danger" onClick={remove}>Excluir escala do período</button> : null}
    <button className="button" onClick={() => window.print()}>⎙ Escala</button>
  </div>
  <p className="notice">A escala é gerada sem trabalhadores preenchidos. A escolha do Dirigente e do Expositor é feita manualmente pelo Departamento de Doutrina.</p>
</section>
<section className="card"><div className="table-wrap"><table>
  <thead><tr><th>Data</th><th>Lar / Anfitrião</th><th>Dirigente</th><th>Expositor</th><th>Situação</th></tr></thead>
  <tbody><tr><td>{row.date}</td><td>{row.house}</td><td>{row.leader}</td><td>{row.speaker}</td><td>{row.status}</td></tr></tbody>
</table></div></section>
```

`generate()` chama `window.confirm("Gerar a escala novamente? 1 registro(s) da escala serão substituídos. Somente a escala deste período será alterada. Os registros de frequência, atividades realizadas e pagamentos serão mantidos.")` quando `data.culto.saved` é verdadeiro; depois faz `postJson("/api/doutrina/culto", { month, action: "generate", version: data.culto.version })` e recarrega. `remove()` confirma "Excluir a escala do período?" e envia `action: "delete"`. `save()` envia o PUT com `version: data.culto.version`. Erro 409 mostra a mensagem da API em `<div className="error" role="alert">`.

`page.tsx` mantém o `requireModulePage` e renderiza `<header className="module-section-head"><div><h2>Culto no Lar</h2><p>Encontro fraterno no lar de um trabalhador, no penúltimo sábado do mês.</p></div></header><CultoClient />`.

- [ ] **Step 6: Verificar e commitar**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run && node scripts/app-shots.mjs 1440 claro /sistema/doutrina/culto-lar`
Expected: tudo PASS; status 200. Na tela, mudar o Mês troca a Data do Culto para o penúltimo sábado. Salvar, gerar e excluir funcionam com um trabalhador da Doutrina aprovado (cadastre um em `/sistema/trabalhadores` se o banco local estiver vazio).

```bash
git add lib/culto-view.ts lib/culto-view.test.ts app/sistema/doutrina/culto-lar
git commit -m "feat: tela do Culto no Lar sobre a API existente"
```

### Task 5: Caravana no Lar

No visual: o título "Caravana no Lar"; o texto "Organize a programação e registre as atividades realizadas pelo Departamento de Doutrina."; os filtros **Mês**, **Situação** (Todas, Planejada, Realizada, Cancelada) e **Pesquisar**; os botões **Imprimir ficha**, **Imprimir lista**, **Registrar atividade** e **Limpar filtros**; a tabela `Data / horário | Atividade / local | Responsável | Situação | Participantes | Observações / resultados | Ações`; e o diálogo "Registrar atividade — Caravana no Lar" com **Atividade / tema \***, **Data \***, **Horário**, **Local**, **Responsável \***, **Situação \*** (Planejada, Realizada, Cancelada), **Quantidade de participantes** ("Preencha após a realização.") e **Observações / resultados**. Regra: atividade "Realizada" exige quantidade de participantes. "Imprimir ficha" gera o modelo manual com três fichas por folha.

**Files:**
- Create: `supabase/migrations/202610150900_caravana_arquivo.sql`
- Create: `lib/resources/defs/doutrina.ts`
- Modify: `lib/resources/registry.ts`, `lib/resources/rules.ts`, `lib/resources/registry.test.ts`
- Create: `app/sistema/doutrina/caravana/page.tsx`, `app/sistema/doutrina/caravana/caravana-ficha.tsx`
- Modify: `lib/modules.ts` (`doutrinaSubnav`)

**Interfaces:**
- Produces: o recurso `doutrina-caravana` (tabela `caravana_activities`, escopo `{ resource: "department", department: "doutrina" }`, flag `module_doutrina`) e a regra `RULES["doutrina-caravana"]`.

- [ ] **Step 1: Escrever o teste que falha**

Acrescente a `lib/resources/registry.test.ts`:

```ts
import { RESOURCES } from "@/lib/resources/registry";

describe("Caravana no Lar", () => {
  it("é um cadastro da Doutrina com os campos do visual", () => {
    const def = RESOURCES["doutrina-caravana"];
    expect(def.table).toBe("caravana_activities");
    expect(def.scope).toEqual({ resource: "department", department: "doutrina" });
    expect(def.fields.map((f) => f.label)).toEqual([
      "Atividade / tema", "Data", "Horário", "Local", "Responsável", "Situação", "Quantidade de participantes", "Observações / resultados"
    ]);
    expect(def.fields.find((f) => f.name === "status")).toMatchObject({ type: "select", options: ["Planejada", "Realizada", "Cancelada"], required: true });
  });
});
```

Se o teste já tiver um `import` de `RESOURCES` no topo, não repita a linha.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run lib/resources/registry.test.ts`
Expected: FAIL com `Cannot read properties of undefined (reading 'table')`.

- [ ] **Step 3: Migração, definição e regra**

`supabase/migrations/202610150900_caravana_arquivo.sql`:

```sql
begin;
-- Caravana no Lar passa a usar o motor de cadastros (arquivamento em vez de exclusão).
alter table app.caravana_activities
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references app.users(id),
  add column if not exists archive_reason text not null default '' check (char_length(archive_reason) <= 500);
create index if not exists caravana_activities_archived_idx on app.caravana_activities (archived_at, activity_date desc);
commit;
```

O motor de cadastros não tem tipo `time`. Para o Horário, use `type: "text", max: 5, pattern: "^([01]\\d|2[0-3]):[0-5]\\d$"` e confira em `lib/resources/server.ts` (`toDbValue`) que texto vazio vira `null`; se ele gravar `''`, a coluna `time` recusa, então trate `activity_time` vazio como `null` na regra.

`lib/resources/defs/doutrina.ts`:

```ts
import type { ResourceDef } from "@/lib/resources/types";

/** Caravana no Lar (mock `doctrineCaravanaLar`): programação e registro das atividades. */
export const caravana: ResourceDef = {
  key: "doutrina-caravana",
  table: "caravana_activities",
  title: "Caravana no Lar",
  singular: "Atividade da Caravana",
  module: "Doutrina",
  section: "Caravana no Lar",
  flag: "module_doutrina",
  scope: { resource: "department", department: "doutrina" },
  intro: "Organize a programação e registre as atividades realizadas pelo Departamento de Doutrina. As atividades realizadas entram nos relatórios sintético e analítico de Doutrina, conforme a data registrada. A soma de participantes representa participações por atividade.",
  archiveLabel: "Arquivar",
  rules: "doutrina-caravana",
  orderBy: "r.activity_date desc, r.activity_time desc nulls last",
  search: ["title", "place", "responsible", "notes"],
  filters: [{ name: "status", label: "Situação" }],
  fields: [
    { name: "title", label: "Atividade / tema", type: "text", max: 180, required: true, wide: true },
    { name: "activity_date", label: "Data", type: "date", required: true },
    { name: "activity_time", label: "Horário", type: "text", max: 5, pattern: "^([01]\\d|2[0-3]):[0-5]\\d$", placeholder: "19:30" },
    { name: "place", label: "Local", type: "text", max: 250 },
    { name: "responsible", label: "Responsável", type: "text", max: 180, required: true },
    { name: "status", label: "Situação", type: "select", options: ["Planejada", "Realizada", "Cancelada"], required: true },
    { name: "participants", label: "Quantidade de participantes", type: "integer", min: 0, max: 1000000, help: "Preencha após a realização." },
    { name: "notes", label: "Observações / resultados", type: "textarea", max: 6000, wide: true }
  ]
};
```

Em `lib/resources/registry.ts`, importe `caravana` e acrescente-o ao `ALL`. Em `lib/resources/rules.ts`, siga o formato das regras existentes:

```ts
/** Caravana: atividade realizada exige a quantidade de participantes (CHECK da tabela). */
RULES["doutrina-caravana"] = async ({ input }) => {
  if (input.status === "Realizada" && (input.participants === null || input.participants === undefined || input.participants === ""))
    throw new AppError("Informe a quantidade de participantes da atividade realizada.");
};
```

Confira em `rules.ts` como `AppError` é importado e qual é a assinatura exata das outras regras, e copie esse formato.

- [ ] **Step 4: Rodar o teste**

Run: `pnpm vitest run lib/resources/registry.test.ts`
Expected: PASS.

- [ ] **Step 5: Página, ficha impressa e aba**

`app/sistema/doutrina/caravana/page.tsx`:

```tsx
import { ResourceManager } from "@/components/resources/resource-manager";
import { requireModulePage } from "@/lib/page-auth";
import { CaravanaFicha } from "./caravana-ficha";

export default async function CaravanaPage() {
  await requireModulePage("module_doutrina", { department: "doutrina" });
  return (
    <>
      <header className="module-section-head"><div><h2>Caravana no Lar</h2><p>Organize a programação e registre as atividades realizadas pelo Departamento de Doutrina.</p></div><CaravanaFicha /></header>
      <ResourceManager resourceKey="doutrina-caravana" />
    </>
  );
}
```

`caravana-ficha.tsx` ("use client") é o botão **Imprimir ficha**. Ele abre `window.open("", "_blank")` e escreve um HTML A4 retrato com três blocos iguais (`page-break-inside: avoid`). Cada bloco tem o título "Ficha da Caravana do Evangelho no Lar" e as linhas a preencher: Data, Horário, Família / Lar visitado, Endereço, Responsável, Caravaneiros presentes, Leitura / tema, Quantidade de participantes, Observações. Depois chama `print()`. Escape todo texto. "Imprimir lista" é o botão de impressão que o `ResourceManager` já oferece; confira o rótulo dele e, se for diferente, deixe como está.

Em `lib/modules.ts`, acrescente `{ href: "/sistema/doutrina/caravana", label: "Caravana no Lar" }` depois de "Culto no Lar".

Em `lib/reports.ts`, acrescente a fonte da Doutrina (a chave `doutrina` pode ainda não existir; crie-a):

```ts
{ label: "Caravana no Lar", table: "caravana_activities", dateColumn: "activity_date", where: "r.archived_at is null and r.status = 'Realizada'", kind: "atividade", describe: "r.title || coalesce(' — ' || nullif(r.place, ''), '')", responsible: "r.responsible" }
```

- [ ] **Step 6: Aplicar a migração no banco local, verificar e commitar**

Run: `docker exec -i supabase_db_lar-da-bencao psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/migrations/202610150900_caravana_arquivo.sql`
(Se `docker` não estiver no PATH, use `~/.orbstack/bin/docker`.)

Run: `pnpm typecheck && pnpm lint && pnpm vitest run && node scripts/app-shots.mjs 1440 claro /sistema/doutrina/caravana`
Expected: tudo PASS; status 200. Registre uma atividade "Realizada" sem participantes: aparece o erro da regra. Com participantes, ela entra na lista.

```bash
git add supabase/migrations/202610150900_caravana_arquivo.sql lib/resources/defs/doutrina.ts lib/resources/registry.ts lib/resources/rules.ts lib/resources/registry.test.ts app/sistema/doutrina/caravana lib/modules.ts lib/reports.ts
git commit -m "feat: Caravana no Lar no cadastro da Doutrina"
```

### Task 6: Planejamento de Treinamentos

No visual: o título "Planejamento de Treinamentos — Doutrina"; o texto "Organize a formação dos trabalhadores, agende os encontros e acompanhe a realização de cada treinamento."; os controles **Ano**, **⎙ Imprimir planejamento** e **+ Novo treinamento**; o aviso "Use **Agendar datas** para planejar os encontros. Depois do treinamento, clique em **Registrar realização** e informe a data de conclusão e a quantidade de participantes. Esses registros entram no **Relatório Anual da Doutrina**."; os KPIs **Treinamentos no ano**, **A agendar**, **Encontros agendados**, **Treinamentos concluídos** e **Participações registradas**; a seção "Treinamentos do ano" (um cartão por treinamento, com objetivo, público e situação, mais os botões **Agendar datas**, **Registrar realização**, **Editar treinamento**, **+ Nova edição** e **Excluir**, e os campos inline **Data de conclusão \*** e **Quantidade de participantes \*** com o botão **Salvar realização e participantes**); e a seção "Agenda de treinamentos" (filtro **Período**: Ano inteiro ou um mês, e **Baixar agenda (.ics)**). Diálogo do treinamento: **Treinamento \***, **Objetivo**, **Público previsto**, **Responsável / instrutor**, **Local**, **Situação** (Planejado, Em andamento, Concluído, Cancelado) e **Conteúdo, materiais e observações**. Diálogo "Agendar datas": linhas com **Data do encontro N \***, **Início**, **Término** e **Tema / etapa do encontro (opcional)**, mais **+ Adicionar encontro** e **Remover encontro**; o aviso diz que as datas precisam ficar dentro do ano selecionado. Um ano sem treinamentos começa com os 6 do catálogo (`TRAINING_CATALOG`).

**Files:**
- Create: `lib/doutrina-trainings.ts`, `lib/doutrina-trainings.test.ts`
- Create: `app/api/doutrina/treinamentos/route.ts`, `app/api/doutrina/treinamentos/[id]/route.ts`
- Create: `app/sistema/doutrina/treinamentos/page.tsx`, `app/sistema/doutrina/treinamentos/trainings-client.tsx`
- Modify: `lib/modules.ts`, `lib/reports.ts`

**Interfaces:**
- Consumes: `TRAINING_CATALOG`, `TRAINING_STATES`, `validateSessions(sessions, year)` e `isValidIsoDate` (de `lib/doutrina-extras.ts`).
- Produces: `type Training = { id: string; title: string; status: TrainingState; participant_count: number | null; completed_at: string | null; sessions: TrainingSession[] }`; `trainingLabel(t: Training): "A agendar" | "Agendado" | "Em andamento" | "Concluído" | "Cancelado"`; `trainingKpis(list: Training[]): { label: string; value: string }[]`; `toIcs(year: number, list: { title: string; location: string; sessions: TrainingSession[] }[]): string`. API: `GET /api/doutrina/treinamentos?year=` → `{ trainings: (Training & { objective, audience, responsible, location, resources, version })[], canEdit }` (cria o catálogo do ano, se estiver vazio e o usuário puder editar); `POST` cria; `PUT /api/doutrina/treinamentos/[id]` atualiza campos, sessões ou realização (`{ version, ...campos, sessions?, completed_at?, participant_count? }`); `DELETE /api/doutrina/treinamentos/[id]?version=`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, expect, it } from "vitest";
import { toIcs, trainingKpis, trainingLabel, type Training } from "@/lib/doutrina-trainings";

const base: Training = { id: "1", title: "Treinamento para Passista", status: "Planejado", participant_count: null, completed_at: null, sessions: [] };

describe("treinamentos da Doutrina", () => {
  it("planejado sem datas é 'A agendar'; com datas é 'Agendado'", () => {
    expect(trainingLabel(base)).toBe("A agendar");
    expect(trainingLabel({ ...base, sessions: [{ date: "2026-03-07", start: "", end: "", topic: "" }] })).toBe("Agendado");
    expect(trainingLabel({ ...base, status: "Concluído" })).toBe("Concluído");
  });
  it("calcula os cinco indicadores do visual", () => {
    const list: Training[] = [
      base,
      { ...base, id: "2", sessions: [{ date: "2026-03-07", start: "", end: "", topic: "" }, { date: "2026-03-14", start: "", end: "", topic: "" }] },
      { ...base, id: "3", status: "Concluído", participant_count: 18, completed_at: "2026-05-02" }
    ];
    expect(trainingKpis(list)).toEqual([
      { label: "Treinamentos no ano", value: "3" },
      { label: "A agendar", value: "1" },
      { label: "Encontros agendados", value: "2" },
      { label: "Treinamentos concluídos", value: "1" },
      { label: "Participações registradas", value: "18" }
    ]);
  });
  it("gera agenda .ics com um evento por encontro", () => {
    const ics = toIcs(2026, [{ title: "Passista", location: "Salão", sessions: [{ date: "2026-03-07", start: "19:00", end: "21:00", topic: "Módulo 1" }] }]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("DTSTART;TZID=America/Sao_Paulo:20260307T190000");
    expect(ics).toContain("SUMMARY:Passista — Módulo 1");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });
  it("encontro sem horário vira evento de dia inteiro", () => {
    const ics = toIcs(2026, [{ title: "ESE", location: "", sessions: [{ date: "2026-04-04", start: "", end: "", topic: "" }] }]);
    expect(ics).toContain("DTSTART;VALUE=DATE:20260404");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run lib/doutrina-trainings.test.ts`
Expected: FAIL (o módulo ainda não existe).

- [ ] **Step 3: Implementar a parte pura**

```ts
/** Planejamento de Treinamentos (visual v215): situação exibida, KPIs e agenda .ics. Módulo puro. */
import type { TrainingSession, TrainingState } from "@/lib/doutrina-extras";

export type Training = { id: string; title: string; status: TrainingState; participant_count: number | null; completed_at: string | null; sessions: TrainingSession[] };

export function trainingLabel(t: Training) {
  if (t.status === "Planejado") return t.sessions.length ? "Agendado" : "A agendar";
  return t.status;
}

export function trainingKpis(list: Training[]) {
  const done = list.filter((t) => t.status === "Concluído");
  return [
    { label: "Treinamentos no ano", value: String(list.length) },
    { label: "A agendar", value: String(list.filter((t) => trainingLabel(t) === "A agendar").length) },
    { label: "Encontros agendados", value: String(list.reduce((n, t) => n + t.sessions.length, 0)) },
    { label: "Treinamentos concluídos", value: String(done.length) },
    { label: "Participações registradas", value: String(done.reduce((n, t) => n + (t.participant_count ?? 0), 0)) }
  ];
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const compact = (date: string, time = "") => date.replace(/-/g, "") + (time ? `T${time.replace(":", "")}00` : "");

export function toIcs(year: number, list: { title: string; location: string; sessions: TrainingSession[] }[]) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Lar da Bencao//Treinamentos//PT-BR", "CALSCALE:GREGORIAN"];
  list.forEach((t, ti) => t.sessions.forEach((s, si) => {
    lines.push("BEGIN:VEVENT", `UID:treinamento-${year}-${ti}-${si}@lardabencao.org`, `DTSTAMP:${compact(s.date)}T000000Z`);
    if (s.start) {
      lines.push(`DTSTART;TZID=America/Sao_Paulo:${compact(s.date, s.start)}`);
      if (s.end) lines.push(`DTEND;TZID=America/Sao_Paulo:${compact(s.date, s.end)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${compact(s.date)}`);
    }
    lines.push(`SUMMARY:${esc(s.topic ? `${t.title} — ${s.topic}` : t.title)}`);
    if (t.location) lines.push(`LOCATION:${esc(t.location)}`);
    lines.push("END:VEVENT");
  }));
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
```

Confira em `lib/doutrina-extras.ts` os nomes reais dos campos de `TrainingSession`. O início do arquivo mostra `{ date, start, end, topic }`; se forem outros, ajuste o teste e o código juntos.

- [ ] **Step 4: Rodar o teste**

Run: `pnpm vitest run lib/doutrina-trainings.test.ts`
Expected: 4 PASS.

- [ ] **Step 5: API**

`app/api/doutrina/treinamentos/route.ts`, no padrão de `app/api/doutrina/culto/route.ts`:
- `GET`: `requireDoutrina(actor, "read")`. `year` vem de zod (`z.coerce.number().int().min(2020).max(2100)`). Se não houver linha para o ano e `canEditDoutrina(actor)` for verdadeiro, insira os 6 itens de `TRAINING_CATALOG` (`catalog_key`, `title`, `objective`, `audience`, `sort_order` = índice) numa transação, com auditoria "Treinamentos do ano criados". Devolva os treinamentos com `json_agg` das sessões (`order by session_date, start_time`), formatando datas como `YYYY-MM-DD` e horas como `HH24:MI`.
- `POST`: `requireDoutrina(actor, "update")`, `assertSameOrigin`, schema `{ year, title (1..200), objective (≤4000), audience (≤300), responsible (≤300), location (≤300), resources (≤6000), status ∈ TRAINING_STATES }`, insert e auditoria "Inclusão".

`app/api/doutrina/treinamentos/[id]/route.ts`:
- `PUT`: schema com os mesmos campos (todos opcionais), mais `version`, `sessions?: { date, start, end, topic }[]`, `completed_at?: string | null` e `participant_count?: number | null`. Dentro da transação:
  - leia a linha com `for update` e confira a `version` (409 `VERSION_CONFLICT`);
  - se vierem `sessions`, rode `validateSessions(sessions, row.year)`; se ela devolver mensagem, lance `AppError(mensagem)`. Depois apague e reinsira as sessões;
  - se vierem `completed_at` e `participant_count` (a realização), valide `isValidIsoDate(completed_at)`, o ano igual a `row.year` e `participant_count >= 0`, e grave `status = 'Concluído'`;
  - faça `version = version + 1` e registre a auditoria com `before` e `after`.
- `DELETE`: confira a `version`, apague a linha (as sessões caem em cascata) e registre a auditoria "Exclusão".

- [ ] **Step 6: Tela**

`trainings-client.tsx` ("use client") monta tudo o que a descrição do visual lista, nesta ordem: o cabeçalho com Ano, Imprimir e Novo; o aviso; os KPIs (`trainingKpis`); "Treinamentos do ano", um `article.card` por treinamento com título, objetivo, "Público: …", o selo `trainingLabel` e os botões; e "Agenda de treinamentos", com uma tabela `Data | Horário | Treinamento | Tema / etapa | Local` filtrada pelo Período, mais o botão `.ics`, que monta o arquivo com `toIcs` e baixa por `Blob` com `URL.createObjectURL` e nome `treinamentos-<ano>.ics`.

Os diálogos usam `<dialog>` com `showModal()`, como `home-client.tsx` faz com o histórico de versões. "+ Nova edição" abre o diálogo de novo treinamento já preenchido com título, objetivo e público do cartão. "Registrar realização" abre o mesmo diálogo com **Data de conclusão \*** e **Quantidade de participantes \***, e com o aviso "Conte cada pessoa uma vez neste treinamento, mesmo que ela tenha participado de vários encontros. O relatório considera o mês da conclusão." "⎙ Imprimir planejamento" chama `window.print()`; os botões têm `no-print`.

Sem `canEdit`, nenhum botão de edição aparece.

`page.tsx` faz `requireModulePage` e renderiza `<TrainingsClient />`. Em `lib/modules.ts`, acrescente `{ href: "/sistema/doutrina/treinamentos", label: "Planejamento de Treinamentos" }` depois de "Caravana no Lar". Em `lib/reports.ts`, na chave `doutrina`, acrescente `{ label: "Treinamentos realizados", table: "doctrine_trainings", dateColumn: "completed_at", where: "r.status = 'Concluído'", kind: "atividade", describe: "r.title || ' — ' || coalesce(r.participant_count, 0) || ' participante(s)'", responsible: "r.responsible" }`.

- [ ] **Step 7: Verificar e commitar**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run && node scripts/app-shots.mjs 1440 claro /sistema/doutrina/treinamentos`
Expected: tudo PASS; status 200; os 6 treinamentos do catálogo no ano corrente; agendar duas datas, registrar a realização e ver os KPIs mudarem.

```bash
git add lib/doutrina-trainings.ts lib/doutrina-trainings.test.ts app/api/doutrina/treinamentos app/sistema/doutrina/treinamentos lib/modules.ts lib/reports.ts
git commit -m "feat: planejamento de treinamentos da Doutrina"
```

### Task 7: WhatsApp e Relatório Anual da Doutrina

**Files:**
- Create: `app/sistema/doutrina/whatsapp/page.tsx`, `app/sistema/doutrina/relatorio/page.tsx`
- Modify: `lib/modules.ts`, `lib/reports.ts`, `lib/reports.test.ts` (crie, se não existir)

**Interfaces:**
- Consumes: `WhatsappQueue({ scope: "doutrina" })` e `AnnualReport({ department, title })` (Task 1).

- [ ] **Step 1: Escrever o teste que falha**

`lib/reports.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { REPORT_SOURCES } from "@/lib/reports";

describe("fontes do relatório", () => {
  it("a Doutrina tem as frentes do visual", () => {
    expect(REPORT_SOURCES.doutrina.map((s) => s.label)).toEqual([
      "Escalas publicadas", "Culto no Lar", "Caravana no Lar", "Treinamentos realizados", "Frequência das atividades"
    ]);
  });
  it("toda fonte declara se é atividade ou registro", () => {
    for (const sources of Object.values(REPORT_SOURCES)) for (const s of sources) expect(["atividade", "registro"]).toContain(s.kind);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run lib/reports.test.ts`
Expected: FAIL (a lista da Doutrina ainda está incompleta).

- [ ] **Step 3: Completar as fontes da Doutrina, na ordem do teste**

```ts
doutrina: [
  { label: "Escalas publicadas", table: "scale_months", dateColumn: "make_date(r.year, r.month, 1)", where: "r.status = 'published'", kind: "registro", describe: "'Escala de ' || lpad(r.month::text, 2, '0') || '/' || r.year" },
  { label: "Culto no Lar", table: "culto_lar_months", dateColumn: "culto_date", where: "r.deleted_at is null and r.house <> '' and r.leader_id is not null and r.speaker_id is not null", kind: "atividade", describe: "r.house" },
  /* Caravana no Lar (Task 5) */
  /* Treinamentos realizados (Task 6) */
  { label: "Frequência das atividades", table: "attendance_counts", dateColumn: "sheet_date", where: "r.department_key = 'doutrina' and r.value > 0", kind: "registro", describe: "r.value || ' presença(s)'" }
]
```

Confira `scale_months` (colunas `year`, `month`, `status`) e `attendance_counts` (`sheet_date`, `value`, `department_key`) nas migrações. `dateColumn` vira `r.${dateColumn}` na consulta; para a expressão `make_date(...)`, ajuste `departmentReport` para aceitar `dateColumn` que já comece com `make_date(` sem prefixar `r.`, ou crie uma coluna `scale_date` numa view. A opção mais simples: em `departmentReport`, troque `r.${s.dateColumn}` por ``${s.dateColumn.includes("(") ? s.dateColumn : `r.${s.dateColumn}`}``.

- [ ] **Step 4: Rodar o teste**

Run: `pnpm vitest run lib/reports.test.ts`
Expected: 2 PASS.

- [ ] **Step 5: Páginas e abas**

`app/sistema/doutrina/whatsapp/page.tsx` faz `requireModulePage("module_doutrina", { department: "doutrina" })`, confere `isFlagEnabled("module_whatsapp")` (se estiver desligado, mostra `<p className="notice">O envio por WhatsApp está desligado em Módulos e ondas.</p>`) e renderiza `<WhatsappQueue scope="doutrina" />`. `app/sistema/doutrina/relatorio/page.tsx` renderiza `<AnnualReport department="doutrina" title="Dpto de Doutrina" />`. Em `lib/modules.ts`, acrescente as abas "WhatsApp" e "Relatório Anual", nessa ordem, no fim do `doutrinaSubnav`.

- [ ] **Step 6: Verificar e commitar**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run && node scripts/app-shots.mjs 1440 claro /sistema/doutrina/whatsapp /sistema/doutrina/relatorio`
Expected: tudo PASS; status 200; 11 abas na Doutrina, na ordem de `tmp/visual-215-ref/reference.json` (`pages.doutrina.tabs`).

```bash
git add app/sistema/doutrina/whatsapp app/sistema/doutrina/relatorio lib/modules.ts lib/reports.ts lib/reports.test.ts
git commit -m "feat: WhatsApp e relatório anual da Doutrina"
```

---

## Fase 4 — Assistência e Promoção Social

Ordem final das abas (`lib/module-pages.ts`, módulo `assistencia`): Painel, Rancho dos Evangelizandos (`rancho`), Doação de Rancho (`doacao`), Relação de Entrega (`entrega`), Cadastro de Voluntários, Mantenedores da Cesta Básica, Doadores do Café das Crianças, Trabalhadores, Aniversariantes, Relatório Anual, Brechó (`brecho`), Clube de Mães (`clube-maes`), Planejamento Anual, Controle de Atividades. "Kits de Higiene" e "Famílias" saem da barra: Kits fica dentro de Controle de Atividades, e Famílias vira a Doação de Rancho.

### Task 8: Painel da Assistência

Indicadores do visual: **Voluntários do Dpto Social** (com o botão "Consultar voluntários"), **Mantenedores da Cesta Básica** ("Consultar mantenedores"), **Famílias acompanhadas**, **Atendimentos no mês**, **Setores** e **Ações programadas**. Abaixo, a tabela "Setores da Assistência e Promoção Social" (`Setor | Atividade atual | Responsável | Status`) e o aviso "O Departamento Social reúne os setores abaixo e mantém cadastros de voluntários e mantenedores de cestas básicas. As fichas de trabalhadores da Casa seguem para aprovação da Diretoria." O visual escreve "Atividade fictícia atual"; no app, a coluna é "Atividade atual".

**Files:**
- Create: `lib/assistencia-dashboard.ts`, `lib/assistencia-dashboard.test.ts`
- Create: `components/modules/assistencia-painel.tsx` (servidor)
- Modify: `app/sistema/[modulo]/[[...secao]]/page.tsx` (escolhe o Painel por módulo)
- Modify: `lib/module-pages.ts`

**Interfaces:**
- Produces: `sectorRows(areas: readonly string[], activities: { area: string; title: string; responsible: string; status: string; date: string }[]): { sector: string; activity: string; responsible: string; status: string }[]` (para cada área, a atividade mais recente; sem atividade, "—" e "Sem atividade registrada"); `assistenciaKpis(c: { volunteers: number; supporters: number; families: number; monthServices: number; sectors: number; planned: number })`. Em `[modulo]/[[...secao]]/page.tsx`, `panel: "painel"` passa a usar `PAINEIS[page.slug] ?? DepartmentDashboard`, onde `PAINEIS` é um mapa `Record<string, (p: { page: ModulePage }) => Promise<JSX.Element>>` declarado em `components/modules/paineis.tsx`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, expect, it } from "vitest";
import { assistenciaKpis, sectorRows } from "@/lib/assistencia-dashboard";

describe("Painel da Assistência", () => {
  it("mostra a atividade mais recente de cada setor", () => {
    const rows = sectorRows(["Brechó", "Clube de Mães"], [
      { area: "Brechó", title: "Bazar", responsible: "Simone", status: "Realizada", date: "2026-09-01" },
      { area: "Brechó", title: "Campanha de primavera", responsible: "Simone", status: "Planejada", date: "2026-10-01" }
    ]);
    expect(rows).toEqual([
      { sector: "Brechó", activity: "Campanha de primavera", responsible: "Simone", status: "Planejada" },
      { sector: "Clube de Mães", activity: "—", responsible: "—", status: "Sem atividade registrada" }
    ]);
  });
  it("indicadores na ordem do visual", () => {
    expect(assistenciaKpis({ volunteers: 3, supporters: 2, families: 36, monthServices: 74, sectors: 5, planned: 9 }).map((k) => k.label)).toEqual([
      "Voluntários do Dpto Social", "Mantenedores da Cesta Básica", "Famílias acompanhadas", "Atendimentos no mês", "Setores", "Ações programadas"
    ]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run lib/assistencia-dashboard.test.ts`
Expected: FAIL (o módulo ainda não existe).

- [ ] **Step 3: Implementar**

```ts
/** Painel da Assistência e Promoção Social (visual v215). Módulo puro. */
export function sectorRows(areas: readonly string[], activities: { area: string; title: string; responsible: string; status: string; date: string }[]) {
  return areas.map((sector) => {
    const latest = activities.filter((a) => a.area === sector).sort((a, b) => b.date.localeCompare(a.date))[0];
    return latest
      ? { sector, activity: latest.title, responsible: latest.responsible || "—", status: latest.status }
      : { sector, activity: "—", responsible: "—", status: "Sem atividade registrada" };
  });
}

export function assistenciaKpis(c: { volunteers: number; supporters: number; families: number; monthServices: number; sectors: number; planned: number }) {
  return [
    { label: "Voluntários do Dpto Social", value: String(c.volunteers), href: "/sistema/assistencia/voluntarios", action: "Consultar voluntários" },
    { label: "Mantenedores da Cesta Básica", value: String(c.supporters), href: "/sistema/assistencia/mantenedores", action: "Consultar mantenedores" },
    { label: "Famílias acompanhadas", value: String(c.families) },
    { label: "Atendimentos no mês", value: String(c.monthServices) },
    { label: "Setores", value: String(c.sectors) },
    { label: "Ações programadas", value: String(c.planned) }
  ];
}
```

O teste compara só `label`, então os campos extras não o quebram.

- [ ] **Step 4: Rodar o teste**

Run: `pnpm vitest run lib/assistencia-dashboard.test.ts`
Expected: 2 PASS.

- [ ] **Step 5: Painel no servidor**

`components/modules/paineis.tsx` exporta `PAINEIS = { assistencia: AssistenciaPainel }`. Nas tasks seguintes entram tesouraria, conselhofiscal, presidencia, secretaria, patrimonio, eventos, divulgacao e juridico.

`AssistenciaPainel` é async. Ele renderiza `DepartmentAbout` (com os líderes da Task 2), os KPIs e a tabela. As consultas:
- voluntários: `social_volunteers` com `archived_at is null and status = 'Disponível'`;
- mantenedores: `social_basket_supporters` com `status = 'Colaborando'`;
- famílias: `social_families` com `status = 'Em acompanhamento'`, somadas às famílias de rancho aprovadas da Task 9, quando ela existir (até lá, só `social_families`);
- atendimentos no mês: entregas de rancho "Entregue" e kits "Realizada" do mês, mais atividades "Realizada" do mês;
- setores: `SOCIAL_AREAS.length`;
- ações programadas: `social_planning` com `status in ('Planejada','Em andamento')` no ano corrente;
- tabela de setores: `social_activities` (`area`, `title`, `responsible`, `status` e `coalesce(effective_date, planned_date)` como `date`).

Confira os nomes reais das tabelas e colunas em `lib/resources/defs/assistencia.ts` (campo `table` de cada definição) e na migração `202609171700_onda2_assistencia.sql`.

Em `[modulo]/[[...secao]]/page.tsx`, troque `<DepartmentDashboard page={page} />` por `{(() => { const Painel = PAINEIS[page.slug] ?? DepartmentDashboard; return <Painel page={page} />; })()}`.

- [ ] **Step 6: Verificar e commitar**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run && node scripts/app-shots.mjs 1440 claro /sistema/assistencia`
Expected: tudo PASS; status 200; seis indicadores e a tabela de setores, como em `tmp/visual-215-ref/assistencia__social-painel.png`.

```bash
git add lib/assistencia-dashboard.ts lib/assistencia-dashboard.test.ts components/modules/assistencia-painel.tsx components/modules/paineis.tsx "app/sistema/[modulo]/[[...secao]]/page.tsx"
git commit -m "feat: painel da Assistência com os indicadores do visual v215"
```

### Task 9: Rancho dos Evangelizandos

Regras do visual (`syncRanchoFamilies`, `familyAttendanceForMonth`, `releaseRanchoFamily` no HTML):
- A família é o **responsável** do evangelizando (`guardian_name`), comparado sem diferença de maiúsculas, acentos ou espaços extras. Só entram responsáveis que tenham ao menos um evangelizando ativo com `rancho_requested = true`. "1 família = 1 rancho".
- Situação de aprovação: Pendente, Aprovado ou Rejeitado. É decisão exclusiva da Assistência.
- A frequência do mês usa os domingos do mês, conta P e F em `evangelizando_attendance` e calcula `pct = round(P / (P+F) × 100)` para cada evangelizando. A família fica **apta** quando todos os evangelizandos têm chamada registrada no mês **e** cada um tem `pct >= mínimo`. O mínimo padrão é 75%, ajustável de 1 a 100 ("Alterar frequência mínima"). O painel mostra a média (dos que têm chamada) e a menor frequência.
- Liberar: só para família Aprovada e no máximo 1 por mês. Se a família não estiver apta, o botão vira "Liberar mesmo abaixo de N%", a liberação fica marcada como exceção ("1 rancho liberado por exceção de frequência") e **não** exige justificativa.
- Registrar entrega: confirma a data e a quantidade efetivamente entregue de uma liberação.
- KPIs: **Famílias solicitantes**, **Evangelizandos vinculados**, **Famílias aptas no mês** (aprovadas e aptas) e **Ranchos liberados no mês**.
- Tabela: `Responsável / Família | Qtd. | Evangelizandos vinculados | % Frequência | Solicitação | Aprovação Social | Rancho do mês | Ações`. Botão de impressão: "⎙ Frequência / Rancho".

**Files:**
- Create: `supabase/migrations/202610151000_rancho_familias.sql`
- Create: `lib/rancho.ts`, `lib/rancho.test.ts`
- Create: `app/api/assistencia/rancho/route.ts`
- Create: `components/modules/assistencia-rancho.tsx`
- Modify: `lib/module-pages.ts`, `components/modules/panels.tsx`

**Interfaces:**
- Produces: `normalizeGuardian(name: string): string`; `sundaysOf(ym: string): string[]`; `familyAttendance(children: { id: string; name: string; marks: Record<string, "P" | "F"> }[], sundays: string[], minimum: number): { count: number; avgPct: number; minPct: number; allRecorded: boolean; eligible: boolean; children: { id: string; name: string; p: number; f: number; pct: number; total: number }[] }`; `releaseLabel(f: { approval: "Pendente" | "Aprovado" | "Rejeitado"; released: boolean; eligible: boolean }, minimum: number): string`. Tabelas `app.social_rancho_families(id, guardian_key unique, guardian_name, approval_status, decided_at, decided_by, version, …)`, `app.social_rancho_releases(id, family_id, reference_month, below_standard, released_at, released_by, delivered_on, quantity, unique(family_id, reference_month))` e `app.social_settings(id boolean pk, rancho_min_frequency int default 75)`. A API `GET /api/assistencia/rancho?month=AAAA-MM` devolve `{ minimum, kpis, families: […], canEdit }`; o `POST` aceita `{ action: "approve" | "reject" | "release" | "deliver" | "minimum", … }`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, expect, it } from "vitest";
import { familyAttendance, normalizeGuardian, releaseLabel, sundaysOf } from "@/lib/rancho";

describe("família do rancho", () => {
  it("normaliza o nome do responsável (maiúsculas, acentos e espaços)", () => {
    expect(normalizeGuardian("  Maria  da  Silva ")).toBe(normalizeGuardian("maria da silva"));
    expect(normalizeGuardian("Conceição")).toBe("conceicao");
  });
  it("lista os domingos do mês", () => {
    expect(sundaysOf("2026-03")).toEqual(["2026-03-01", "2026-03-08", "2026-03-15", "2026-03-22", "2026-03-29"]);
  });
});

describe("frequência da família", () => {
  const sundays = ["2026-03-01", "2026-03-08", "2026-03-15", "2026-03-22"];
  it("apta quando todos têm chamada e cada um atinge o mínimo", () => {
    const r = familyAttendance([
      { id: "a", name: "Ana", marks: { "2026-03-01": "P", "2026-03-08": "P", "2026-03-15": "P", "2026-03-22": "F" } },
      { id: "b", name: "Beto", marks: { "2026-03-01": "P", "2026-03-08": "P", "2026-03-15": "P", "2026-03-22": "P" } }
    ], sundays, 75);
    expect(r).toMatchObject({ count: 2, allRecorded: true, eligible: true, minPct: 75, avgPct: 88 });
  });
  it("não fica apta se um evangelizando não tem chamada no mês", () => {
    const r = familyAttendance([
      { id: "a", name: "Ana", marks: { "2026-03-01": "P" } },
      { id: "b", name: "Beto", marks: {} }
    ], sundays, 75);
    expect(r.allRecorded).toBe(false);
    expect(r.eligible).toBe(false);
  });
  it("não fica apta se um evangelizando fica abaixo do mínimo", () => {
    const r = familyAttendance([{ id: "a", name: "Ana", marks: { "2026-03-01": "P", "2026-03-08": "F", "2026-03-15": "F", "2026-03-22": "F" } }], sundays, 75);
    expect(r.children[0].pct).toBe(25);
    expect(r.eligible).toBe(false);
  });
  it("ignora marcas fora dos domingos do mês", () => {
    const r = familyAttendance([{ id: "a", name: "Ana", marks: { "2026-02-22": "F", "2026-03-01": "P" } }], sundays, 75);
    expect(r.children[0]).toMatchObject({ p: 1, f: 0, pct: 100 });
  });
});

describe("botão de liberação", () => {
  it("segue os textos do visual", () => {
    expect(releaseLabel({ approval: "Pendente", released: false, eligible: true }, 75)).toBe("Aguardando aprovação");
    expect(releaseLabel({ approval: "Aprovado", released: false, eligible: true }, 75)).toBe("Liberar 1 rancho");
    expect(releaseLabel({ approval: "Aprovado", released: false, eligible: false }, 80)).toBe("Liberar mesmo abaixo de 80%");
    expect(releaseLabel({ approval: "Aprovado", released: true, eligible: true }, 75)).toBe("Rancho já liberado");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run lib/rancho.test.ts`
Expected: FAIL (o módulo ainda não existe).

- [ ] **Step 3: Implementar a parte pura**

```ts
/** Rancho dos Evangelizandos (visual v215): família pelo responsável e frequência mínima. Módulo puro. */
export function normalizeGuardian(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function sundaysOf(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const out: string[] = [];
  for (let d = 1; d <= 31; d += 1) {
    const date = new Date(Date.UTC(y, m - 1, d));
    if (date.getUTCMonth() !== m - 1) break;
    if (date.getUTCDay() === 0) out.push(date.toISOString().slice(0, 10));
  }
  return out;
}

export function familyAttendance(children: { id: string; name: string; marks: Record<string, "P" | "F"> }[], sundays: string[], minimum: number) {
  const rows = children.map((c) => {
    const p = sundays.filter((d) => c.marks[d] === "P").length;
    const f = sundays.filter((d) => c.marks[d] === "F").length;
    const total = p + f;
    return { id: c.id, name: c.name, p, f, total, pct: total ? Math.round((p / total) * 100) : 0 };
  });
  const recorded = rows.filter((r) => r.total > 0);
  const allRecorded = rows.length > 0 && recorded.length === rows.length;
  return {
    count: rows.length,
    children: rows,
    allRecorded,
    eligible: allRecorded && rows.every((r) => r.pct >= minimum),
    minPct: recorded.length ? Math.min(...recorded.map((r) => r.pct)) : 0,
    avgPct: recorded.length ? Math.round(recorded.reduce((n, r) => n + r.pct, 0) / recorded.length) : 0
  };
}

export function releaseLabel(f: { approval: "Pendente" | "Aprovado" | "Rejeitado"; released: boolean; eligible: boolean }, minimum: number) {
  if (f.released) return "Rancho já liberado";
  if (f.approval !== "Aprovado") return "Aguardando aprovação";
  return f.eligible ? "Liberar 1 rancho" : `Liberar mesmo abaixo de ${minimum}%`;
}
```

- [ ] **Step 4: Rodar o teste**

Run: `pnpm vitest run lib/rancho.test.ts`
Expected: 7 PASS.

- [ ] **Step 5: Migração**

```sql
begin;
-- Rancho dos Evangelizandos: decisão da Assistência por família (responsável) e liberação mensal.
create table if not exists app.social_rancho_families (
  id uuid primary key default gen_random_uuid(),
  guardian_key text not null unique check (char_length(guardian_key) between 1 and 200),
  guardian_name text not null check (char_length(guardian_name) between 1 and 200),
  approval_status text not null default 'Pendente' check (approval_status in ('Pendente','Aprovado','Rejeitado')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references app.users(id),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists app.social_rancho_releases (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references app.social_rancho_families(id) on delete cascade,
  reference_month text not null check (reference_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  below_standard boolean not null default false,
  released_at timestamptz not null default now(),
  released_by uuid references app.users(id),
  delivered_on date,
  quantity integer check (quantity is null or quantity between 0 and 20),
  unique (family_id, reference_month)
);
create table if not exists app.social_settings (
  id boolean primary key default true check (id),
  rancho_min_frequency integer not null default 75 check (rancho_min_frequency between 1 and 100),
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users(id)
);
insert into app.social_settings (id) values (true) on conflict (id) do nothing;
grant select, insert, update on app.social_rancho_families, app.social_rancho_releases to lar_app;
grant select, update on app.social_settings to lar_app;
commit;
```

- [ ] **Step 6: API**

`app/api/assistencia/rancho/route.ts`. Permissão: `assertPermission(actor, "department", "read" | "update", "assistencia_social")`.

O GET, para o mês pedido:
1. lê os evangelizandos ativos de infância e juventude com `guardian_name`, `rancho_requested`, `department_key` e `class_group` (confira os nomes das colunas em `lib/education-data.ts`, linha 53);
2. agrupa por `normalizeGuardian(guardian_name)` e mantém só os grupos com algum `rancho_requested`;
3. faz upsert das famílias novas em `social_rancho_families` (`insert … on conflict (guardian_key) do update set guardian_name = excluded.guardian_name`);
4. lê as marcas do mês (`evangelizando_attendance` com `class_date between primeiro and último domingo`);
5. calcula `familyAttendance` com o mínimo de `social_settings`;
6. junta a liberação do mês;
7. devolve as famílias em ordem alfabética, com os KPIs: solicitantes = famílias; vinculados = soma de `count`; aptas = aprovadas e aptas; liberados = liberações do mês.

O POST, sempre em transação com auditoria (módulo "Assistência e Promoção Social", seção "Rancho dos Evangelizandos"):
- `approve` e `reject` (`{ familyId, version }`) gravam a situação, `decided_at` e `decided_by`, com `version + 1`;
- `release` (`{ familyId, month }`) recusa se a família não estiver Aprovada ("A família precisa ser aprovada pelo Dpto de Assistência e Promoção Social antes da liberação.") ou se já houver liberação no mês ("Já existe rancho liberado para esta família nesta competência."). Ela recalcula `eligible` no servidor e grava `below_standard = !eligible`;
- `deliver` (`{ releaseId, delivered_on, quantity }`) exige data válida, que não esteja no futuro, e quantidade de 1 a 20;
- `minimum` (`{ value }`) exige um inteiro de 1 a 100, e só quem tem `update`.

- [ ] **Step 7: Tela**

`components/modules/assistencia-rancho.tsx` ("use client") tem:
- o título "Rancho Familiar — Evangelizandos da Infância e Juventude" e o subtítulo do visual;
- os controles Mês, "⎙ Frequência / Rancho" (`window.print()`) e "Alterar frequência mínima" (`window.prompt` com o valor atual, validado de 1 a 100);
- o aviso "Decisão exclusiva do Dpto Social…", com o mínimo atual;
- os 4 KPIs e a tabela com as 8 colunas do visual. Em "% Frequência": a média da família, "Menor frequência: N%" e, por evangelizando, "N% (P x / F y)" ou "sem chamada registrada", com o selo "Atingiu N%" ou "Abaixo de N% / pendente". Em "Solicitação": o selo "Solicitado" e a data. Em "Aprovação Social": o selo da situação. Em "Rancho do mês": "1 rancho liberado" ou "1 rancho liberado por exceção de frequência" com a data, "Aguardando aprovação", "Apto para liberar" ou "Abaixo de N% — decisão do Dpto Social". Em "Ações": Aprovar/Aprovado, Rejeitar/Rejeitado, o botão de liberação (`releaseLabel`) e "Registrar entrega", que aparece só quando há liberação sem entrega e abre um `<dialog>` com a data e a quantidade, esta com padrão 1;
- o rodapé "O agrupamento familiar é feito automaticamente pelo nome do responsável, desconsiderando diferenças de maiúsculas/minúsculas, acentos e espaços excedentes."

No `ModulePanel`, o caso `"assistencia-rancho"` devolve `<RanchoPanel />`. Em `lib/module-pages.ts`, a aba `{ slug: "rancho", label: "Rancho dos Evangelizandos", panel: "assistencia-rancho" }` substitui a de cadastro `assistencia-rancho`. O cadastro de entregas `assistencia-rancho` continua sendo usado pela Doação de Rancho (Task 10).

- [ ] **Step 8: Verificar e commitar**

Aplique a migração no banco local, como na Task 5. Cadastre dois evangelizandos com o mesmo responsável grafado diferente, ambos com rancho solicitado, e lance a chamada de março pelo app.

Run: `pnpm typecheck && pnpm lint && pnpm vitest run && node scripts/app-shots.mjs 1440 claro /sistema/assistencia/rancho`
Expected: tudo PASS; uma família com Qtd. 2; Aprovar, depois Liberar e depois Registrar entrega funcionam; uma segunda liberação no mesmo mês é recusada.

```bash
git add supabase/migrations/202610151000_rancho_familias.sql lib/rancho.ts lib/rancho.test.ts app/api/assistencia/rancho components/modules/assistencia-rancho.tsx components/modules/panels.tsx lib/module-pages.ts
git commit -m "feat: rancho dos evangelizandos com frequência mínima e liberação mensal"
```

### Task 10: Doação de Rancho (famílias sem evangelizando)

No visual: "Cadastro e controle das famílias atendidas diretamente pelo Dpto de Assistência e Promoção Social."; o aviso "Uso desta ficha: destinada às famílias que não possuem evangelizando vinculado aos Departamentos da Infância ou Juventude. O Dpto Social realiza o cadastro, analisa a situação e decide pela aprovação e doação."; os KPIs **Famílias cadastradas**, **Aguardando análise**, **Famílias aprovadas** e **Ranchos doados no mês**; a tabela `Responsável / Família | Contato | Composição familiar | Necessidade | Situação Social | Rancho do mês | Ações`; e as ações **Cadastrar família**, Aprovar, Rejeitar, **Registrar doação / entrega**, **Editar ficha**, **⎙ Ficha**, **Excluir ficha** e **⎙ Relação**.

**Files:**
- Create: `supabase/migrations/202610151100_familias_aprovacao.sql`
- Modify: `lib/resources/defs/assistencia.ts` (`socialFamilies`)
- Create: `components/modules/assistencia-doacao.tsx`
- Modify: `components/modules/panels.tsx`, `lib/module-pages.ts`, `lib/resources/registry.test.ts`

**Interfaces:**
- Consumes: os recursos `assistencia-familias` e `assistencia-rancho` (entregas, com `family_id`).
- Produces: as colunas `social_families.composition`, `social_families.need` e `social_families.approval_status` ('Aguardando análise', 'Aprovado', 'Rejeitado'); o painel `assistencia-doacao`.

- [ ] **Step 1: Escrever o teste que falha**

Em `lib/resources/registry.test.ts`:

```ts
describe("Doação de Rancho", () => {
  it("a ficha da família tem composição, necessidade e análise social", () => {
    const fields = RESOURCES["assistencia-familias"].fields;
    expect(fields.find((f) => f.name === "composition")).toMatchObject({ label: "Composição familiar", type: "textarea" });
    expect(fields.find((f) => f.name === "need")).toMatchObject({ label: "Necessidade", type: "textarea" });
    expect(fields.find((f) => f.name === "approval_status")).toMatchObject({ label: "Situação Social", type: "select", options: ["Aguardando análise", "Aprovado", "Rejeitado"] });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run lib/resources/registry.test.ts`
Expected: FAIL (os campos ainda não existem).

- [ ] **Step 3: Migração e campos**

```sql
begin;
alter table app.social_families
  add column if not exists composition text not null default '' check (char_length(composition) <= 1000),
  add column if not exists need text not null default '' check (char_length(need) <= 1000),
  add column if not exists approval_status text not null default 'Aguardando análise'
    check (approval_status in ('Aguardando análise','Aprovado','Rejeitado'));
commit;
```

Em `socialFamilies.fields`, acrescente depois de `people_count`:

```ts
{ name: "composition", label: "Composição familiar", type: "textarea", max: 1000, wide: true },
{ name: "need", label: "Necessidade", type: "textarea", max: 1000, wide: true },
{ name: "approval_status", label: "Situação Social", type: "select", options: ["Aguardando análise", "Aprovado", "Rejeitado"], required: true },
```

e troque `title` para "Doação de Rancho — famílias" e `intro` para o aviso do visual.

- [ ] **Step 4: Rodar o teste**

Run: `pnpm vitest run lib/resources/registry.test.ts`
Expected: PASS.

- [ ] **Step 5: Painel**

`components/modules/assistencia-doacao.tsx` ("use client") traz:
1. o campo Mês, com padrão no mês atual;
2. os 4 KPIs, calculados com `GET /api/r/assistencia-familias` e `GET /api/r/assistencia-rancho?reference_month=<mês>` (confira em `app/api/r/[resource]/route.ts` como passar filtros; se `reference_month` não for filtro aceito, acrescente `{ name: "reference_month", label: "Mês de referência" }` aos `filters` de `ranchoDeliveries`);
3. `<ResourceManager resourceKey="assistencia-familias" extraColumns={[{ label: "Rancho do mês", render: (row) => … }]} rowActions={(row, reload) => …} />`.

As `rowActions`:
- "Aprovar" e "Rejeitar" usam o PUT do motor (`PUT /api/r/assistencia-familias/<id>` com `{ version, approval_status }`; confira o formato em `lib/resources/server.ts`, `updateRecord`, e mande todos os campos que o update exige);
- "Registrar doação / entrega" aparece só se a família estiver Aprovada e não houver entrega no mês. Ela faz `POST /api/r/assistencia-rancho` com `{ family_id, reference_month, delivery_date: hoje, status: "Entregue", baskets: 1 }`;
- "⎙ Ficha" abre a impressão da ficha da família (nome, contato, composição, necessidade, situação e entregas), no mesmo estilo de janela de impressão da Task 5.

"⎙ Relação" imprime a tabela com a coluna "Assinatura".

No `ModulePanel`, o caso `"assistencia-doacao"` devolve `<DoacaoPanel />`. Em `lib/module-pages.ts`, acrescente `{ slug: "doacao", label: "Doação de Rancho", panel: "assistencia-doacao" }` depois de Rancho e remova a aba `familias`.

- [ ] **Step 6: Verificar e commitar**

Aplique a migração no banco local.

Run: `pnpm typecheck && pnpm lint && pnpm vitest run && node scripts/app-shots.mjs 1440 claro /sistema/assistencia/doacao`
Expected: tudo PASS; cadastrar, aprovar e registrar a doação funcionam, e "Ranchos doados no mês" sobe para 1.

```bash
git add supabase/migrations/202610151100_familias_aprovacao.sql lib/resources/defs/assistencia.ts lib/resources/registry.test.ts components/modules/assistencia-doacao.tsx components/modules/panels.tsx lib/module-pages.ts
git commit -m "feat: doação de rancho com análise social da família"
```

### Task 11: Relação de Entrega

No visual: "Consolida, em uma única relação, os ranchos liberados para famílias vinculadas aos evangelizandos e as doações realizadas para famílias cadastradas diretamente pela Assistência Social."; os KPIs **Famílias na relação**, **Rancho dos Evangelizandos**, **Doação direta do Social** e **Total de ranchos**; a tabela `Nº | Responsável / Família | Origem do atendimento | Vinculados / composição | Data da liberação | Qtd. | Assinatura do responsável`, em ordem alfabética, com a coluna de assinatura em branco; e o botão "⎙ Relação de Entrega".

**Files:**
- Create: `lib/delivery-list.ts`, `lib/delivery-list.test.ts`
- Create: `app/api/assistencia/entregas/route.ts`
- Create: `components/modules/assistencia-entrega.tsx`
- Modify: `components/modules/panels.tsx`, `lib/module-pages.ts`

**Interfaces:**
- Produces: `buildDeliveryList(evangelizandos: { name: string; children: string[]; date: string; quantity: number }[], direct: { name: string; composition: string; date: string; quantity: number }[]): { rows: { n: number; name: string; origin: "Rancho dos Evangelizandos" | "Doação direta do Social"; detail: string; date: string; quantity: number }[]; kpis: { families: number; evangelizandos: number; direct: number; total: number } }`. A API `GET /api/assistencia/entregas?month=` devolve as duas listas já buscadas: as liberações do mês em `social_rancho_releases`, com os evangelizandos da família, e as entregas "Entregue" do mês em `social_rancho_deliveries`, com a família.

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, expect, it } from "vitest";
import { buildDeliveryList } from "@/lib/delivery-list";

describe("relação de entrega", () => {
  it("junta as duas origens em ordem alfabética, numera e soma", () => {
    const r = buildDeliveryList(
      [{ name: "Maria Souza", children: ["Ana", "Beto"], date: "2026-03-10", quantity: 1 }],
      [{ name: "Ângela Lima", composition: "4 pessoas", date: "2026-03-12", quantity: 2 }]
    );
    expect(r.rows.map((x) => [x.n, x.name, x.origin, x.detail])).toEqual([
      [1, "Ângela Lima", "Doação direta do Social", "4 pessoas"],
      [2, "Maria Souza", "Rancho dos Evangelizandos", "Ana, Beto"]
    ]);
    expect(r.kpis).toEqual({ families: 2, evangelizandos: 1, direct: 1, total: 3 });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run lib/delivery-list.test.ts`
Expected: FAIL (o módulo ainda não existe).

- [ ] **Step 3: Implementar**

```ts
/** Relação de Entrega do rancho (duas origens). Módulo puro. */
export function buildDeliveryList(
  evangelizandos: { name: string; children: string[]; date: string; quantity: number }[],
  direct: { name: string; composition: string; date: string; quantity: number }[]
) {
  const all = [
    ...evangelizandos.map((e) => ({ name: e.name, origin: "Rancho dos Evangelizandos" as const, detail: e.children.join(", "), date: e.date, quantity: e.quantity })),
    ...direct.map((d) => ({ name: d.name, origin: "Doação direta do Social" as const, detail: d.composition || "—", date: d.date, quantity: d.quantity }))
  ].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return {
    rows: all.map((row, i) => ({ n: i + 1, ...row })),
    kpis: {
      families: all.length,
      evangelizandos: evangelizandos.length,
      direct: direct.length,
      total: all.reduce((n, r) => n + r.quantity, 0)
    }
  };
}
```

- [ ] **Step 4: Rodar o teste**

Run: `pnpm vitest run lib/delivery-list.test.ts`
Expected: PASS.

- [ ] **Step 5: API, painel e aba**

A API é só de leitura: `assertPermission(actor, "department", "read", "assistencia_social")`. A quantidade de evangelizandos vem de `social_rancho_releases.quantity` (ou 1, se nula). A data é `delivered_on` ou `released_at::date`. O painel traz o Mês, os KPIs, a tabela (a coluna de assinatura tem `style={{ minWidth: 220 }}` e fica vazia) e "⎙ Relação de Entrega" (`window.print()`). No `ModulePanel`, o caso `"assistencia-entrega"`. Em `module-pages`, a aba `{ slug: "entrega", label: "Relação de Entrega", panel: "assistencia-entrega" }` entra depois da Doação.

- [ ] **Step 6: Verificar e commitar**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run && node scripts/app-shots.mjs 1440 claro /sistema/assistencia/entrega`
Expected: tudo PASS; a relação mostra a família da Task 9 e a da Task 10.

```bash
git add lib/delivery-list.ts lib/delivery-list.test.ts app/api/assistencia/entregas components/modules/assistencia-entrega.tsx components/modules/panels.tsx lib/module-pages.ts
git commit -m "feat: relação de entrega do rancho com as duas origens"
```

### Task 12: Clube de Mães numa aba, com estoque de enxoval

No visual, a aba "Clube de Mães" tem o texto "Cadastro das pessoas atendidas, enxovais, entregas e movimentação do caixa." e quatro sub-abas:
- **Livro caixa**, como hoje: `Data | Descrição / categoria | Quantidade | Entrada | Saída | Saldo | Pagamento | Ações`, com o saldo anterior transportado entre os meses;
- **Cadastros**: a ficha com nome, nascimento, telefone, documento, endereço, bebê, previsão de parto, nascimento do bebê, data do cadastro, situação e observações;
- **Relação de enxoval**: os itens com unidade e saldo, mais o "Histórico de entradas";
- **Entregas**: pessoa, data, quem recebeu, itens com quantidade e unidade, responsável, observações e devolução integral com data e motivo.

Impressões: ficha da pessoa (retrato, com o histórico de entregas e assinatura), comprovante de entrega (retrato, com duas assinaturas) e as listas (paisagem).

**Files:**
- Create: `supabase/migrations/202610151200_clube_maes_enxoval.sql`
- Create: `lib/enxoval.ts`, `lib/enxoval.test.ts`
- Create: `app/api/assistencia/enxoval/route.ts`
- Modify: `lib/resources/defs/assistencia.ts` (`clubPeople` com os campos do bebê; `clubDeliveries` com `receiver`)
- Create: `components/modules/clube-maes.tsx`
- Modify: `components/modules/panels.tsx`, `lib/module-pages.ts`

**Interfaces:**
- Produces: as tabelas `app.club_items(id, name unique, unit, archived_at, …)`, `app.club_item_entries(id, item_id, entry_date, quantity, source, notes, created_by)` e `app.club_delivery_lines(delivery_id, item_id, quantity)`; as colunas `club_deliveries.receiver`, `returned_at`, `return_reason` e `returned_by`; e as colunas de `club_people` `baby_name`, `due_date`, `baby_birth`, `document` e `address`. `itemBalances(items, entries, lines, returnedDeliveryIds): { item_id: string; name: string; unit: string; entradas: number; saidas: number; saldo: number }[]`; `assertStock(balances, requested: { item_id: string; quantity: number }[])` lança "Estoque insuficiente de <item>: saldo N." A API `POST /api/assistencia/enxoval` aceita `{ action: "item" | "entry" | "deliver" | "return", … }` (a entrega grava a linha de `club_deliveries` e as `club_delivery_lines` numa transação, depois de `assertStock`), e `GET` devolve `{ items, entries, balances }`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, expect, it } from "vitest";
import { assertStock, itemBalances } from "@/lib/enxoval";

const items = [{ id: "fr", name: "Fralda", unit: "pacote" }, { id: "bo", name: "Body", unit: "unidade" }];
const entries = [{ item_id: "fr", quantity: 10 }, { item_id: "bo", quantity: 5 }, { item_id: "fr", quantity: 2 }];
const lines = [{ delivery_id: "d1", item_id: "fr", quantity: 4 }, { delivery_id: "d2", item_id: "fr", quantity: 3 }];

describe("estoque de enxoval", () => {
  it("saldo = entradas − saídas, e a devolução integral devolve ao estoque", () => {
    expect(itemBalances(items, entries, lines, new Set(["d2"]))).toEqual([
      { item_id: "fr", name: "Fralda", unit: "pacote", entradas: 12, saidas: 4, saldo: 8 },
      { item_id: "bo", name: "Body", unit: "unidade", entradas: 5, saidas: 0, saldo: 5 }
    ]);
  });
  it("recusa entrega maior que o saldo", () => {
    const balances = itemBalances(items, entries, lines, new Set());
    expect(() => assertStock(balances, [{ item_id: "fr", quantity: 6 }])).toThrow("Estoque insuficiente de Fralda: saldo 5.");
    expect(() => assertStock(balances, [{ item_id: "fr", quantity: 5 }])).not.toThrow();
  });
  it("soma linhas repetidas do mesmo item antes de conferir", () => {
    const balances = itemBalances(items, entries, [], new Set());
    expect(() => assertStock(balances, [{ item_id: "bo", quantity: 3 }, { item_id: "bo", quantity: 3 }])).toThrow("Body");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run lib/enxoval.test.ts`
Expected: FAIL (o módulo ainda não existe).

- [ ] **Step 3: Implementar**

```ts
/** Estoque de enxoval do Clube de Mães. Módulo puro. */
import { AppError } from "@/lib/errors";

type Item = { id: string; name: string; unit: string };

export function itemBalances(items: Item[], entries: { item_id: string; quantity: number }[], lines: { delivery_id: string; item_id: string; quantity: number }[], returned: Set<string>) {
  return items.map((item) => {
    const entradas = entries.filter((e) => e.item_id === item.id).reduce((n, e) => n + e.quantity, 0);
    const saidas = lines.filter((l) => l.item_id === item.id && !returned.has(l.delivery_id)).reduce((n, l) => n + l.quantity, 0);
    return { item_id: item.id, name: item.name, unit: item.unit, entradas, saidas, saldo: entradas - saidas };
  });
}

export function assertStock(balances: ReturnType<typeof itemBalances>, requested: { item_id: string; quantity: number }[]) {
  const totals = new Map<string, number>();
  for (const r of requested) totals.set(r.item_id, (totals.get(r.item_id) ?? 0) + r.quantity);
  for (const [itemId, quantity] of totals) {
    const b = balances.find((x) => x.item_id === itemId);
    if (!b) throw new AppError("Item de enxoval não encontrado.");
    if (quantity > b.saldo) throw new AppError(`Estoque insuficiente de ${b.name}: saldo ${b.saldo}.`);
  }
}
```

- [ ] **Step 4: Rodar o teste**

Run: `pnpm vitest run lib/enxoval.test.ts`
Expected: 3 PASS.

- [ ] **Step 5: Migração**

Crie as três tabelas e as colunas novas, com os mesmos padrões de `202609171700_onda2_assistencia.sql`: os CHECKs de tamanho, `quantity > 0`, `on delete restrict` em `item_id` e os `grant`s. A tabela `club_items` usa o motor de cadastros (precisa das colunas de arquivo e versão). Não apague a coluna de texto `club_deliveries.items`: ela continua guardando as entregas antigas e passa a ser opcional (`alter column items drop not null`, se ela for `not null`).

- [ ] **Step 6: API e tela**

A API segue o padrão das outras e usa a permissão `social_clube_maes` (`hasPermission(actor, "social_clube_maes", "read" | "update")`). Na entrega, tudo acontece numa transação: `select … for update` nas linhas de `club_items` envolvidas, cálculo de `itemBalances` só desses itens e `assertStock`. A devolução preenche `returned_at`, `return_reason` (de 3 a 500 caracteres) e `returned_by`, e o saldo volta.

`components/modules/clube-maes.tsx` ("use client") tem uma barra interna com os botões "Livro caixa", "Cadastros", "Relação de enxoval" e "Entregas" (`className="button"` e `primary` no ativo), guardando a sub-aba em `?sub=`. Conteúdo de cada uma:
- Livro caixa: `<ResourceManager resourceKey="clube-maes-caixa" />`;
- Cadastros: `<ResourceManager resourceKey="clube-maes-pessoas" />`, com a ação "⎙ Ficha";
- Relação de enxoval: a tabela `Item | Unidade | Entradas | Saídas | Saldo`, mais "Cadastrar item", "Registrar entrada" e o "Histórico de entradas";
- Entregas: a lista do mês e "Registrar entrega", que abre um `<dialog>` com pessoa, data, quem recebeu, linhas de item e quantidade (com "+ Adicionar item"), responsável e observações. Cada entrega tem "⎙ Comprovante" e "Registrar devolução".

Em `lib/module-pages.ts`, troque as três abas do Clube por `{ slug: "clube-maes", label: "Clube de Mães", panel: "clube-maes", access: { resource: "social_clube_maes" } }`. Atualize o teste `lib/modules.test.ts`, se ele citar os slugs antigos, e garanta que o perfil `clube_maes` cai nessa aba (o filtro `SECTOR_ROLE_RESOURCE` já cuida disso).

- [ ] **Step 7: Verificar e commitar**

Aplique a migração no banco local.

Run: `pnpm typecheck && pnpm lint && pnpm vitest run && node scripts/app-shots.mjs 1440 claro "/sistema/assistencia/clube-maes"`
Expected: tudo PASS. Cadastrar um item, dar entrada de 10, entregar 4 (saldo 6), tentar entregar 7 (recusado) e devolver (saldo 10).

```bash
git add supabase/migrations/202610151200_clube_maes_enxoval.sql lib/enxoval.ts lib/enxoval.test.ts app/api/assistencia/enxoval lib/resources/defs/assistencia.ts components/modules/clube-maes.tsx components/modules/panels.tsx lib/module-pages.ts lib/modules.test.ts
git commit -m "feat: clube de mães numa aba com estoque de enxoval e devolução"
```

---

## Fase 5 — Tesouraria e Conselho Fiscal

### Task 13: Painel da Tesouraria e aba "Conselho Fiscal"

**Painel** (visual): os KPIs **Contribuições pagas**, **Contribuições pendentes**, **Receitas do mês**, **Despesas do mês** e **Caixa** (Em aberto / Fechado), mais o `DepartmentAbout`.

**Aba "Conselho Fiscal"** (visual): "Relatório para o Conselho Fiscal — Relatório mensal elaborado pela Tesouraria com fechamento de caixa, resumo por conta financeira e detalhamento das movimentações." Tem o campo de mês e "⎙ Imprimir / PDF". O documento traz o cabeçalho com o nome da instituição em maiúsculas, "RELATÓRIO MENSAL DA TESOURARIA AO CONSELHO FISCAL" e o mês e ano em maiúsculas. Depois vem a tabela de duas colunas: Situação do fechamento, Saldo inicial, Contribuições recebidas, Outras receitas, Total de receitas, Total de despesas, Saldo final e Data do fechamento. Em seguida, "Resumo por Conta Financeira" (`Código | Conta Financeira | Receitas | Despesas | Resultado`) e as movimentações (`Data | Tipo | Conta | Descrição | Centro de Custo | Forma | Valor`).

**Files:**
- Create: `lib/treasury-report.ts`, `lib/treasury-report.test.ts`
- Create: `app/api/tesouraria/conselho/route.ts`
- Create: `components/modules/tesouraria-painel.tsx` (servidor), `components/modules/tesouraria-conselho.tsx` (cliente)
- Modify: `components/modules/paineis.tsx`, `components/modules/panels.tsx`, `lib/module-pages.ts`

**Interfaces:**
- Consumes: o que `GET /api/tesouraria/mes?month=` já devolve. Leia `app/api/tesouraria/mes/route.ts` e `lib/treasury.ts` antes de começar, para reaproveitar o cálculo de saldo inicial e final e a situação do mês.
- Produces: `summarizeByAccount(entries: { account_code: string; account_name: string; kind: "Receita" | "Despesa"; amount_cents: number }[]): { code: string; name: string; receitas: number; despesas: number; resultado: number }[]` (ordenado por código); `treasuryKpis(i: { paid: number; pending: number; revenue: number; expense: number; status: string })`. A API `GET /api/tesouraria/conselho?month=` devolve `{ institution, month, status, opening, contributions, otherRevenue, totalRevenue, totalExpense, closing, closedAt, accounts, entries }`. A permissão de leitura vale para `tesouraria` **ou** `conselho_fiscal`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, expect, it } from "vitest";
import { summarizeByAccount, treasuryKpis } from "@/lib/treasury-report";

describe("relatório ao Conselho Fiscal", () => {
  it("resume por conta, em ordem de código", () => {
    expect(summarizeByAccount([
      { account_code: "2.07.01", account_name: "Rancho / Cestas", kind: "Despesa", amount_cents: 30000 },
      { account_code: "1.01.01", account_name: "Contribuições", kind: "Receita", amount_cents: 50000 },
      { account_code: "1.01.01", account_name: "Contribuições", kind: "Receita", amount_cents: 2500 }
    ])).toEqual([
      { code: "1.01.01", name: "Contribuições", receitas: 52500, despesas: 0, resultado: 52500 },
      { code: "2.07.01", name: "Rancho / Cestas", receitas: 0, despesas: 30000, resultado: -30000 }
    ]);
  });
  it("indicadores do Painel na ordem do visual", () => {
    expect(treasuryKpis({ paid: 54, pending: 10, revenue: 870500, expense: 399245, status: "Aberto" }).map((k) => [k.label, k.value])).toEqual([
      ["Contribuições pagas", "54"], ["Contribuições pendentes", "10"], ["Receitas do mês", "R$ 8.705,00"],
      ["Despesas do mês", "R$ 3.992,45"], ["Caixa", "Em aberto"]
    ]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run lib/treasury-report.test.ts`
Expected: FAIL (o módulo ainda não existe).

- [ ] **Step 3: Implementar**

```ts
/** Relatório mensal da Tesouraria ao Conselho Fiscal e indicadores do Painel. Módulo puro. */
import { formatMoney } from "@/lib/resources/types";

export function summarizeByAccount(entries: { account_code: string; account_name: string; kind: "Receita" | "Despesa"; amount_cents: number }[]) {
  const map = new Map<string, { code: string; name: string; receitas: number; despesas: number; resultado: number }>();
  for (const e of entries) {
    const row = map.get(e.account_code) ?? { code: e.account_code, name: e.account_name, receitas: 0, despesas: 0, resultado: 0 };
    if (e.kind === "Receita") row.receitas += e.amount_cents; else row.despesas += e.amount_cents;
    row.resultado = row.receitas - row.despesas;
    map.set(e.account_code, row);
  }
  return [...map.values()].sort((a, b) => a.code.localeCompare(b.code, "pt-BR", { numeric: true }));
}

export function treasuryKpis(i: { paid: number; pending: number; revenue: number; expense: number; status: string }) {
  return [
    { label: "Contribuições pagas", value: String(i.paid) },
    { label: "Contribuições pendentes", value: String(i.pending) },
    { label: "Receitas do mês", value: formatMoney(i.revenue) },
    { label: "Despesas do mês", value: formatMoney(i.expense) },
    { label: "Caixa", value: i.status === "Aberto" ? "Em aberto" : i.status }
  ];
}
```

Confira se `formatMoney(870500)` devolve exatamente `"R$ 8.705,00"`. Se o espaço depois de "R$" for um NBSP, troque a expectativa do teste para `formatMoney(870500)` em vez do texto literal.

- [ ] **Step 4: Rodar o teste**

Run: `pnpm vitest run lib/treasury-report.test.ts`
Expected: 2 PASS.

- [ ] **Step 5: API, Painel e aba**

A API reaproveita as funções de `lib/treasury.ts`. Para o tipo e o código da conta, leia `treasury_entries` com `treasury_accounts`; confira os nomes no `202609171800_onda3_tesouraria.sql`.

O Painel (`PAINEIS.tesouraria`) busca:
- as contribuições do mês, pagas e pendentes, com a mesma regra da grade de `components/modules/tesouraria-contribuicoes.tsx` e da API `app/api/tesouraria/contribuicoes`;
- as receitas e despesas do mês;
- a situação do mês.

A aba é `{ slug: "conselho", label: "Conselho Fiscal", panel: "tesouraria-conselho" }`, entre "Caixa Mensal" e "Aniversariantes". O documento tem a classe `print-doc`, e os controles têm `no-print`.

- [ ] **Step 6: Verificar e commitar**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run && node scripts/app-shots.mjs 1440 claro /sistema/tesouraria /sistema/tesouraria/conselho`
Expected: tudo PASS; os dois iguais em estrutura a `tmp/visual-215-ref/tesouraria__Painel.png` e `tesouraria__Conselho-Fiscal.png`.

```bash
git add lib/treasury-report.ts lib/treasury-report.test.ts app/api/tesouraria/conselho components/modules/tesouraria-painel.tsx components/modules/tesouraria-conselho.tsx components/modules/paineis.tsx components/modules/panels.tsx lib/module-pages.ts
git commit -m "feat: painel da Tesouraria e relatório mensal ao Conselho Fiscal"
```

### Task 14: Conselho Fiscal — Painel, Parecer e Histórico

Visual:
- **Painel**: KPIs **Aguardando análise**, **Deferidos**, **Indeferidos**, **Disponíveis p/ arquivo** e **Arquivados**, mais o `DepartmentAbout` (Conselheiros/Apoio, Task 2) e o texto "Acompanhamento dos relatórios mensais encaminhados pela Tesouraria, análise, emissão de parecer e histórico das competências."
- **Parecer**: "Parecer institucional emitido após o fechamento do caixa, estruturado conforme as atribuições do Conselho Fiscal no Estatuto e os controles da Tesouraria previstos no Regimento Interno." Enquanto o mês estiver aberto: "Relatório ainda indisponível. Aguarde o fechamento do caixa pela Tesouraria." Com o mês fechado: o resumo do relatório (Task 13) e o formulário do parecer (Decisão: Em análise, Deferido ou Indeferido; data; conselheiros presentes; análise; parecer).
- **Histórico**: `Competência | Caixa | Saldo Final | Parecer | Data | Arquivamento | Ação`, com o botão **Arquivar** (a mesma ação de `/api/conselho/pareceres/[id]/arquivar`).

**Files:**
- Create: `lib/fiscal-council.ts`, `lib/fiscal-council.test.ts`
- Create: `components/modules/conselho-painel.tsx` (servidor), `components/modules/conselho-parecer.tsx`, `components/modules/conselho-historico.tsx`
- Modify: `components/modules/paineis.tsx`, `components/modules/panels.tsx`, `lib/module-pages.ts`

**Interfaces:**
- Consumes: o recurso `conselho-analises` (`fiscal_reviews`: `reference_month`, `status`, `review_date`, `reviewers`, `analysis`, `opinion`, `locked_at`) e `GET /api/tesouraria/conselho?month=` (Task 13).
- Produces: `councilKpis(reviews: { status: string; locked_at: string | null }[]): { label: string; value: string }[]`; `canIssueOpinion(monthStatus: string): boolean` (verdadeiro só com o mês "Fechado"). Abas: `{ slug: "", label: "Painel", panel: "painel" }`, `{ slug: "analise", label: "Análise Mensal", panel: "conselho-analise" }` (Task 15), `{ slug: "parecer", label: "Parecer", panel: "conselho-parecer" }`, `{ slug: "historico", label: "Histórico", panel: "conselho-historico" }` e `{ slug: "relatorio", label: "Relatório Anual", panel: "relatorio-conselho" }`. A aba antiga `analises` passa a redirecionar para `historico`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, expect, it } from "vitest";
import { canIssueOpinion, councilKpis } from "@/lib/fiscal-council";

describe("Conselho Fiscal", () => {
  it("indicadores do Painel", () => {
    expect(councilKpis([
      { status: "Em análise", locked_at: null },
      { status: "Deferido", locked_at: null },
      { status: "Deferido", locked_at: "2026-09-01" },
      { status: "Indeferido", locked_at: null }
    ]).map((k) => [k.label, k.value])).toEqual([
      ["Aguardando análise", "1"], ["Deferidos", "2"], ["Indeferidos", "1"], ["Disponíveis p/ arquivo", "2"], ["Arquivados", "1"]
    ]);
  });
  it("parecer só com o caixa fechado", () => {
    expect(canIssueOpinion("Aberto")).toBe(false);
    expect(canIssueOpinion("Fechado")).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run lib/fiscal-council.test.ts`
Expected: FAIL (o módulo ainda não existe).

- [ ] **Step 3: Implementar**

```ts
/** Conselho Fiscal (visual v215): indicadores e liberação do parecer. Módulo puro. */
export function councilKpis(reviews: { status: string; locked_at: string | null }[]) {
  const decided = reviews.filter((r) => r.status === "Deferido" || r.status === "Indeferido");
  return [
    { label: "Aguardando análise", value: String(reviews.filter((r) => r.status === "Em análise").length) },
    { label: "Deferidos", value: String(reviews.filter((r) => r.status === "Deferido").length) },
    { label: "Indeferidos", value: String(reviews.filter((r) => r.status === "Indeferido").length) },
    { label: "Disponíveis p/ arquivo", value: String(decided.filter((r) => !r.locked_at).length) },
    { label: "Arquivados", value: String(reviews.filter((r) => r.locked_at).length) }
  ];
}

export function canIssueOpinion(monthStatus: string) {
  return monthStatus === "Fechado";
}
```

- [ ] **Step 4: Rodar o teste**

Run: `pnpm vitest run lib/fiscal-council.test.ts`
Expected: 2 PASS.

- [ ] **Step 5: Telas e abas**

- `conselho-painel.tsx` (`PAINEIS.conselhofiscal`) lê `fiscal_reviews` e mostra o `DepartmentAbout`, os KPIs e o texto.
- `conselho-parecer.tsx` tem o campo de mês. Com o mês aberto (`!canIssueOpinion`), mostra o aviso do visual. Com o mês fechado, mostra o resumo e um formulário que cria ou edita o registro de `conselho-analises` da competência (POST ou PUT em `/api/r/conselho-analises`, com `reference_month`). Parecer já arquivado (`locked_at`) aparece só para leitura.
- `conselho-historico.tsx` monta a tabela do visual com `fiscal_reviews` e com o saldo final de cada competência (de `/api/tesouraria/conselho?month=`). O botão "Arquivar" chama a mesma rota de `components/modules/conselho-fiscal.tsx`.
- `relatorio-conselho` no `ModulePanel` devolve `<AnnualReport department="conselho_fiscal" title="Conselho Fiscal" />`. Acrescente em `lib/reports.ts` a chave `conselho_fiscal: [{ label: "Pareceres emitidos", table: "fiscal_reviews", dateColumn: "review_date", where: "r.archived_at is null and r.status in ('Deferido','Indeferido')", kind: "atividade", describe: "'Competência ' || r.reference_month || ' — ' || r.status" }]`.

Para a aba antiga `analises` responder com um redirecionamento, crie `app/sistema/conselhofiscal/analises/page.tsx` com `redirect("/sistema/conselhofiscal/historico")`. Leia em `node_modules/next/dist/docs/` como uma rota estática convive com `[modulo]/[[...secao]]` (a rota estática tem prioridade). Atualize também o link de pendência em `app/api/pendencias/route.ts` para `/sistema/conselhofiscal/parecer`.

- [ ] **Step 6: Verificar e commitar**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run && node scripts/app-shots.mjs 1440 claro /sistema/conselhofiscal /sistema/conselhofiscal/parecer /sistema/conselhofiscal/historico /sistema/conselhofiscal/relatorio`
Expected: tudo PASS. Com o mês aberto, o Parecer mostra "Relatório ainda indisponível…".

```bash
git add lib/fiscal-council.ts lib/fiscal-council.test.ts components/modules/conselho-painel.tsx components/modules/conselho-parecer.tsx components/modules/conselho-historico.tsx components/modules/paineis.tsx components/modules/panels.tsx lib/module-pages.ts lib/reports.ts app/sistema/conselhofiscal app/api/pendencias/route.ts
git commit -m "feat: conselho fiscal em abas com painel, parecer e histórico"
```

### Task 15: Conselho Fiscal — Análise Mensal (comprovantes)

Visual: "Comprovantes para conferência" — "Consulte os comprovantes da Tesouraria, do Brechó, do Clube de Mães e da Livraria na competência selecionada acima. Abra o lançamento para visualizar ou baixar seus documentos." Os filtros são a competência, **Buscar lançamento ou comprovante** e **Origem** (Todas as origens disponíveis, Tesouraria, Brechó, Clube de Mães, Livraria). Há a linha "Competência MM/AAAA · N lançamento(s) · M comprovante(s) vinculado(s)", a tabela `Data | Origem | Lançamento | Valor | Comprovantes | Consulta` e a paginação Anterior/Próxima. Acima, a situação do caixa da Tesouraria no mês.

**Files:**
- Create: `app/api/conselho/comprovantes/route.ts`
- Create: `components/modules/conselho-analise.tsx`
- Modify: `components/modules/panels.tsx`

**Interfaces:**
- Consumes: os anexos de `lib/attachments.ts` (o `owner_type` de cada cadastro está em `attachments.ownerType` das definições de `treasuryEntries`, `brechoLedger`, `clubeMaesLedger` e `bookSales`) e o download em `app/api/attachments/[id]/download`.
- Produces: `GET /api/conselho/comprovantes?month=&origin=&q=&page=` → `{ status, rows: { date, origin, description, amount_cents, attachments: { id, name }[] }[], total, pages }`, com 20 por página. A permissão é `conselho_fiscal` read ou `tesouraria` read.

- [ ] **Step 1: Escrever o teste de integração**

`tests/integration/database.test.ts` já roda contra o Postgres local (`pnpm test:integration`). Acrescente um caso que insere um lançamento da Tesouraria no mês 2026-09 e confere que a função de consulta (exporte de `app/api/conselho/comprovantes/route.ts` uma função `listVouchers(month, origin, q, page)`, ou ponha-a em `lib/fiscal-vouchers.ts`) devolve esse lançamento com origem "Tesouraria" e que `origin = "Brechó"` o exclui. Siga o `setup.ts` desse diretório para criar e limpar dados.

```ts
it("comprovantes do Conselho filtram por competência e origem", async () => {
  const { listVouchers } = await import("@/lib/fiscal-vouchers");
  // dado de teste criado com o mesmo helper que os outros casos usam
  const all = await listVouchers("2026-09", "", "", 1);
  expect(all.rows.some((r) => r.origin === "Tesouraria")).toBe(true);
  const brecho = await listVouchers("2026-09", "Brechó", "", 1);
  expect(brecho.rows.every((r) => r.origin === "Brechó")).toBe(true);
});
```

Leia `tests/integration/setup.ts` e um caso existente antes de escrever. Use o mesmo helper de inserção e acrescente o `insert` de `treasury_entries` com os campos obrigatórios da migração.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm test:integration`
Expected: FAIL (`@/lib/fiscal-vouchers` ainda não existe).

- [ ] **Step 3: Implementar `lib/fiscal-vouchers.ts`**

Use um `union all` das quatro fontes, cada uma com `'<Origem>' as origin`, data, descrição e valor em centavos, filtrado por `to_char(<data>, 'YYYY-MM') = $1` e `archived_at is null`. Junte os anexos por `owner_type` e `owner_id` (confira as colunas reais em `lib/attachments.ts` e na migração de anexos). Filtre `origin` e `q` (`ilike` na descrição e no nome do anexo) e pagine com `limit 20 offset (page-1)*20`. Devolva também `total`.

- [ ] **Step 4: Rodar o teste**

Run: `pnpm test:integration`
Expected: PASS.

- [ ] **Step 5: Rota e tela**

A rota chama `listVouchers` depois da permissão e registra a auditoria "Consulta". A tela mostra a situação do caixa, os filtros, a linha de resumo, a tabela (cada anexo é um link para `/api/attachments/<id>/download`) e a paginação. No `ModulePanel`, o caso `"conselho-analise"`.

- [ ] **Step 6: Verificar e commitar**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run && node scripts/app-shots.mjs 1440 claro /sistema/conselhofiscal/analise`
Expected: tudo PASS; a tabela com o lançamento do teste.

```bash
git add lib/fiscal-vouchers.ts app/api/conselho/comprovantes components/modules/conselho-analise.tsx components/modules/panels.tsx tests/integration/database.test.ts
git commit -m "feat: análise mensal do Conselho Fiscal com os comprovantes"
```

---

## Fase 6 — Presidência, Secretaria e Painéis dos demais departamentos

### Task 16: Presidência

Visual:
- **Painel**: KPIs **Departamentos**, **Fichas pendentes na Diretoria**, **Status Doutrina** (situação da escala do mês), **Caixa Tesouraria** (situação do mês), **Conselho Fiscal** (situação do último parecer) e **Recebido** (contribuições do mês), mais o botão **Analisar fichas de trabalhadores**, o `DepartmentAbout` (Presidente/Vice) e o texto "A Diretoria decide sobre as fichas recebidas de todos os departamentos."
- Abas, nesta ordem: **Painel**, **Aprovação de Trabalhadores**, **Situação dos Módulos** (a tabela `Departamento | Status | Escopo atual`, que hoje fica dentro de `presidencia-painel.tsx`), **Trabalhadores** (`DepartmentWorkers department="diretoria"`), **Relatório Anual** e **Autorizações de Baixa**. "Sugestões" sai da barra da Presidência, porque passa para o Controle de Acesso (Task 24).

**Files:**
- Create: `lib/presidencia-dashboard.ts`, `lib/presidencia-dashboard.test.ts`
- Modify: `components/modules/presidencia-painel.tsx` (separa `PresidenciaPainel` e `ModuleStatusTable`)
- Modify: `components/modules/paineis.tsx`, `components/modules/panels.tsx`, `lib/module-pages.ts`, `lib/reports.ts`, `lib/modules.test.ts`

**Interfaces:**
- Produces: `presidenciaKpis(i: { departments: number; pending: number; scaleStatus: string; cashStatus: string; councilStatus: string; received: number })`; os painéis `presidencia-modulos`, `trabalhadores-diretoria` e `relatorio-diretoria`; e `REPORT_SOURCES.diretoria` com "Fichas decididas" (`admission_requests`, `decided_at`, `status in ('approved','rejected')`, atividade) e "Baixas autorizadas" (`patrimony_disposals`, `decided_at`, atividade). Confira as colunas reais nas migrações.

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, expect, it } from "vitest";
import { presidenciaKpis } from "@/lib/presidencia-dashboard";

describe("Painel da Presidência", () => {
  it("seis indicadores na ordem do visual", () => {
    expect(presidenciaKpis({ departments: 12, pending: 5, scaleStatus: "Publicada", cashStatus: "Aberto", councilStatus: "Em análise", received: 574000 })
      .map((k) => k.label)).toEqual(["Departamentos", "Fichas pendentes na Diretoria", "Status Doutrina", "Caixa Tesouraria", "Conselho Fiscal", "Recebido"]);
  });
  it("sem parecer, o Conselho mostra 'Sem parecer'", () => {
    expect(presidenciaKpis({ departments: 12, pending: 0, scaleStatus: "Não gerada", cashStatus: "Aberto", councilStatus: "", received: 0 })[4].value).toBe("Sem parecer");
  });
});
```

E em `lib/modules.test.ts`:

```ts
it("Presidência na ordem do visual", () => {
  expect(MODULE_PAGES.find((p) => p.slug === "presidencia")!.sections.map((s) => s.label)).toEqual([
    "Painel", "Aprovação de Trabalhadores", "Situação dos Módulos", "Trabalhadores", "Relatório Anual", "Autorizações de Baixa"
  ]);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run lib/presidencia-dashboard.test.ts lib/modules.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
/** Painel da Presidência (visual v215). Módulo puro. */
import { formatMoney } from "@/lib/resources/types";

export function presidenciaKpis(i: { departments: number; pending: number; scaleStatus: string; cashStatus: string; councilStatus: string; received: number }) {
  return [
    { label: "Departamentos", value: String(i.departments) },
    { label: "Fichas pendentes na Diretoria", value: String(i.pending) },
    { label: "Status Doutrina", value: i.scaleStatus },
    { label: "Caixa Tesouraria", value: i.cashStatus },
    { label: "Conselho Fiscal", value: i.councilStatus || "Sem parecer" },
    { label: "Recebido", value: formatMoney(i.received) }
  ];
}
```

Ajuste `lib/module-pages.ts` (a Presidência na ordem do teste), separe a tabela de situação dos módulos em `ModuleStatusTable` (exportada pelo mesmo arquivo) e ligue os três painéis novos em `ModulePanel`.

- [ ] **Step 4: Rodar o teste**

Run: `pnpm vitest run lib/presidencia-dashboard.test.ts lib/modules.test.ts`
Expected: PASS.

- [ ] **Step 5: Painel no servidor**

`PAINEIS.presidencia` busca:
- `select count(*) from app.departments where active`;
- as fichas `pending`;
- a situação da escala da Doutrina do mês (`scaleStatusLabel` de `lib/doutrina-scale.ts`);
- a situação do mês da Tesouraria;
- o status do último `fiscal_reviews`;
- a soma das contribuições do mês.

Depois renderiza o `DepartmentAbout`, os KPIs e o botão `<Link className="button primary" href="/sistema/presidencia/admissoes">Analisar fichas de trabalhadores</Link>`.

- [ ] **Step 6: Verificar e commitar**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run && node scripts/app-shots.mjs 1440 claro /sistema/presidencia /sistema/presidencia/modulos /sistema/presidencia/trabalhadores /sistema/presidencia/relatorio`
Expected: tudo PASS; status 200 em todas.

```bash
git add lib/presidencia-dashboard.ts lib/presidencia-dashboard.test.ts components/modules/presidencia-painel.tsx components/modules/paineis.tsx components/modules/panels.tsx lib/module-pages.ts lib/reports.ts lib/modules.test.ts
git commit -m "feat: presidência com os indicadores e as abas do visual v215"
```

### Task 17: Secretaria — Painel, Trabalhadores, Relatório e abertura em Reuniões

Visual:
- **Painel**: KPIs **Cadastros totais**, **Aguardando Diretoria**, **Aprovados**, **Reprovados**, **Departamentos**, **CNPJ**, **Natureza Jurídica** e **Atividade Principal**, mais o "Endereço", o botão **● Gravar reunião e gerar ata** ("Grave a reunião e gere uma minuta editável da ata."), o `DepartmentAbout` (Secretário/Subsecretário) e o texto "Organizar e manter os serviços de secretaria, apoiar a documentação institucional e redigir as atas. A Secretaria cadastra e acompanha as fichas; as decisões de aprovação ou reprovação são registradas pela Diretoria."
- Abas: **Reuniões e Atas** (a aba que abre o módulo), **Painel**, **Acompanhar admissões**, **Trabalhadores** ("Relação de trabalhadores ativos e vinculados à Secretaria.", com o botão "⎙ Todos os trabalhadores"), **Aniversariantes** e **Relatório Anual**.

**Files:**
- Create: `supabase/migrations/202610151300_instituicao_dados_legais.sql`
- Modify: `app/sistema/instituicao/institution-form.tsx`, `app/api/instituicao/route.ts`
- Create: `components/modules/secretaria-painel.tsx` (servidor)
- Modify: `lib/module-pages.ts`, `lib/modules.test.ts`, `components/modules/paineis.tsx`, `components/modules/panels.tsx`, `app/api/agenda/route.ts`, `app/sistema/home-client.tsx`, `lib/home.ts`

**Interfaces:**
- Produces: as colunas `institution_settings.legal_nature` (padrão `'399-9 — Associação Privada'`) e `main_activity` (padrão `'94.91-0-00'`). Na Secretaria, Reuniões fica com o slug `""` e o Painel com o slug `"painel"` (exceção à regra do Painel na raiz, como no visual). O painel novo é `trabalhadores-secretaria`.

- [ ] **Step 1: Escrever o teste que falha**

Em `lib/modules.test.ts`, troque os testes da Secretaria por:

```ts
it("a Secretaria abre em Reuniões e Atas, como no visual", () => {
  const sec = MODULE_PAGES.find((p) => p.slug === "secretaria")!;
  expect(sec.sections.map((s) => [s.slug, s.label])).toEqual([
    ["", "Reuniões e Atas"], ["painel", "Painel"], ["admissoes", "Acompanhar admissões"],
    ["trabalhadores", "Trabalhadores"], ["aniversariantes", "Aniversariantes"], ["relatorio", "Relatório Anual"]
  ]);
});
```

e tire `"secretaria"` da lista do teste "todo módulo de departamento tem o Painel na raiz".

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run lib/modules.test.ts`
Expected: FAIL.

- [ ] **Step 3: Abas, links e migração**

`lib/module-pages.ts` (Secretaria):

```ts
sections: [
  { slug: "", label: "Reuniões e Atas", panel: "secretaria-reunioes" },
  { slug: "painel", label: "Painel", panel: "painel" },
  { slug: "admissoes", label: "Acompanhar admissões", panel: "admissoes-atalho" },
  { slug: "trabalhadores", label: "Trabalhadores", panel: "trabalhadores-secretaria" },
  { slug: "aniversariantes", label: "Aniversariantes", panel: "aniversariantes" },
  { slug: "relatorio", label: "Relatório Anual", panel: "relatorio-secretaria" }
]
```

O painel `secretaria-reunioes` é a Task 18. Até lá, no `ModulePanel`, o caso `"secretaria-reunioes"` devolve `<ResourceManager resourceKey="secretaria-reunioes" />`.

Crie `app/sistema/secretaria/reunioes/page.tsx` e `app/sistema/secretaria/gravador/page.tsx`, ambos com `redirect("/sistema/secretaria")`, para os links antigos. Volte os links de `app/api/agenda/route.ts`, `app/sistema/home-client.tsx` e `lib/home.ts` que apontavam para `/sistema/secretaria/reunioes` para `/sistema/secretaria`.

Migração:

```sql
begin;
alter table app.institution_settings
  add column if not exists legal_nature text not null default '399-9 — Associação Privada' check (char_length(legal_nature) <= 120),
  add column if not exists main_activity text not null default '94.91-0-00' check (char_length(main_activity) <= 120);
commit;
```

Em `institution-form.tsx` e `app/api/instituicao/route.ts`, acrescente os dois campos ("Natureza jurídica" e "Atividade principal (CNAE)") com o mesmo padrão dos campos `cnpj` e `address`.

- [ ] **Step 4: Rodar o teste**

Run: `pnpm vitest run lib/modules.test.ts`
Expected: PASS.

- [ ] **Step 5: Painel e Trabalhadores**

`PAINEIS.secretaria` monta:
- os KPIs: total de `workers`; `pending`, `active` e `rejected` (confira o status de reprovado no CHECK de `workers`); departamentos ativos; CNPJ, Natureza e Atividade de `institution_settings`;
- a linha "Endereço: …";
- o botão `<Link className="button primary" href="/sistema/secretaria">● Gravar reunião e gerar ata</Link>`, com o texto ao lado;
- o `DepartmentAbout`.

`trabalhadores-secretaria` é `<DepartmentWorkers department="secretaria" />`, com um botão "⎙ Todos os trabalhadores" que abre `/sistema/trabalhadores` com `?imprimir=1` (se essa tela não tiver o modo de impressão, o botão chama `window.print()` na própria lista). `relatorio-secretaria` já existe no `ModulePanel`; passe o `title`.

- [ ] **Step 6: Verificar e commitar**

Aplique a migração no banco local.

Run: `pnpm typecheck && pnpm lint && pnpm vitest run && node scripts/app-shots.mjs 1440 claro /sistema/secretaria /sistema/secretaria/painel /sistema/secretaria/trabalhadores /sistema/secretaria/relatorio /sistema/secretaria/reunioes`
Expected: tudo PASS; `/sistema/secretaria/reunioes` redireciona para `/sistema/secretaria`.

```bash
git add supabase/migrations/202610151300_instituicao_dados_legais.sql app/sistema/instituicao app/api/instituicao components/modules/secretaria-painel.tsx components/modules/paineis.tsx components/modules/panels.tsx lib/module-pages.ts lib/modules.test.ts app/sistema/secretaria app/api/agenda/route.ts app/sistema/home-client.tsx lib/home.ts
git commit -m "feat: secretaria abre em reuniões, com painel, trabalhadores e relatório"
```

### Task 18: Reuniões e Atas com o gravador dentro

Visual: o título "Reuniões e Atas" e o texto "Grave a reunião, acompanhe a transcrição e receba uma minuta da ata ao encerrar."

- **1. Dados da reunião**: Título da reunião \*, Data, Local ou formato, Quem conduz a reunião, Responsável pela ata, Participantes e Pauta.
- **2. Gravação e transcrição**: ● Gravar reunião, Pausar, ■ Encerrar e gerar ata, Retomar transcrição, Baixar áudio; a opção "Transcrever automaticamente em português"; a Transcrição da reunião; e o aviso "A transcrição ao vivo usa o serviço de voz do navegador e pode enviar áudio a esse serviço. Pode exigir internet. Para reunião on-line, o microfone precisa captar as falas dos participantes."
- **3. Ata da reunião**: Deliberações e encaminhamentos, "Texto da ata — editável", Gerar / atualizar ata, Salvar ata, ⎙ Imprimir / Salvar PDF, Baixar ata em texto e Baixar ata formatada; e o aviso "A minuta organiza os dados e a transcrição, sem resumir por inteligência artificial. Confira as falas, decisões e nomes antes de usar a ata."
- **Reuniões salvas**: Pesquisar reunião e a lista.
- O botão **+ Nova reunião**.

O app já tem `MeetingRecorder` (`components/modules/secretaria-gravador.tsx`) e o cadastro `secretaria-reunioes`. Esta task junta os dois numa tela só.

**Files:**
- Create: `lib/meeting-minutes.ts`, `lib/meeting-minutes.test.ts`
- Create: `components/modules/secretaria-reunioes.tsx`
- Modify: `components/modules/secretaria-gravador.tsx` (aceita `meetingId` e `onTranscript`)
- Modify: `components/modules/panels.tsx`

**Interfaces:**
- Consumes: `MeetingRecorder` (leia a interface atual antes de mudar) e a API do cadastro `/api/r/secretaria-reunioes`.
- Produces: `buildMinutes(m: { title: string; date: string; place: string; chair: string; secretary: string; participants: string; agenda: string; transcript: string; decisions: string; institution: string }): string`, a minuta em texto no modelo "Ata da reunião …". Ela é determinística: sem campo, escreve "[não informado]".

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, expect, it } from "vitest";
import { buildMinutes } from "@/lib/meeting-minutes";

describe("minuta da ata", () => {
  const base = { title: "Reunião da Diretoria", date: "2026-10-14", place: "Sede", chair: "Marcel", secretary: "Juliana",
    participants: "Marcel\nJuliana", agenda: "1. Caixa", transcript: "Falou-se do caixa.", decisions: "Aprovado o caixa.", institution: "Lar da Bênção" };
  it("monta a ata com data por extenso, pauta, deliberações e assinaturas", () => {
    const text = buildMinutes(base);
    expect(text).toContain("ATA DA REUNIÃO DA DIRETORIA");
    expect(text).toContain("14 de outubro de 2026");
    expect(text).toContain("Pauta:\n1. Caixa");
    expect(text).toContain("Deliberações e encaminhamentos:\nAprovado o caixa.");
    expect(text).toContain("Marcel — quem conduziu a reunião");
    expect(text).toContain("Juliana — responsável pela ata");
  });
  it("campo vazio vira marcador, sem inventar conteúdo", () => {
    expect(buildMinutes({ ...base, decisions: "", place: "" })).toContain("[não informado]");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run lib/meeting-minutes.test.ts`
Expected: FAIL (o módulo ainda não existe).

- [ ] **Step 3: Implementar**

```ts
/** Minuta determinística da ata (sem resumo por IA), como no visual v215. Módulo puro. */
const or = (v: string) => (v.trim() ? v.trim() : "[não informado]");
const longDate = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso)
  ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
  : "[data não informada]";

export function buildMinutes(m: { title: string; date: string; place: string; chair: string; secretary: string; participants: string; agenda: string; transcript: string; decisions: string; institution: string }) {
  return [
    `ATA DA ${or(m.title).toUpperCase()}`,
    "",
    `Aos ${longDate(m.date)}, em ${or(m.place)}, reuniram-se os participantes abaixo, sob a condução de ${or(m.chair)}, para tratar da pauta a seguir. ${m.institution}.`,
    "",
    `Participantes:\n${or(m.participants)}`,
    "",
    `Pauta:\n${or(m.agenda)}`,
    "",
    `Registro da reunião:\n${or(m.transcript)}`,
    "",
    `Deliberações e encaminhamentos:\n${or(m.decisions)}`,
    "",
    "Nada mais havendo a tratar, a reunião foi encerrada e esta ata foi lavrada.",
    "",
    "______________________________",
    `${or(m.chair)} — quem conduziu a reunião`,
    "",
    "______________________________",
    `${or(m.secretary)} — responsável pela ata`
  ].join("\n");
}
```

- [ ] **Step 4: Rodar o teste**

Run: `pnpm vitest run lib/meeting-minutes.test.ts`
Expected: 2 PASS.

- [ ] **Step 5: Tela**

`components/modules/secretaria-reunioes.tsx` ("use client"):
- No topo, "+ Nova reunião" limpa o formulário.
- As seções 1, 2 e 3 são um formulário controlado ligado ao cadastro: o POST cria, e o PUT, com `version`, salva. Os campos mapeiam assim: título → `title`, data → `meeting_date`, local → `place`, condução → `chair`, ata → `secretary`, participantes, pauta, transcrição → `transcript`, deliberações → `decisions` e texto da ata → `minutes`.
- A seção 2 embute `<MeetingRecorder meetingId={id} onTranscript={(t) => setForm({ ...form, transcript: form.transcript + t })} />`. Ajuste o `MeetingRecorder` para aceitar essas props sem perder o funcionamento atual: o áudio continua vinculado à reunião pelo anexo.
- "Gerar / atualizar ata" preenche `minutes` com `buildMinutes`, usando o nome da instituição de `/api/instituicao`. "Salvar ata" grava. "Baixar ata em texto" baixa um `.txt`. "Baixar ata formatada" baixa um `.html` com o mesmo texto em `<pre>` e estilo A4. "⎙ Imprimir" chama `window.print()`, com a ata na classe `print-doc`.
- Em "Reuniões salvas", a busca e a lista vêm do GET do cadastro (`?q=`), e clicar numa reunião carrega o formulário.

No `ModulePanel`, o caso `"secretaria-reunioes"` passa a devolver `<MeetingsPanel />`.

- [ ] **Step 6: Verificar e commitar**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run && node scripts/app-shots.mjs 1440 claro /sistema/secretaria`
Expected: tudo PASS; criar uma reunião, gerar a ata, salvar e reabrir pela lista.

```bash
git add lib/meeting-minutes.ts lib/meeting-minutes.test.ts components/modules/secretaria-reunioes.tsx components/modules/secretaria-gravador.tsx components/modules/panels.tsx
git commit -m "feat: reuniões e atas com o gravador na mesma tela"
```

### Task 19: Painéis de Patrimônio, Eventos, Divulgação e Jurídico

Visual:
- **Patrimônio**: KPIs **Bens cadastrados**, **Em patrimônio**, **Bens baixados** e **Valor em patrimônio**, mais o aviso "Acompanhe os bens cadastrados, suas entradas, baixas e documentos em Cadastro de Bens."
- **Eventos**: três cartões fixos, "Finalidade", "Planejamento" e "Prestação de informações".
- **Divulgação**: quatro cartões de setor, "Relações Públicas", "Livraria", "Biblioteca" e "Brinquedoteca".
- **Jurídico**: três cartões, "Assistência jurídica", "Representação" e "Assembleias e Diretoria".

O texto dos cartões está no HTML. Extraia-o com o script do Step 1.

**Files:**
- Create: `scripts/extract-panel-cards.mjs`, que gera `lib/panel-cards.ts`
- Create: `lib/panel-cards.test.ts`
- Create: `components/modules/paineis-simples.tsx`
- Modify: `components/modules/paineis.tsx`

**Interfaces:**
- Produces: `PANEL_CARDS: Record<"eventos" | "divulgacao" | "juridico", { title: string; text: string }[]>`; e `PAINEIS.patrimonio`, `PAINEIS.eventos`, `PAINEIS.divulgacao` e `PAINEIS.juridico`.

- [ ] **Step 1: Extrator e teste**

`scripts/extract-panel-cards.mjs` abre o HTML como os outros scripts. Para cada par `[pagina, painel]` em `[["eventos","evt-painel"],["divulgacao","div-painel"],["juridico","jur-painel"]]`, ativa o painel e lê os cartões que vêm depois do quadro do departamento: os `h3`/`h4` que não estão dentro de `.dept-board` e o texto do mesmo bloco. Depois grava `lib/panel-cards.ts` no mesmo formato de `lib/department-info.ts` (gerado, com o aviso "Não editar à mão"). O teste:

```ts
import { describe, expect, it } from "vitest";
import { PANEL_CARDS } from "@/lib/panel-cards";

describe("cartões dos Painéis", () => {
  it("têm os títulos do visual", () => {
    expect(PANEL_CARDS.eventos.map((c) => c.title)).toEqual(["Finalidade", "Planejamento", "Prestação de informações"]);
    expect(PANEL_CARDS.divulgacao.map((c) => c.title)).toEqual(["Relações Públicas", "Livraria", "Biblioteca", "Brinquedoteca"]);
    expect(PANEL_CARDS.juridico.map((c) => c.title)).toEqual(["Assistência jurídica", "Representação", "Assembleias e Diretoria"]);
    for (const cards of Object.values(PANEL_CARDS)) for (const c of cards) expect(c.text.length).toBeGreaterThan(20);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run lib/panel-cards.test.ts`
Expected: FAIL.

- [ ] **Step 3: Gerar e rodar**

Run: `node scripts/extract-panel-cards.mjs && pnpm vitest run lib/panel-cards.test.ts`
Expected: PASS. Também `grep -c "fictíc\|Demonstra" lib/panel-cards.ts` → `0`.

- [ ] **Step 4: Painéis**

`components/modules/paineis-simples.tsx` exporta quatro painéis de servidor, todos com o `DepartmentAbout` e os líderes da Task 2:
- `PatrimonioPainel`: os KPIs (`patrimony_assets` sem arquivo; "Em patrimônio" é sem `disposal_date`; "Bens baixados" é com `disposal_date`; e a soma de `value_cents` dos que estão em patrimônio, com `formatMoney`) e o aviso;
- os outros três: os cartões de `PANEL_CARDS`, numa `div.grid.cards` com `article.card` (título em `h3` e texto em `p`).

Registre os quatro em `PAINEIS`.

- [ ] **Step 5: Verificar e commitar**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run && node scripts/app-shots.mjs 1440 claro /sistema/patrimonio /sistema/eventos /sistema/divulgacao /sistema/juridico`
Expected: tudo PASS; cada um igual em estrutura ao `*_painel.png` da referência.

```bash
git add scripts/extract-panel-cards.mjs lib/panel-cards.ts lib/panel-cards.test.ts components/modules/paineis-simples.tsx components/modules/paineis.tsx
git commit -m "feat: painéis de patrimônio, eventos, divulgação e jurídico como no visual"
```

---

## Fase 7 — Jurídico, Divulgação e Educação

### Task 20: Eleições — Regras e orientações

Visual: o título "Eleições — Diretoria e Conselho Fiscal" e o texto "Regras do Estatuto e do Regimento, organização da Assembleia e conferência dos participantes." Os botões de cima são **Imprimir guia aos trabalhadores**, **Estatuto original** e **Regimento original**, e as sub-abas são **Regras e orientações**, **Organizar eleição**, **Conferência de participantes** e **Documentos para cartório**. "Regras e orientações" traz as tabelas `Órgão | Composição | Mandato e reeleição` e `Etapa sugerida | Responsabilidade a organizar | Evidência a guardar`, as referências com página ("Estatuto: arts. 20 e 21 — pp. 4–5"…) e "Perguntas dos trabalhadores".

**Files:**
- Create: `scripts/extract-election-guide.mjs`, que gera `lib/juridico/election-guide.ts`
- Create: `lib/juridico/election-guide.test.ts`
- Create: `components/modules/juridico-eleicoes.tsx` (a casca com as 4 sub-abas)
- Modify: `components/modules/panels.tsx`, `lib/module-pages.ts`

**Interfaces:**
- Produces: `ELECTION_GUIDE: { intro: string[]; organs: { organ: string; composition: string; term: string }[]; steps: { step: string; responsibility: string; evidence: string }[]; references: { label: string; source: "estatuto" | "regimento"; page: number }[]; faq: { q: string; a: string }[] }`. O painel `juridico-eleicoes` tem a sub-aba em `?sub=regras|organizar|conferencia|documentos`. "Estatuto original" e "Regimento original" abrem `/sistema/documentos` (confira os slugs reais em `app/api/documents/[slug]/route.ts`) e, quando houver página, acrescentam `#page=N` ao PDF.

- [ ] **Step 1: Extrator e teste**

O extrator ativa `jur-eleicoes`, clica em "Regras e orientações" e lê do DOM as duas tabelas, os botões de referência (rótulos que começam com "Estatuto:" ou "Regimento:"; tire a página do texto "— p. N" ou "— pp. N–M", ficando com a primeira) e o bloco "Perguntas dos trabalhadores" (pares de pergunta e resposta). Ele grava o arquivo gerado. O teste:

```ts
import { describe, expect, it } from "vitest";
import { ELECTION_GUIDE } from "@/lib/juridico/election-guide";

describe("guia das eleições", () => {
  it("tem órgãos, etapas, referências e perguntas", () => {
    expect(ELECTION_GUIDE.organs.length).toBeGreaterThanOrEqual(2);
    expect(ELECTION_GUIDE.steps.length).toBeGreaterThan(3);
    expect(ELECTION_GUIDE.references).toContainEqual({ label: "Estatuto: arts. 20 e 21 — pp. 4–5", source: "estatuto", page: 4 });
    expect(ELECTION_GUIDE.faq.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run lib/juridico/election-guide.test.ts`
Expected: FAIL.

- [ ] **Step 3: Gerar e rodar**

Run: `node scripts/extract-election-guide.mjs && pnpm vitest run lib/juridico/election-guide.test.ts`
Expected: PASS; e `grep -c "fictíc\|Demonstra" lib/juridico/election-guide.ts` → `0`.

- [ ] **Step 4: Casca das sub-abas e Regras**

`juridico-eleicoes.tsx` ("use client") tem o cabeçalho, os três botões e as quatro sub-abas. Nesta task, só "Regras e orientações" fica pronta: renderiza `ELECTION_GUIDE`. As outras três mostram `<p className="notice">Disponível na próxima etapa.</p>` até as Tasks 21 e 22. "Imprimir guia aos trabalhadores" imprime as Regras com as perguntas. Em `lib/module-pages.ts`, a aba Eleições do Jurídico passa a ser `{ slug: "eleicoes", label: "Eleições", panel: "juridico-eleicoes" }`. O cadastro `juridico-eleicoes` (etapas) continua no registro e aparece dentro de "Organizar eleição" (Task 21).

- [ ] **Step 5: Verificar e commitar**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run && node scripts/app-shots.mjs 1440 claro /sistema/juridico/eleicoes`
Expected: tudo PASS.

```bash
git add scripts/extract-election-guide.mjs lib/juridico/election-guide.ts lib/juridico/election-guide.test.ts components/modules/juridico-eleicoes.tsx components/modules/panels.tsx lib/module-pages.ts
git commit -m "feat: guia de regras e orientações das eleições"
```

### Task 21: Eleições — Organizar eleição e Conferência de participantes

Visual:
- **Organizar eleição** (por ano): Ano da eleição em análise, Última eleição regular — ano confirmado, Referência da ata / mandato vigente, Data efetiva da afixação do edital, Local da Assembleia, Horário da primeira convocação, Horário da segunda convocação, Total de membros com direito a voto — relação conferida, Presentes com direito a voto — simulação/conferência, e Critérios definidos / referência das deliberações. Depois vem o "Roteiro de conferência" (`Etapa e fundamento | Conferência | Referência / observações`): para cada etapa, um select de situação e um texto. Os botões são **Consultar ano**, **Salvar organização da eleição** e **Imprimir organização e conferências**. Há avisos calculados: "Ano eleitoral ainda não confirmado…"; "Afixação do edital ainda não informada. A data calculada é o limite de referência, não uma confirmação de convocação."; e "Segunda convocação: o Estatuto admite qualquer número de membros presentes…". Os textos estão em `panels.json`.
- **Conferência de participantes** (por ano): a tabela `Participante / vínculo | Conferência de requisitos | Decisão registrada | Ações` e **Nova conferência de participante**.

**Files:**
- Create: `supabase/migrations/202610151400_eleicoes_organizacao.sql`
- Create: `lib/juridico/election-planning.ts`, `lib/juridico/election-planning.test.ts`
- Create: `app/api/juridico/eleicoes/[year]/route.ts`
- Create: `lib/resources/defs/juridico-participantes.ts` (o cadastro de conferência), registrado em `registry.ts`
- Modify: `components/modules/juridico-eleicoes.tsx`

**Interfaces:**
- Produces: a tabela `app.election_plans(year int primary key, data jsonb not null default '{}', version, updated_at, updated_by)`, onde `data` guarda os campos e o roteiro `{ checks: { step: string; status: "Pendente" | "Conferido" | "Não se aplica"; note: string }[] }`; a tabela `app.election_participants`, que usa o motor (`year`, `name`, `link`, `requirements`, `decision`, `notes`, mais as colunas padrão); `electionNotices(d: { year: number; lastRegular: number | null; noticeDate: string | null }): string[]`, com os avisos calculados; e `noticeDeadline(electionDate: string, days: number): string`. Confira no guia (Task 20) o prazo de afixação do edital. Os avisos dizem que a data calculada é só um limite de referência.

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, expect, it } from "vitest";
import { electionNotices, noticeDeadline } from "@/lib/juridico/election-planning";

describe("organização da eleição", () => {
  it("avisa quando o ano eleitoral não está confirmado", () => {
    expect(electionNotices({ year: 2026, lastRegular: null, noticeDate: null })[0]).toContain("Ano eleitoral ainda não confirmado");
  });
  it("avisa quando o edital ainda não foi afixado", () => {
    expect(electionNotices({ year: 2026, lastRegular: 2024, noticeDate: null }).join(" ")).toContain("Afixação do edital ainda não informada");
  });
  it("calcula o limite de afixação contando dias para trás", () => {
    expect(noticeDeadline("2026-12-10", 15)).toBe("2026-11-25");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run lib/juridico/election-planning.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
/** Organização da eleição (visual v215): avisos e datas de referência. Módulo puro. */
export function noticeDeadline(electionDate: string, days: number) {
  const d = new Date(`${electionDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function electionNotices(d: { year: number; lastRegular: number | null; noticeDate: string | null }) {
  const out: string[] = [];
  if (!d.lastRegular) out.push("Ano eleitoral ainda não confirmado: informe a última eleição e confira o mandato vigente.");
  if (!d.noticeDate) out.push("Afixação do edital ainda não informada. A data calculada é o limite de referência, não uma confirmação de convocação.");
  out.push("Segunda convocação: o Estatuto admite qualquer número de membros presentes. Confirmar edital, horários, presenças e demais condições. Esta calculadora não proclama a instalação nem o resultado da eleição.");
  return out;
}
```

- [ ] **Step 4: Rodar o teste**

Run: `pnpm vitest run lib/juridico/election-planning.test.ts`
Expected: 3 PASS.

- [ ] **Step 5: Migração, API e telas**

A migração cria as duas tabelas (`election_participants` com as colunas do motor), com `grant`s. A API `GET/PUT /api/juridico/eleicoes/[year]` lê e grava `election_plans.data`, com validação zod de cada campo (datas `YYYY-MM-DD`, horários `HH:MM`, inteiros ≥ 0, textos com limite) e `version`. A permissão é `department` em `juridico`.

As etapas do roteiro saem de `ELECTION_GUIDE.steps` (Task 20): uma linha por etapa.

A sub-aba "Organizar eleição" mostra o formulário, os avisos (`electionNotices`), o roteiro e, abaixo, `<ResourceManager resourceKey="juridico-eleicoes" />` filtrado pelo ano, se o motor aceitar o filtro `year`; se não aceitar, acrescente `{ name: "year", label: "Ano" }` aos `filters`. A sub-aba "Conferência de participantes" é `<ResourceManager resourceKey="juridico-participantes" />` filtrado pelo ano. "Imprimir organização e conferências" imprime os dois.

- [ ] **Step 6: Verificar e commitar**

Aplique a migração no banco local.

Run: `pnpm typecheck && pnpm lint && pnpm vitest run && node scripts/app-shots.mjs 1440 claro "/sistema/juridico/eleicoes?sub=organizar" "/sistema/juridico/eleicoes?sub=conferencia"`
Expected: tudo PASS; salvar, recarregar e ver os dados persistidos.

```bash
git add supabase/migrations/202610151400_eleicoes_organizacao.sql lib/juridico/election-planning.ts lib/juridico/election-planning.test.ts app/api/juridico/eleicoes lib/resources/defs/juridico-participantes.ts lib/resources/registry.ts components/modules/juridico-eleicoes.tsx
git commit -m "feat: organização da eleição e conferência de participantes"
```

### Task 22: Eleições — Documentos para cartório (6 .docx e ZIP)

Visual: "Documentos para registro em cartório", com o texto "Conjunto obrigatório informado pela instituição. A numeração é mantida nos documentos e na ordem de geração: 1 → 2 → 2.1 → 3 → 4 → 4.1." A tabela é `Ordem | Documento | Preparação | Ações` (Preencher documento, Gerar Word, Modelo original), com **Gerar os 6 documentos em Word (ZIP)**. Em "Dados para gerar os documentos" ficam:
- Biênio, Endereço da Assembleia (nas atas), Local (nos editais), Início do mandato e Fim do mandato;
- Data do edital de eleição, Data da eleição, Horário de início e Horário de encerramento;
- Presidente que convoca e abre a reunião, Quantidade de membros presentes, Presidente da Assembleia de eleição, Secretário(a) da Assembleia de eleição, e Livro e mensagem lidos na abertura;
- os mesmos dados para a posse, e os 7 cargos eleitos (cargo, nome e qualificação).

Os botões são **Trazer datas do planejamento**, **Usar a mesma mesa na posse**, **Salvar dados dos documentos** e **Recarregar dados salvos**. Os modelos e o motor estão no HTML: é o bloco que começa com `/* Cópias Word baseadas nos modelos do usuário; somente document.xml é alterado. */`, com `const TEMPLATES=[{number,name,sha256,base64,paragraphs}]`, as funções `slot(...)` e `display(...)`, os formatos `date`, `long`, `ataDate`, `dottedDate`, `time` e `count`, e os marcadores `[DATA]`, `[PREENCHER]`, `[NOME]` e `[BIÊNIO]`.

**Files:**
- Create: `scripts/extract-election-templates.mjs`, que grava `lib/juridico/modelos/<n>.docx`, `lib/juridico/modelos/manifest.json` (número, nome, sha256) e `lib/juridico/modelos/paragraphs.json` (os parágrafos de cada modelo, como no `TEMPLATES[i].paragraphs`)
- Create: `lib/juridico/election-documents.ts`, `lib/juridico/election-documents.test.ts`
- Create: `lib/zip-write.ts`, `lib/zip-write.test.ts` (ZIP sem compressão, método STORE, com CRC-32)
- Create: `app/api/juridico/eleicoes/[year]/documentos/route.ts`
- Modify: `components/modules/juridico-eleicoes.tsx`

**Interfaces:**
- Consumes: `listEntries` e `readEntry` de `lib/legacy/zip.ts` (leitura de ZIP), e `election_plans.data` (Task 21) para "Trazer datas do planejamento".
- Produces: `createZip(files: { name: string; data: Uint8Array }[]): Uint8Array`; `formatSlot(value: string, format: "text" | "date" | "long" | "ataDate" | "dottedDate" | "time" | "count"): string` (com o marcador do visual quando o valor falta); `fillDocument(templateNumber: "1" | "2" | "2.1" | "3" | "4" | "4.1", data: ElectionDocData): Promise<Uint8Array>` (o .docx preenchido); e `type ElectionDocData = { fields: Record<string, string>; officers: { role: string; name: string; qualification: string }[] }`. A rota `GET …/documentos?n=2` baixa um .docx; `?n=all` baixa o ZIP com os 6, nomeados pelo `manifest`; o `PUT` grava `data.documents` em `election_plans`.

- [ ] **Step 1: Extrair os modelos**

`scripts/extract-election-templates.mjs` lê `dist/index.html` como texto, acha `const TEMPLATES=` depois do comentário do motor, faz `JSON.parse` do array (use um parser incremental: `JSON.parse` do trecho até o `];` que fecha o array, conferindo o resultado), decodifica cada `base64`, confere o `sha256` (`crypto.createHash("sha256")`) e grava os arquivos. Ele também copia o código do motor (do comentário até o fim do IIFE) para `tmp/visual-215-ref/election-engine.js`, que serve de referência para portar as regras de `slot(...)`.

Run: `node scripts/extract-election-templates.mjs && ls lib/juridico/modelos`
Expected: `1.docx 2.docx 2.1.docx 3.docx 4.docx 4.1.docx manifest.json paragraphs.json`, com o sha256 conferido.

- [ ] **Step 2: Escrever os testes que falham**

`lib/zip-write.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { listEntries, readEntry } from "@/lib/legacy/zip";
import { createZip } from "@/lib/zip-write";

describe("zip sem compressão", () => {
  it("o leitor do próprio app abre o que foi escrito", async () => {
    const zip = createZip([{ name: "a.txt", data: new TextEncoder().encode("olá") }, { name: "pasta/b.xml", data: new TextEncoder().encode("<x/>") }]);
    const entries = listEntries(zip);
    expect([...entries.keys()]).toEqual(["a.txt", "pasta/b.xml"]);
    expect(new TextDecoder().decode(await readEntry(zip, entries.get("a.txt")!))).toBe("olá");
  });
});
```

`lib/juridico/election-documents.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { listEntries, readEntry } from "@/lib/legacy/zip";
import { fillDocument, formatSlot } from "@/lib/juridico/election-documents";

describe("documentos da eleição", () => {
  it("formata datas como nos modelos e mantém marcador quando falta", () => {
    expect(formatSlot("2026-12-10", "date")).toBe("10/12/2026");
    expect(formatSlot("2026-01-10", "dottedDate")).toBe("10.01.2026");
    expect(formatSlot("2026-12-10", "ataDate")).toBe("10 (dez) dias do mês de dezembro de 2026");
    expect(formatSlot("", "date")).toBe("[DATA]");
    expect(formatSlot("", "ataDate")).toBe("[DATA POR EXTENSO]");
  });
  it("gera um .docx válido com os dados no document.xml", async () => {
    const docx = await fillDocument("2", { fields: { biennium: "2028/2029", electionDate: "2027-12-12" }, officers: [{ role: "Presidente", name: "Fulano de Tal", qualification: "brasileiro" }] });
    const entries = listEntries(docx);
    expect(entries.has("word/document.xml")).toBe(true);
    const xml = new TextDecoder().decode(await readEntry(docx, entries.get("word/document.xml")!));
    expect(xml).toContain("2028/2029");
    expect(xml).toContain("Fulano de Tal");
    expect(xml).toContain("[NOME]");
  });
});
```

Se `lib/legacy/zip.ts` só aceitar entradas DEFLATE, estenda o leitor para o método 0 (STORE) neste mesmo passo, com o teste de leitura cobrindo isso.

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm vitest run lib/zip-write.test.ts lib/juridico/election-documents.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implementar**

`lib/zip-write.ts`: CRC-32 com tabela; para cada arquivo, escreve o local file header (`0x04034b50`, versão 20, flags `0x0800` para UTF-8, método 0, CRC, tamanhos, nome) e os dados; depois o diretório central (`0x02014b50`) e o end of central directory (`0x06054b50`). Os números são little-endian (`DataView`).

`lib/juridico/election-documents.ts` porta do motor do HTML (`tmp/visual-215-ref/election-engine.js`):
- as constantes `TITLES`, `ROLES` e `DEFAULTS` (calculadas a partir de `paragraphs.json`, como `between(...)` faz no motor);
- a tabela de `SLOTS`, com as mesmas chamadas `slot(n, i, old, key, format)` para os modelos 1/3, 2/4 e 2.1/4.1;
- `formatSlot`, com as regras de `br`, `long`, `ataDate` e `dottedDate` e os marcadores do motor;
- `fillDocument`, que lê `lib/juridico/modelos/<n>.docx` com `fs/promises`, abre o `word/document.xml`, substitui o texto de cada parágrafo marcado (o motor troca só o trecho `original` pelo valor exibido, dentro dos `w:t` do parágrafo `i`; preserve a formatação do primeiro `w:r` do parágrafo) e reempacota todas as entradas com `createZip`, alterando só o `word/document.xml`.

Escape `&`, `<` e `>` no valor inserido.

- [ ] **Step 5: Rodar o teste**

Run: `pnpm vitest run lib/zip-write.test.ts lib/juridico/election-documents.test.ts`
Expected: PASS.

- [ ] **Step 6: Rota e tela**

A rota exige `department` read em `juridico` para baixar e update para gravar. A resposta tem `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document` (ou `application/zip`), `Content-Disposition: attachment; filename*=UTF-8''<nome do manifest>` e auditoria "Impressão".

A sub-aba "Documentos para cartório" monta a tabela dos 6 documentos (`TITLES`), o formulário "Dados para gerar os documentos" (os campos listados acima e os 7 cargos) e os botões do visual. "Trazer datas do planejamento" copia a data do edital e a data e o horário da eleição de `election_plans.data`. "Usar a mesma mesa na posse" copia o presidente e o secretário da eleição para a posse. "Modelo original" baixa o .docx sem preenchimento. "Preencher documento" rola até o formulário e marca os campos daquele documento. Aviso final: "Conferir os campos das minutas, as qualificações, a escolha da mesa, as deliberações e a documentação assinada antes do encaminhamento ao cartório."

- [ ] **Step 7: Verificar e commitar**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run`
Expected: PASS.

Abra no navegador `/sistema/juridico/eleicoes?sub=documentos`, preencha o biênio e as datas, clique em "Gerar os 6 documentos em Word (ZIP)" e abra o ZIP. Run: `unzip -l ~/Downloads/<arquivo>.zip` → 6 `.docx`. Abra um no Word ou no LibreOffice: os valores no lugar e o restante do texto do modelo intacto.

```bash
git add scripts/extract-election-templates.mjs lib/juridico lib/zip-write.ts lib/zip-write.test.ts lib/legacy/zip.ts app/api/juridico/eleicoes components/modules/juridico-eleicoes.tsx
git commit -m "feat: documentos de eleição para cartório em Word a partir dos modelos"
```

### Task 23: Controle da Livraria numa aba e Evangelizadores na Educação

**Divulgação** (visual): as abas são Painel, Trabalhadores, Relatório Anual e **Controle da Livraria**. O texto do Controle da Livraria é "Organize as obras, acompanhe os empréstimos e registre as vendas e o caixa." e ele tem quatro sub-abas: **Inventário de livros para empréstimos** (`Código / obra | Autor / ISBN | No acervo | Emprestados | Disponíveis para empréstimo | Situação | Ações`, com "Cadastrar livro para empréstimos", "Imprimir inventário de empréstimos", "Pesquisar obra / autor" e o aviso "No acervo = disponíveis + emprestados"), **Estoque de livros para revenda**, **Empréstimos de livros** e **Livro caixa / vendas**.

**Infância e Juventude** (visual): a aba **Evangelizadores** ("Consulte os evangelizadores vinculados ao departamento, imprima fichas e realize novos cadastros para aprovação da Diretoria.", com a tabela `Nome | WhatsApp | Situação | Vínculos | Ação` e os botões "Cadastrar evangelizador" e "⎙ Evangelizadores"). Ordem da Infância: Painel, Evangelizandos, Aniversariantes, Evangelizadores, Biblioteca, Frequência, Cronograma, Planejamento, Relatório. Ordem da Juventude: Painel, Evangelizandos, Evangelizadores, Biblioteca, Frequência, Cronograma, Planejamento, Relatório, Aniversariantes.

**Files:**
- Create: `components/modules/divulgacao-livraria-controle.tsx`
- Modify: `lib/module-pages.ts`, `components/modules/panels.tsx`, `lib/modules.test.ts`
- Create: `app/sistema/infancia/evangelizadores/page.tsx`, `app/sistema/juventude/evangelizadores/page.tsx`
- Modify: `components/education/education-nav.tsx`
- Create: `components/education/education-nav.test.tsx`

**Interfaces:**
- Produces: `educationTabs(department: "infancia" | "juventude"): readonly (readonly [string, string])[]` (exportada de `education-nav.tsx`); e o painel `divulgacao-livraria`, com a sub-aba em `?sub=inventario|estoque|emprestimos|caixa`.

- [ ] **Step 1: Escrever os testes que falham**

`components/education/education-nav.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { educationTabs } from "@/components/education/education-nav";

describe("abas da Educação", () => {
  it("Infância na ordem do visual", () => {
    expect(educationTabs("infancia").map(([, l]) => l)).toEqual(["Painel", "Evangelizandos", "Aniversariantes", "Evangelizadores", "Biblioteca de Estudos", "Frequência", "Cronograma", "Planejamento Anual", "Relatório Anual"]);
  });
  it("Juventude deixa Aniversariantes por último", () => {
    expect(educationTabs("juventude").map(([, l]) => l)).toEqual(["Painel", "Evangelizandos", "Evangelizadores", "Biblioteca de Estudos", "Frequência", "Cronograma", "Planejamento Anual", "Relatório Anual", "Aniversariantes"]);
  });
});
```

Em `lib/modules.test.ts`:

```ts
it("Divulgação na ordem do visual", () => {
  expect(MODULE_PAGES.find((p) => p.slug === "divulgacao")!.sections.map((s) => s.label)).toEqual(["Painel", "Trabalhadores", "Relatório Anual", "Controle da Livraria"]);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run components/education/education-nav.test.tsx lib/modules.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Em `education-nav.tsx`, troque a constante `tabs` por `educationTabs(department)`, com as duas listas do teste (os caminhos `evangelizadores` e os já existentes), e tire o link "Evangelizadores (fichas)". As páginas `app/sistema/<dep>/evangelizadores/page.tsx` seguem o padrão das outras páginas da Educação (leia `app/sistema/infancia/aniversariantes/page.tsx`): `requireModulePage`, `EducationNav` com `current="evangelizadores"`, o título e `<DepartmentWorkers department="<dep>" />`, mais os botões "Cadastrar evangelizador" (link para `/sistema/trabalhadores?novo=1&departamento=<dep>`; se essa tela não aceitar esses parâmetros, link simples para `/sistema/trabalhadores`) e "⎙ Evangelizadores" (`window.print()` num componente cliente pequeno).

Em `lib/module-pages.ts`, a Divulgação fica com `[{ slug: "", label: "Painel", panel: "painel" }, { slug: "trabalhadores", … }, { slug: "relatorio", … }, { slug: "livraria", label: "Controle da Livraria", panel: "divulgacao-livraria" }]`. `divulgacao-livraria-controle.tsx` monta as quatro sub-abas:
- inventário: `<ResourceManager resourceKey="divulgacao-obras" />`, com as colunas extras de acervo, emprestados e disponíveis vindas de `/api/divulgacao/resumo` (leia essa rota);
- estoque: `<ResourceManager resourceKey="divulgacao-estoque" />`;
- empréstimos: `<BookLoansPanel />`;
- caixa: `<ResourceManager resourceKey="divulgacao-vendas" />`.

Crie páginas que redirecionam de `/sistema/divulgacao/{obras,estoque,emprestimos,vendas}` para `/sistema/divulgacao/livraria?sub=…`.

- [ ] **Step 4: Rodar o teste**

Run: `pnpm vitest run components/education/education-nav.test.tsx lib/modules.test.ts`
Expected: PASS.

- [ ] **Step 5: Verificar e commitar**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run && node scripts/app-shots.mjs 1440 claro /sistema/divulgacao/livraria /sistema/infancia/evangelizadores /sistema/juventude/evangelizadores`
Expected: tudo PASS.

```bash
git add components/modules/divulgacao-livraria-controle.tsx lib/module-pages.ts components/modules/panels.tsx lib/modules.test.ts app/sistema/infancia/evangelizadores app/sistema/juventude/evangelizadores components/education app/sistema/divulgacao
git commit -m "feat: controle da livraria numa aba e evangelizadores na educação"
```

---

## Fase 8 — Controle de Acesso, Minha área, mobile e conferência

### Task 24: Controle de Acesso com as 8 abas

Visual, nesta ordem: **Painel**, **Biênio / Gestão**, **Usuários e Perfis**, **Matriz de Permissões**, **Dedo-duro / Histórico**, **Testar Acessos**, **Sugestões e Melhorias** e **Backup e restauração**.

**Files:**
- Create: `app/sistema/acesso/layout.tsx` (abas e `requirePageActor` + `users` admin)
- Create: `app/sistema/acesso/[aba]/page.tsx`
- Modify: `app/sistema/acesso/page.tsx` (vira o Painel), `app/sistema/acesso/access-matrix.tsx` (divide em `BienniumPanel`, `MatrixPanel` e `AccessTestPanel`)
- Create: redirecionamentos em `app/sistema/usuarios/page.tsx`, `app/sistema/auditoria/page.tsx` e `app/sistema/importacao/page.tsx` (cada um vira `redirect("/sistema/acesso/<aba>")`, mantendo o componente cliente importado a partir da nova rota)
- Create: `lib/access-tabs.ts`, `lib/access-tabs.test.ts`
- Create: `app/api/backup/route.ts`
- Modify: `components/sidebar.tsx` (os links administrativos apontam para as abas)

**Interfaces:**
- Produces: `ACCESS_TABS: { slug: string; label: string; capability: "users" | "audit" | "suggestions" | "import" }[]`; `visibleAccessTabs(caps: { users: boolean; audit: boolean; suggestions: boolean; import: boolean })`. Rotas: `/sistema/acesso` (Painel), `/bienio`, `/usuarios`, `/matriz`, `/historico`, `/testar`, `/sugestoes` e `/backup`. A `GET /api/backup` só funciona para o administrador e devolve um ZIP (`createZip` da Task 22) com um `.json` por tabela de negócio, sem `auth.*`, sem senhas e sem conteúdo de anexos (só os metadados), com auditoria "Exportação".

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, expect, it } from "vitest";
import { ACCESS_TABS, visibleAccessTabs } from "@/lib/access-tabs";

describe("abas do Controle de Acesso", () => {
  it("seguem a ordem do visual", () => {
    expect(ACCESS_TABS.map((t) => t.label)).toEqual([
      "Painel", "Biênio / Gestão", "Usuários e Perfis", "Matriz de Permissões", "Dedo-duro / Histórico", "Testar Acessos", "Sugestões e Melhorias", "Backup e restauração"
    ]);
  });
  it("sem permissão de auditoria, o histórico some", () => {
    const labels = visibleAccessTabs({ users: true, audit: false, suggestions: true, import: true }).map((t) => t.label);
    expect(labels).not.toContain("Dedo-duro / Histórico");
    expect(labels).toContain("Usuários e Perfis");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run lib/access-tabs.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
/** Abas do Controle de Acesso (visual v215). Módulo puro. */
export const ACCESS_TABS = [
  { slug: "", label: "Painel", capability: "users" },
  { slug: "bienio", label: "Biênio / Gestão", capability: "users" },
  { slug: "usuarios", label: "Usuários e Perfis", capability: "users" },
  { slug: "matriz", label: "Matriz de Permissões", capability: "users" },
  { slug: "historico", label: "Dedo-duro / Histórico", capability: "audit" },
  { slug: "testar", label: "Testar Acessos", capability: "users" },
  { slug: "sugestoes", label: "Sugestões e Melhorias", capability: "suggestions" },
  { slug: "backup", label: "Backup e restauração", capability: "import" }
] as const;

export function visibleAccessTabs(caps: { users: boolean; audit: boolean; suggestions: boolean; import: boolean }) {
  return ACCESS_TABS.filter((t) => caps[t.capability]);
}
```

- [ ] **Step 4: Rodar o teste**

Run: `pnpm vitest run lib/access-tabs.test.ts`
Expected: PASS.

- [ ] **Step 5: Rotas e telas**

O layout calcula as capacidades:
- `users`: `hasPermission(actor, "users", "admin")`;
- `audit`: `hasPermission(actor, "audit", "read")`;
- `suggestions`: a mesma regra de `canManage` em `app/api/sugestoes/route.ts`;
- `import`: `hasPermission(actor, "modules", "admin")` e a flag `legacy_import`.

Ele mostra o título "Controle de Acesso", o texto "Perfis, permissões, usuários e auditoria conforme a estrutura institucional." e `ModuleTabsByPath` com as abas visíveis.

`[aba]/page.tsx` escolhe o conteúdo:
- `bienio`, `matriz` e `testar`: as partes de `access-matrix.tsx`;
- `usuarios`: o `UserManager` (Task 25 muda o formulário);
- `historico`: o cliente de `app/sistema/auditoria`;
- `sugestoes`: o cliente de `app/sistema/sugestoes`;
- `backup`: o cartão "Backup completo" ("Guarde uma cópia dos cadastros… Os anexos ficam no armazenamento seguro; o arquivo traz a lista deles, sem o conteúdo." e o botão "Baixar backup completo", que chama `GET /api/backup`), o cartão "Restaurar uma cópia" (texto: "A restauração do banco é feita pelo procedimento de `docs/BACKUP_RESTORE.md`, com o backup automático do Supabase. Para trazer dados do HTML v215, use a importação abaixo.") e o `ImportClient`.

Aba desconhecida dá `notFound()`.

`/sistema/sugestoes` continua existindo para quem envia sugestões. Só a gestão vai para a aba.

- [ ] **Step 6: Verificar e commitar**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run && node scripts/app-shots.mjs 1440 claro /sistema/acesso /sistema/acesso/bienio /sistema/acesso/usuarios /sistema/acesso/matriz /sistema/acesso/historico /sistema/acesso/testar /sistema/acesso/sugestoes /sistema/acesso/backup /sistema/usuarios`
Expected: tudo PASS; `/sistema/usuarios` redireciona; baixar o backup gera um ZIP com os `.json`.

```bash
git add app/sistema/acesso app/sistema/usuarios app/sistema/auditoria app/sistema/importacao lib/access-tabs.ts lib/access-tabs.test.ts app/api/backup components/sidebar.tsx
git commit -m "feat: controle de acesso com as oito abas do visual v215"
```

### Task 25: Painel do Acesso e modal "Cadastrar acesso"

**Painel** (visual): KPIs **Usuários cadastrados**, **Acessos ativos**, **Acesso institucional** (usuários ativos que não são administradores), **Suspensos** e **Administrador do Sistema**. Avisos: "Acesso institucional comum: todos os usuários ativos possuem acesso automático de consulta e impressão ao Estatuto, Regimento Interno e Organograma. Essa permissão independe do departamento, função ou perfil." e "Organizado conforme a estrutura administrativa prevista no Estatuto e as atribuições dos departamentos detalhadas no Regimento Interno." Há o seletor de usuário com o botão **Testar acesso**, que leva a `/sistema/acesso/testar?usuario=<id>`.

**Usuários e Perfis** (visual): o título "Usuários e Perfis de Acesso", o texto "Cadastre usuários, defina o perfil institucional, o departamento e o status do acesso." e o botão **Cadastrar acesso**. A tabela é `Usuário | Perfil institucional | Departamento(s) | Nível | Biênio / validade | Status | Tipo de acesso | Ações` (Editar, Suspender, Testar acesso). O modal "Cadastrar Acesso" tem o texto "Defina o acesso digital conforme a função institucional exercida." e duas seções:
- **Usuário e perfil**: "Os campos com \* são obrigatórios."; Nome do usuário \*; **E-mail \*** (mantido no app); Trabalhador vinculado à Minha área ("Selecione a ficha da pessoa que utilizará este acesso. Não são criados vínculos apenas pela semelhança do nome."); Perfil institucional \*.
- **Vínculos e situação**: Departamento principal; Status do acesso; Departamentos adicionais (caixas de seleção); Observação. O rodapé traz a regra: "**Regra:** todo usuário cadastrado recebe automaticamente acesso de consulta e impressão ao **Estatuto, Regimento e Organograma**. Os demais acessos seguem o perfil institucional e os departamentos vinculados. Somente existe **1 Administrador do Sistema**, com poderes totais."

**Files:**
- Create: `supabase/migrations/202610151500_usuarios_departamento_principal.sql`
- Create: `lib/access-dashboard.ts`, `lib/access-dashboard.test.ts`
- Modify: `app/sistema/acesso/page.tsx`, `app/sistema/usuarios/user-manager.tsx`, `app/api/users/route.ts`, `app/api/users/[id]/route.ts`

**Interfaces:**
- Produces: as colunas `users.primary_department` (FK para `departments`, pode ser nula) e `users.notes` (até 500 caracteres); `accessKpis(users: { status: string; role_key: string }[])`; e `accessLevelBadges(level: { edit: number; read: number })` → `["N edição", "M consulta"]`. As APIs de usuário aceitam e devolvem `primary_department` e `notes`. O departamento principal entra em `user_departments` junto com os adicionais (confira a regra de `user_departments` em `app/api/users/route.ts`).

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, expect, it } from "vitest";
import { accessKpis } from "@/lib/access-dashboard";

describe("Painel do Controle de Acesso", () => {
  it("conta como no visual", () => {
    expect(accessKpis([
      { status: "active", role_key: "administrador" },
      { status: "active", role_key: "coordenador" },
      { status: "suspended", role_key: "trabalhador" },
      { status: "invited", role_key: "secretario" }
    ]).map((k) => [k.label, k.value])).toEqual([
      ["Usuários cadastrados", "4"], ["Acessos ativos", "2"], ["Acesso institucional", "1"], ["Suspensos", "1"], ["Administrador do Sistema", "1"]
    ]);
  });
});
```

Confira os valores reais de `users.status` no CHECK da migração inicial. Se "suspenso" tiver outro nome, ajuste o teste e a função juntos.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run lib/access-dashboard.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
/** Painel do Controle de Acesso (visual v215). Módulo puro. */
export function accessKpis(users: { status: string; role_key: string }[]) {
  const active = users.filter((u) => u.status === "active");
  return [
    { label: "Usuários cadastrados", value: String(users.length) },
    { label: "Acessos ativos", value: String(active.length) },
    { label: "Acesso institucional", value: String(active.filter((u) => u.role_key !== "administrador").length) },
    { label: "Suspensos", value: String(users.filter((u) => u.status === "suspended").length) },
    { label: "Administrador do Sistema", value: String(users.filter((u) => u.role_key === "administrador").length) }
  ];
}

export function accessLevelBadges(level: { edit: number; read: number }) {
  return [`${level.edit} edição`, `${level.read} consulta`];
}
```

- [ ] **Step 4: Rodar o teste**

Run: `pnpm vitest run lib/access-dashboard.test.ts`
Expected: PASS.

- [ ] **Step 5: Migração, APIs e modal**

A migração acrescenta as duas colunas. As APIs validam `primary_department` (uma chave de `departments` ou nula) e `notes`. No `user-manager.tsx`:
- o formulário de convite e edição vira o modal do visual (`<dialog>`), com as duas seções, na ordem e com os rótulos acima, mais o E-mail;
- a tabela passa a ter as 8 colunas, onde "Nível" usa `accessLevelBadges`, calculado pela matriz de páginas do perfil (há uma rota em `app/api/acesso/matriz`; leia-a), e "Tipo de acesso" é "Institucional" ou "Administrador";
- as ações Editar, Suspender (`status = "suspended"`, pela API de edição) e Testar acesso (link). As ações "Reenviar convite" e "Encerrar sessões" continuam, depois das do visual.

- [ ] **Step 6: Verificar e commitar**

Aplique a migração no banco local.

Run: `pnpm typecheck && pnpm lint && pnpm vitest run && node scripts/app-shots.mjs 1440 claro /sistema/acesso /sistema/acesso/usuarios`
Expected: tudo PASS. Abrir "Cadastrar acesso" mostra o modal igual a `tmp/visual-215-ref/acesso__access-users.png` (ou à captura do modal feita na Task 0), com o campo E-mail a mais.

```bash
git add supabase/migrations/202610151500_usuarios_departamento_principal.sql lib/access-dashboard.ts lib/access-dashboard.test.ts app/sistema/acesso app/sistema/usuarios app/api/users
git commit -m "feat: painel do acesso e modal de cadastro de acesso do visual v215"
```

### Task 26: Minha área

No visual, "Minha área" mostra o cadastro da pessoa, as contribuições e as escalas vinculadas. No app, `/sistema/conta` tem a conta (senha e sessões).

**Files:**
- Create: `app/api/minha-area/route.ts`
- Create: `lib/my-area.ts`, `lib/my-area.test.ts`
- Modify: `app/sistema/conta/page.tsx`, `app/sistema/conta/account-client.tsx`

**Interfaces:**
- Consumes: o vínculo entre usuário e ficha de trabalhador (o campo "Ficha de trabalhador" do `user-manager`; ache a coluna em `app/api/users/route.ts`).
- Produces: `GET /api/minha-area` → `{ worker: {...} | null, contributions: { month, status, amount_cents }[], scales: { date, activity, role }[] }`, com dados só do próprio usuário; e `upcoming(scales, today)`, as escalas a partir de hoje, ordenadas, no máximo 10.

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, expect, it } from "vitest";
import { upcoming } from "@/lib/my-area";

describe("Minha área", () => {
  it("mostra só as próximas escalas, em ordem, até 10", () => {
    const scales = Array.from({ length: 14 }, (_, i) => ({ date: `2026-11-${String(i + 1).padStart(2, "0")}`, activity: "Passe", role: "Passista" }));
    const list = upcoming([{ date: "2026-10-01", activity: "x", role: "y" }, ...scales.reverse()], "2026-10-14");
    expect(list).toHaveLength(10);
    expect(list[0].date).toBe("2026-11-01");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run lib/my-area.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
/** Minha área (visual v215): próximas escalas da pessoa. Módulo puro. */
export function upcoming<T extends { date: string }>(scales: T[], today: string) {
  return scales.filter((s) => s.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 10);
}
```

- [ ] **Step 4: Rodar o teste**

Run: `pnpm vitest run lib/my-area.test.ts`
Expected: PASS.

- [ ] **Step 5: API e tela**

A API usa `requireActor()` e só lê dados ligados ao próprio usuário:
- a ficha (`workers`, pelo vínculo do usuário);
- as contribuições do ano (a mesma fonte da grade da Tesouraria, filtrada pelo trabalhador);
- as escalas: `scale_assignments` com `worker_id` igual, mais o Culto no Lar como anfitrião, dirigente ou expositor, mais as escalas de limpeza (`cleaning_roster`) e de eventos (`event_shifts`), se tiverem `worker_id`; confira as colunas.

Sem vínculo, devolve `worker: null`, e a tela mostra "Seu acesso ainda não está vinculado a uma ficha de trabalhador. Peça à Secretaria para fazer o vínculo no Controle de Acesso."

Na página `/sistema/conta`, os cartões "Meu cadastro", "Minhas contribuições" e "Minhas escalas" vêm antes da parte de senha e sessões. O título da página passa a ser "Minha área".

- [ ] **Step 6: Verificar e commitar**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run && node scripts/app-shots.mjs 1440 claro /sistema/conta`
Expected: tudo PASS.

```bash
git add app/api/minha-area lib/my-area.ts lib/my-area.test.ts app/sistema/conta
git commit -m "feat: minha área com cadastro, contribuições e escalas"
```

### Task 27: Mobile como no visual

No visual, em 390 px:
- **Topo fixo**: o botão ☰ (abre o menu lateral como gaveta), a logo, "Lar da Bênção" e, abaixo, o nome do módulo atual.
- O menu lateral fica escondido até o ☰ ser tocado.
- As abas do módulo viram um cartão "Você está em" com um `<select>`, que navega ao mudar.
- **Barra inferior fixa**: Minha área, Início, Módulos (abre a gaveta) e Ajuda (abre o diálogo "Como usar"). O texto do diálogo é: "Use os quatro botões na parte inferior da tela: 1. **Minha área:** confira seu cadastro, suas contribuições e suas escalas vinculadas. 2. **Início:** acompanhe a agenda e as pendências dos módulos liberados. 3. **Módulos:** procure o departamento. A lista mostra os seus acessos. 4. Dentro do módulo, toque em **Você está em** para escolher a aba." O 5º item fala do salvamento automático, que o app não tem; não copie esse item.
- Nenhuma tela com rolagem horizontal na página. Hoje, `/sistema/patrimonio/limpeza` tem 906 px em 390.

**Files:**
- Create: `components/mobile-shell.tsx` (cliente: topo, gaveta, barra inferior e diálogo)
- Modify: `app/sistema/layout.tsx`, `components/sidebar.tsx` (aceita `open` e `onClose` no celular)
- Modify: `components/module-tabs.tsx` (renderiza também o seletor "Você está em")
- Modify: `app/globals.css`
- Test: `components/module-tabs.test.tsx`

**Interfaces:**
- Consumes: `activeTab` (fase 1) e a lista de módulos de `loadNavigation`.
- Produces: `<ModuleTabs>` com `<nav class="module-tabs">` (some abaixo de 720 px) e `<label class="module-tab-picker">Você está em<select>` (aparece abaixo de 720 px), que navega com `useRouter().push`.

- [ ] **Step 1: Escrever o teste que falha**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/sistema/doutrina/escalas", useRouter: () => ({ push: () => undefined }) }));

describe("seletor Você está em", () => {
  it("renderiza as abas e o seletor com a aba atual escolhida", async () => {
    const { ModuleTabs } = await import("@/components/module-tabs");
    const html = renderToStaticMarkup(<ModuleTabs label="Seções" current="/sistema/doutrina/escalas"
      tabs={[{ href: "/sistema/doutrina", label: "Painel" }, { href: "/sistema/doutrina/escalas", label: "Escala Mensal" }]} />);
    expect(html).toContain('class="module-tabs no-print"');
    expect(html).toContain("Você está em");
    expect(html).toMatch(/<option value="\/sistema\/doutrina\/escalas" selected="">Escala Mensal<\/option>/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run components/module-tabs.test.tsx`
Expected: FAIL (ainda não há "Você está em").

- [ ] **Step 3: Seletor**

Em `components/module-tabs.tsx`, dentro de `ModuleTabs`, depois do `<nav>`:

```tsx
<label className="module-tab-picker no-print">Você está em
  <select value={current ?? ""} onChange={(e) => router.push(e.target.value)}>
    {tabs.map((tab) => <option key={tab.href} value={tab.href}>{tab.label}</option>)}
  </select>
</label>
```

com `const router = useRouter();` (de `next/navigation`) e os dois envolvidos num fragmento.

- [ ] **Step 4: Rodar o teste**

Run: `pnpm vitest run components/module-tabs.test.tsx`
Expected: PASS.

- [ ] **Step 5: Casca mobile e CSS**

`components/mobile-shell.tsx` ("use client") recebe `moduleLabel` (o rótulo do módulo atual, calculado no layout pelo `pathname` contra `nav.modules`; como o layout é de servidor, passe a lista e calcule no cliente com `usePathname`). Ele renderiza:
- `<header class="mobile-top">`, com o botão ☰ (`aria-label="Abrir menu"`), a logo (`components/brand.tsx`), "Lar da Bênção" e o módulo;
- `<nav class="mobile-bottom" aria-label="Atalhos">`, com 4 botões e os ícones de `components/nav-icon.tsx` (Minha área → `/sistema/conta`; Início → `/sistema`; Módulos → abre a gaveta; Ajuda → `showModal()` do `<dialog class="mobile-help">`);
- o diálogo, com o texto acima.

A gaveta é o próprio `Sidebar`, com a classe `open` quando aberto, e fecha ao navegar.

CSS (medidas do bloco `#mobile-212` e de `theme-215/theme.css`, linhas 100 a 132):

```css
.mobile-top, .mobile-bottom, .module-tab-picker { display: none; }
@media (max-width: 720px) {
  .mobile-top { display: flex; align-items: center; gap: 12px; position: sticky; top: 0; z-index: 30; padding: 10px 14px; background: #fff; border-bottom: 1px solid #e1eaee; }
  .mobile-bottom { display: grid; grid-template-columns: repeat(4, 1fr); position: fixed; inset: auto 0 0 0; z-index: 30; background: #fff; border-top: 1px solid #e1eaee; padding: 6px 4px calc(6px + env(safe-area-inset-bottom)); }
  .mobile-bottom button, .mobile-bottom a { display: grid; justify-items: center; gap: 4px; min-height: 52px; font-size: 13px; font-weight: 700; color: #285870; background: none; border: 0; text-decoration: none; }
  .app-shell { grid-template-columns: 1fr; }
  .app-shell > .sidebar { position: fixed; inset: 0 auto 0 0; width: min(86vw, 320px); z-index: 40; transform: translateX(-100%); transition: transform .2s ease; overflow-y: auto; }
  .app-shell > .sidebar.open { transform: none; box-shadow: 0 0 0 100vmax rgba(0, 0, 0, .35); }
  .app-main { padding-bottom: 88px; }
  .app-main > * { min-width: 0; }
  .module-tabs { display: none; }
  .module-tab-picker { display: grid; gap: 8px; margin: 0 0 16px; padding: 14px 16px; background: #fff; border: 1px solid #dae5e9; border-radius: 13px; font-size: 14px; color: #617683; }
  .module-tab-picker select { min-height: 48px; font-size: 16px; }
  .table-wrap, .visual-table-scroll { overflow-x: auto; max-width: 100%; }
}
:root[data-theme="dark"] .mobile-top, :root[data-theme="dark"] .mobile-bottom, :root[data-theme="dark"] .module-tab-picker { background: var(--surface); border-color: var(--line); }
:root[data-theme="dark"] .mobile-bottom button, :root[data-theme="dark"] .mobile-bottom a { color: var(--blue-900); }
```

Confira o nome real da classe do menu lateral em `components/sidebar.tsx` (troque `.sidebar` se for outro) e as regras de `@media (max-width: …)` que já existem em `app/globals.css` (linhas 330 a 360), para não duplicar.

Ache a causa dos 906 px em `/sistema/patrimonio/limpeza`. Rode em 390 px o trecho de diagnóstico abaixo no console do navegador (ou num script Playwright) e corrija o elemento culpado com `min-width: 0` ou envolvendo-o em `.table-wrap`:

```js
[...document.querySelectorAll(".app-main *")].filter((e) => e.getBoundingClientRect().width > innerWidth && ![...e.children].some((c) => c.getBoundingClientRect().width > innerWidth)).map((e) => e.className)
```

- [ ] **Step 6: Varredura em 390 px**

Crie `scripts/mobile-sweep.mjs`: ele lê todas as rotas de `lib/module-pages.ts` (todas as abas de todos os módulos), mais as da Doutrina, da Infância, da Juventude e do Acesso, e chama o modelo `app-shots` em 390 px, imprimindo as que dão `ROLAGEM-HORIZONTAL`.

Run: `node scripts/mobile-sweep.mjs`
Expected: nenhuma linha com `ROLAGEM-HORIZONTAL`.

- [ ] **Step 7: Verificar e commitar**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run && node scripts/app-shots.mjs 390 claro /sistema /sistema/doutrina /sistema/patrimonio/limpeza`
Expected: tudo PASS; as capturas com o topo, o seletor e a barra inferior, como `tmp/visual-215-ref/mobile-doutrina.png`.

```bash
git add components/mobile-shell.tsx app/sistema/layout.tsx components/sidebar.tsx components/module-tabs.tsx components/module-tabs.test.tsx app/globals.css scripts/mobile-sweep.mjs
git commit -m "feat: casca mobile do visual v215 com seletor de abas e barra inferior"
```

### Task 28: Tema escuro da casca

O título da página (`.page-heading h1` com a cor fixa `#203e50`, em `app/globals.css`, linha 164) e o menu lateral ficam quase ilegíveis com `data-theme="dark"`.

**Files:**
- Modify: `app/globals.css`
- Create: `scripts/contrast-check.mjs`

- [ ] **Step 1: Medir o problema**

`scripts/contrast-check.mjs` faz login (o modelo `app-shots`), liga `data-theme="dark"` e, em `/sistema` e `/sistema/patrimonio`, calcula a razão de contraste WCAG entre `color` e o fundo efetivo (sobe na árvore até achar um `background-color` opaco) para `.page-heading h1`, `.page-heading p` e todos os links do menu lateral. Ele imprime os que ficam abaixo de 4,5:1 e sai com código 1 se houver algum.

Run: `node scripts/contrast-check.mjs`
Expected: FAIL, listando `.page-heading h1` e os itens do menu lateral.

- [ ] **Step 2: Corrigir**

No bloco `:root[data-theme="dark"]` de `app/globals.css`, acrescente regras para:
- `.page-heading h1 { color: var(--blue-900); }`;
- `.page-heading p { color: var(--muted); }`;
- o fundo, o texto e o item ativo do menu lateral (veja as classes em `components/sidebar.tsx`), usando `--surface`, `--surface-sunken`, `--blue-900`, `--muted` e `--line`;
- o mesmo para as outras cores fixas `#203e50`, `#617683` e `#526f7e` que aparecerem no checador.

- [ ] **Step 3: Medir de novo e commitar**

Run: `node scripts/contrast-check.mjs && pnpm lint`
Expected: PASS, nenhum item abaixo de 4,5:1.

```bash
git add app/globals.css scripts/contrast-check.mjs
git commit -m "fix: título e menu lateral legíveis no tema escuro"
```

### Task 29: Conferência final tela a tela

**Files:**
- Create: `scripts/visual-compare.mjs`
- Create: `tests/e2e/paridade-v215.spec.ts` (não destrutivo: não usa o `global-setup` de reset)

- [ ] **Step 1: Comparador lado a lado**

`scripts/visual-compare.mjs` lê `tmp/visual-215-ref/reference.json` e um mapa fixo `PAINEL_PARA_ROTA` (escreva-o no script: `"home/": "/sistema"`, `"documentos/": "/sistema/documentos"`, `"organograma/": "/sistema/organograma"`, `"doutrina/p-dash": "/sistema/doutrina"`, `"doutrina/p-caravana-lar": "/sistema/doutrina/caravana"` e assim por diante, para todas as abas de todas as páginas do `reference.json`). Para cada par, ele captura o app em 1440 px e grava `tmp/compare/<pagina>__<aba>.html`, uma página com as duas imagens lado a lado e, abaixo, as listas de rótulos de aba, colunas e campos de cada lado (os do visual vêm de `panels.json`; os do app saem do DOM, com o mesmo `dump`), marcando em vermelho o que existe só de um lado. No fim, grava `tmp/compare/index.html`, com o resumo e a contagem de diferenças por aba.

Run: `node scripts/visual-compare.mjs`
Expected: `tmp/compare/index.html` gerado. Em cada aba, as diferenças restantes são só as permitidas: o E-mail no modal de acesso, textos de demonstração ausentes no app e números de exemplo.

- [ ] **Step 2: Spec E2E não destrutivo**

`tests/e2e/paridade-v215.spec.ts` não usa `global-setup.ts`. Configure-o no topo com `test.describe.configure({ mode: "serial" })` e com o login do admin local por variáveis de ambiente (`LOCAL_ADMIN_EMAIL` e `LOCAL_ADMIN_PASSWORD`; se faltarem, `test.skip`). Para cada rota do `PAINEL_PARA_ROTA`, ele confere status menor que 400, ausência de "Não foi possível carregar esta página" e a lista de abas igual à do `reference.json`. Para rodar sem o reset, crie `playwright.paridade.config.ts`, uma cópia de `playwright.config.ts` sem `globalSetup` e com `testMatch: /paridade-v215/`.

Run: `pnpm exec playwright test -c playwright.paridade.config.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add scripts/visual-compare.mjs tests/e2e/paridade-v215.spec.ts playwright.paridade.config.ts
git commit -m "test: conferência de paridade com o visual v215"
```

---

## Depois de tudo

1. Rodar o checklist de go-live (`docs/GO_LIVE.md`) e aplicar as migrações novas em produção com `scripts/migrate.sh`, na ordem do nome.
2. Ligar as flags que estiverem desligadas em produção, em "Módulos e ondas".
3. Abrir o PR para a `main` com o `tmp/compare/index.html` anexado (fora do repositório).
