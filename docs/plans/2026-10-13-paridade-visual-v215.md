# Paridade completa do `/sistema` com o visual v215 — plano mestre

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada página, aba e formulário que o `/visual` (HTML v215) mostra no estado final passa a existir no `/sistema`, com o mesmo desenho e a mesma ordem. Os dados continuam vindo do Postgres, com as permissões que o app já tem.

**Architecture:** O HTML é só a referência de tela e de regra. Nada dele é embutido no app. A casca comum já está pronta (commits de 08–09/10): menu, topo e Visão Geral. Este plano faz em seguida a camada comum dos módulos, que é a fase 1, detalhada aqui: abas, "Sobre o departamento", "Sugestões e melhorias" e o Painel de cada departamento. Depois vem módulo por módulo, nas fases 2 a 6. Cada uma dessas fases ganha um plano detalhado próprio, escrito logo antes de ser executada, porque depende dos componentes da fase 1.

**Tech Stack:** Next.js 16.3 (App Router), React 19.3, Postgres (Supabase), Vitest e Playwright (`@playwright/test`). Antes de usar qualquer API do Next, leia o guia em `node_modules/next/dist/docs/`.

**Spec:** este documento. A seção "Inventário de lacunas" faz o papel de spec. Referência visual: `public/visual-v215.html` (igual a `dist/index.html`), servido em `https://sistema.lardabencao.org/visual`.

---

## Antes de tudo: o que o histórico mostra

- `public/visual-v215.html` é uma cópia byte a byte de `dist/index.html`, feita por `scripts/copy-visual.mjs`. O último commit que mexeu em `dist/index.html` é `23b253b`, de **16/09/2026**.
- O app Next (v216) começou em `ee9621b`, também de 16/09, e foi construído **a partir** desse HTML. Os comentários do código dizem "paridade com o mock v215".
- Portanto o HTML que está no repositório **não é posterior** ao app. A diferença entre os dois são telas e abas que o app ainda não implementou, e não uma versão mais nova do HTML.
- Se o dev iniciante tem um HTML mais novo fora do repositório, ele precisa ser colocado em `dist/index.html` **antes** da Task 1. Todo o inventário abaixo foi tirado do arquivo atual.

## Por que o `/visual` "evolui" ao abrir

O HTML tem cerca de 70 blocos `<script>`, um por versão (v138 … v215). Cada um sobrescreve `go()` ou re-renderiza painéis por cima do anterior. Por isso a tela passa pelas versões antigas até a última camada (`lar-theme-215-script`) terminar. Há sinais disso no próprio estado final, como a linha "Salvo automaticamente…" que aparece duas vezes.

**Regra deste plano:** a referência é o estado **depois de 15 s** de carregamento. A Task 1 grava esse estado. Nenhuma camada intermediária vale como referência, e nada do mecanismo de camadas é portado.

## Global Constraints

- Não trocar páginas do `/sistema` por iframe, rewrite ou cópia de trechos do HTML. Copiar medidas, textos e ordem, sim. Copiar o mecanismo (localStorage, IndexedDB, `go()`, `activateDepartmentPanel`), não.
- Dados só no Postgres via `lib/db.ts`. Nada de `localStorage` para dado de negócio.
- Não gravar no app "Demonstração Funcional", "dados fictícios", "Restaurar dados fictícios", "Carregar extrato fictício" nem números da demonstração. A frase "Ambiente de teste · dados fictícios" só aparece quando `runtimeEnvironment().production` é falso.
- Toda aba nova respeita `hasPermission`, as flags (`lib/feature-flags.ts`) e `SECTOR_ROLE_RESOURCE`. Aba sem permissão não aparece.
- O formulário de usuário mantém o campo **E-mail**: o login é pelo Supabase Auth. O HTML não tem esse campo; no app ele fica.
- Não rodar `tests/e2e/fundacao-onda1.spec.ts`. Ele chama `supabase db reset` e apaga o banco local.
- Não commitar `public/visual-v215.html`, `test-results/` nem `tmp/`.
- Tema claro é o padrão. O escuro só vale com `data-theme="dark"`, e todo CSS novo precisa da variante escura em `app/globals.css`.
- Commits só se o Ryan pedir nesta sessão. Se pedir, uma mensagem por tarefa, no estilo do repositório (`feat:` / `fix:` em português).
- Migração nova: arquivo em `supabase/migrations/AAAAMMDDHHMM_nome.sql`, idempotente (`if not exists`), com `grant` para `lar_app`.

## Review Focus

1. **Perfil de setor (Brechó / Clube de Mães) entrando num módulo.** A aba "Painel" nova não pode aparecer para ele, e ele continua caindo direto na aba do próprio setor. (Teste na Task 5.)
2. **Links antigos para a raiz do módulo** (`/sistema/tesouraria`, `/sistema/eventos`, `/sistema/secretaria`, `/sistema/conselhofiscal`), vindos da pendência, da agenda e da Visão Geral. Depois que o Painel vira a raiz, cada um precisa abrir a aba certa e não um 404. (Teste na Task 5.)
3. **Módulo sem departamento** (Tesouraria, Secretaria, Conselho Fiscal, Presidência). O Painel conta trabalhadores pela chave certa (`tesouraria`, `secretaria`, `conselho_fiscal`, `diretoria`) e não quebra quando `page.access.department` é `undefined`. (Teste na Task 5.)
4. **Tela de 390 px.** As abas quebram linha ou rolam na horizontal sem estourar a largura, como no `.sub` do HTML. (Verificação visual na Task 3.)
5. **Tema escuro.** As abas, o "Sobre o departamento" e o Painel continuam legíveis com `data-theme="dark"`. (Verificação visual na Task 4.)

---

## Inventário de lacunas (estado final do HTML × app de hoje)

Legenda: ✅ existe · 🎨 existe, mas com desenho ou ordem diferente · 🔌 o componente ou a API existe, só falta ligar a aba · 🗄 a tabela existe, falta API e tela · ❌ não existe.

Comum a todos os módulos (fase 1):

| Peça | HTML | App |
| --- | --- | --- |
| Barra de abas | `.sub` em pílulas; a ativa fica azul `#356f8f` | 🎨 `row-actions` com botões |
| "Sugestões e melhorias" | `<details>` em toda página | 🎨 só na Visão Geral |
| "Sobre o departamento — …" | `<details>` no Painel, com `DEPT_PANEL_INFO` | ❌ |
| Aba "Painel" | primeira aba em todos os departamentos | ❌ em 8 módulos |

Por módulo (a ordem das abas é a do HTML):

| Módulo | Abas do HTML | Situação no app |
| --- | --- | --- |
| Controle de Acesso | Painel · Biênio / Gestão · Usuários e Perfis · Matriz de Permissões · Dedo-duro / Histórico · Testar Acessos · Sugestões e Melhorias · Backup e restauração | 🎨 essas telas existem espalhadas em `/sistema/acesso`, `/usuarios`, `/auditoria`, `/sugestoes` e `/importacao`, sem abas comuns e sem Painel ❌. O formulário "Cadastrar Acesso" é um modal com as seções "Usuário e perfil" e "Vínculos e situação" 🎨 |
| Presidência (Diretoria) | Painel · Aprovação de Trabalhadores · Situação dos Módulos · Trabalhadores · Relatório Anual · Autorizações de Baixa | ✅ Painel, Baixas, Aprovação (atalho) · ❌ Situação dos Módulos · 🔌 Trabalhadores e Relatório (`DepartmentWorkers`, `AnnualReport`) · app tem "Sugestões" a mais |
| Secretaria | Reuniões e Atas · Painel · Acompanhar admissões · Trabalhadores · Aniversariantes · Relatório Anual | ✅ Reuniões, Admissões, Aniversariantes · ❌ Painel · 🔌 Trabalhadores e Relatório · app tem "Gravador" separado (no HTML ele fica dentro de Reuniões) |
| Tesouraria | Painel · Contribuições · Mantenedores · Plano de Contas · Caixa Mensal · Conselho Fiscal · Aniversariantes · Relatório Anual · WhatsApp · Extrato Bancário | ✅ quase tudo · ❌ Painel · ❌ aba "Conselho Fiscal" (envio do mês) · 🎨 ordem · app tem "Lançamentos" e "Doações recebidas" a mais (ficam) |
| Conselho Fiscal | Painel · Análise Mensal · Parecer · Histórico · Relatório Anual | 🎨 uma aba só, "Análises e Pareceres" · ❌ Painel · 🔌 Relatório |
| Doutrina | Painel · Trabalhadores · Palestrantes Externos · Biblioteca de Estudos · Escala Mensal · Frequência · Culto no Lar · Caravana no Lar · Planejamento de Treinamentos · WhatsApp · Relatório Anual | ✅ seis primeiras e Culto · 🎨 Painel (os KPIs do HTML são Trabalhadores ativos, Posições, Preenchidas, Frequência no mês, Média/encontro, Conflitos) · 🗄 Caravana no Lar (`app.caravana_activities`, `lib/doutrina-caravana-form.ts`) · 🗄 Planejamento de Treinamentos (`app.doctrine_trainings`, `app.doctrine_training_sessions`, `lib/doutrina-extras.ts`) · 🔌 WhatsApp (`WhatsappQueue scope="doutrina"`) · 🔌 Relatório Anual |
| Infância | Painel · Evangelizandos · Aniversariantes · Evangelizadores · Biblioteca · Frequência · Cronograma · Planejamento Anual · Relatório Anual | ✅ quase todas · 🔌 Evangelizadores (hoje é um link para `/sistema/trabalhadores`) |
| Juventude | Painel · Evangelizandos · Evangelizadores · Biblioteca · Frequência · Cronograma · Planejamento Anual · Relatório Anual · Aniversariantes | igual à Infância; Aniversariantes fica por último |
| Assistência e Promoção Social | Painel · Rancho dos Evangelizandos · Doação de Rancho · Relação de Entrega · Cadastro de Voluntários · Mantenedores da Cesta Básica · Doadores do Café das Crianças · Trabalhadores · Aniversariantes · Relatório Anual · Brechó · Clube de Mães · Planejamento Anual · Controle de Atividades | ❌ Painel · ❌ Doação de Rancho · ❌ Relação de Entrega (o app só tem o cadastro "Rancho") · 🎨 Clube de Mães (o app tem 3 abas; o HTML tem 1 com sub-abas) · Kits e Sopa ficam dentro de Controle de Atividades, sem aba própria, como no HTML · app tem "Famílias" a mais (fica) |
| Patrimônio | Painel · Cadastro de Bens · Trabalhadores · Relatório Anual · Autorização de Baixa · Escala de Limpeza | ✅ tudo · ❌ Painel · 🎨 ordem · app tem "Aniversariantes" a mais (fica) |
| Eventos | Painel · Agenda de Eventos · Itens do Evento · Avaliação do Evento · Escala de Trabalho · Trabalhadores · Relatório Anual | ✅ tudo · ❌ Painel · 🎨 ordem e rótulos ("Itens" → "Itens do Evento", "Avaliação" → "Avaliação do Evento") |
| Divulgação | Painel · Trabalhadores · Relatório Anual · Controle da Livraria | 🎨 o app abre a livraria em 4 abas (Obras, Estoque, Empréstimos, Vendas). No HTML elas ficam dentro de "Controle da Livraria" |
| Jurídico | Painel · Eleições · Relatório Anual | ✅ Eleições, Relatório · ❌ Painel · ❓ geração dos documentos Word das eleições (`ElectionDocumentEngine`, 457 KB no HTML): conferir na fase 5 |
| Organograma, Estatuto e Regimento | sem abas | ✅ (a conferência visual fica na fase 6) |
| Mobile | barra inferior `.mb-bottom`, seletor de abas `.mb-tab-picker` | ❌ (fase 6) |

## Fases

| Fase | Entrega | Plano |
| --- | --- | --- |
| 1 | Referência gravada, abas, "Sobre", "Sugestões" e Painel genérico em todos os módulos | **detalhada abaixo** (Tasks 1–5) |
| 2 | Doutrina: Caravana no Lar, Planejamento de Treinamentos, WhatsApp, Relatório Anual, KPIs do Painel | `docs/plans/AAAA-MM-DD-paridade-v215-doutrina.md` |
| 3 | Assistência: Doação de Rancho, Relação de Entrega, Clube de Mães numa aba, Painel com os números do setor | `…-assistencia.md` |
| 4 | Tesouraria (aba Conselho Fiscal, Painel) e Conselho Fiscal (4 abas + Relatório) | `…-tesouraria-conselho.md` |
| 5 | Presidência (Situação dos Módulos, Trabalhadores, Relatório), Secretaria (Trabalhadores, Relatório, Gravador dentro de Reuniões), Jurídico (documentos Word), Infância e Juventude (Evangelizadores), Divulgação (Controle da Livraria) | `…-diretoria-secretaria-juridico.md` |
| 6 | Controle de Acesso com abas, Painel e modal "Cadastrar Acesso"; mobile (`.mb-bottom`); conferência final tela a tela contra a referência | `…-acesso-mobile.md` |

Cada plano das fases 2 a 6 parte do arquivo `tmp/visual-215-ref/reference.json` e das capturas geradas na Task 1. Ele lista os campos de cada formulário do HTML (tirados com o mesmo script) e traz migração, API, componente e testes no formato das tasks abaixo.

## Arquivos da fase 1

- Criar: `scripts/visual-reference.mjs`, que grava o estado final do HTML (menu, abas, campos e capturas).
- Criar: `scripts/extract-department-info.mjs`, que gera `lib/department-info.ts` a partir de `DEPT_PANEL_INFO`.
- Criar: `lib/department-info.ts` (gerado) e `lib/department-info.test.ts`.
- Criar: `lib/module-tabs.ts` e `lib/module-tabs.test.ts`, com as funções puras das abas.
- Criar: `components/module-tabs.tsx`, `components/department-about.tsx` e `components/suggestions-box.tsx`.
- Criar: `lib/department-dashboard.ts`, `lib/department-dashboard.test.ts` e `components/modules/department-dashboard.tsx`.
- Criar: `app/sistema/doutrina/layout.tsx`, com as abas da Doutrina.
- Modificar: `app/sistema/[modulo]/[[...secao]]/page.tsx`, `lib/module-pages.ts`, `components/education/education-nav.tsx`, `app/sistema/doutrina/page.tsx`, `app/sistema/home-client.tsx`, `app/globals.css`, `app/api/pendencias/route.ts` e `app/api/agenda/route.ts`.

---

### Task 1: Gravar a referência do estado final do HTML

**Files:**
- Create: `scripts/visual-reference.mjs`

**Interfaces:**
- Produces: `tmp/visual-215-ref/reference.json` no formato `{ nav: string[], pages: Record<string, { tabs: { panel: string, label: string }[] }> }` e capturas `tmp/visual-215-ref/<pagina>__<aba>.png`. As fases 2–6 leem esses arquivos.

- [ ] **Step 1: Escrever o script**

```js
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
```

- [ ] **Step 2: Rodar**

Run: `node scripts/visual-reference.mjs`
Expected: `16 páginas gravadas em …/tmp/visual-215-ref`. Em `reference.json`, `pages.doutrina.tabs` tem 11 itens e o último é `{ "panel": "p-relatorio", "label": "Relatório Anual" }`. A Tesouraria pode vir com `tabs: []`, porque a navegação dela não usa `data-panel`. Isso fica registrado no plano da fase 4, que lê a Tesouraria pelas capturas.

- [ ] **Step 3: Conferir 3 capturas**

Abrir `tmp/visual-215-ref/home.png`, `doutrina.png` e `acesso__access-users.png`. Nenhuma pode mostrar uma versão antiga, como um título "Versão 13x" no topo da página.

- [ ] **Step 4: Commit (só se o Ryan pediu commits)**

```bash
git add scripts/visual-reference.mjs
git commit -m "chore: gravar a referência do estado final do visual v215"
```

---

### Task 2: Texto de "Sobre o departamento" gerado do HTML

**Files:**
- Create: `scripts/extract-department-info.mjs`
- Create: `lib/department-info.ts` (gerado e commitado)
- Test: `lib/department-info.test.ts`

**Interfaces:**
- Produces: `type DepartmentInfo = { title: string; basis: string; purpose: string; activities: string[]; flow: string }`, `DEPARTMENT_INFO: Record<DepartmentInfoKey, DepartmentInfo>`, `type DepartmentInfoKey = "doutrina" | "infancia" | "juventude" | "assistencia" | "tesouraria" | "conselhofiscal" | "patrimonio" | "eventos" | "divulgacao" | "juridico" | "secretaria" | "presidencia"`, `departmentInfoFor(moduleSlug: string): DepartmentInfo | null`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, expect, it } from "vitest";
import { DEPARTMENT_INFO, departmentInfoFor } from "@/lib/department-info";

describe("quadro dos departamentos", () => {
  it("tem os 12 departamentos do visual, todos preenchidos", () => {
    expect(Object.keys(DEPARTMENT_INFO)).toHaveLength(12);
    for (const info of Object.values(DEPARTMENT_INFO)) {
      expect(info.title).not.toBe("");
      expect(info.purpose).not.toBe("");
      expect(info.activities.length).toBeGreaterThan(0);
    }
  });

  it("traz a base normativa da Doutrina igual ao visual", () => {
    expect(DEPARTMENT_INFO.doutrina.basis).toBe("Regimento Interno — arts. 39 a 49");
    expect(DEPARTMENT_INFO.doutrina.title).toBe("Dpto de Doutrina");
  });

  it("acha o quadro pelo slug do módulo e devolve null para página sem departamento", () => {
    expect(departmentInfoFor("assistencia")?.title).toContain("Assist");
    expect(departmentInfoFor("presidencia")).toBe(DEPARTMENT_INFO.presidencia);
    expect(departmentInfoFor("documentos")).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run lib/department-info.test.ts`
Expected: FAIL com `Failed to resolve import "@/lib/department-info"`.

- [ ] **Step 3: Escrever o extrator**

```js
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
```

- [ ] **Step 4: Gerar e rodar o teste**

Run: `node scripts/extract-department-info.mjs && pnpm vitest run lib/department-info.test.ts`
Expected: `lib/department-info.ts: 12 departamentos` e 3 testes PASS.

- [ ] **Step 5: Conferir o texto gerado**

Run: `grep -c "Demonstra\|fictíc" lib/department-info.ts`
Expected: `0`. Se o número for diferente de 0, apague a frase no extrator (com `replace`) e gere de novo.

- [ ] **Step 6: Commit (só se o Ryan pediu commits)**

```bash
git add scripts/extract-department-info.mjs lib/department-info.ts lib/department-info.test.ts
git commit -m "feat: trazer o quadro Sobre o departamento do visual v215"
```

---

### Task 3: Barra de abas igual ao `.sub` do visual

**Files:**
- Create: `lib/module-tabs.ts`
- Test: `lib/module-tabs.test.ts`
- Create: `components/module-tabs.tsx`
- Create: `app/sistema/doutrina/layout.tsx`
- Modify: `app/sistema/[modulo]/[[...secao]]/page.tsx` (o `<nav className="row-actions">`)
- Modify: `components/education/education-nav.tsx`
- Modify: `app/sistema/doutrina/page.tsx` (remove a grade de cards `doutrinaSubnav` e o `<header>`, que passa para o layout)
- Modify: `lib/modules.ts` (`doutrinaSubnav` ganha o Painel e segue a ordem do HTML)
- Modify: `app/globals.css`

**Interfaces:**
- Produces: `type Tab = { href: string; label: string }`, `activeTab(pathname: string, tabs: readonly Tab[]): Tab | undefined` (o prefixo mais longo vence, e a raiz só casa com igualdade exata), `<ModuleTabs tabs={Tab[]} current={string} label={string} />` (componente de servidor) e `<ModuleTabsByPath tabs label />` (cliente, usa `usePathname`).

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, expect, it } from "vitest";
import { activeTab } from "@/lib/module-tabs";

const tabs = [
  { href: "/sistema/doutrina", label: "Painel" },
  { href: "/sistema/doutrina/escalas", label: "Escala Mensal" },
  { href: "/sistema/doutrina/frequencia", label: "Frequência" }
];

describe("aba ativa", () => {
  it("marca o Painel só na raiz exata", () => {
    expect(activeTab("/sistema/doutrina", tabs)?.label).toBe("Painel");
    expect(activeTab("/sistema/doutrina/", tabs)?.label).toBe("Painel");
  });
  it("marca a aba pelo prefixo, inclusive em subpáginas", () => {
    expect(activeTab("/sistema/doutrina/escalas/imprimir", tabs)?.label).toBe("Escala Mensal");
  });
  it("não marca nada fora do módulo", () => {
    expect(activeTab("/sistema/infancia", tabs)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run lib/module-tabs.test.ts`
Expected: FAIL com `Failed to resolve import "@/lib/module-tabs"`.

- [ ] **Step 3: Implementar a função pura**

```ts
/** Abas dos módulos: qual aba está ativa para um caminho. Módulo puro. */
export type Tab = { href: string; label: string };

export function activeTab(pathname: string, tabs: readonly Tab[]): Tab | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const root = tabs.reduce((a, b) => (a.href.length <= b.href.length ? a : b), tabs[0]);
  let best: Tab | undefined;
  for (const tab of tabs) {
    const hit = tab === root ? path === tab.href : path === tab.href || path.startsWith(`${tab.href}/`);
    if (hit && (!best || tab.href.length > best.href.length)) best = tab;
  }
  return best;
}
```

- [ ] **Step 4: Rodar o teste**

Run: `pnpm vitest run lib/module-tabs.test.ts`
Expected: 3 PASS.

- [ ] **Step 5: Componente e CSS**

`components/module-tabs.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeTab, type Tab } from "@/lib/module-tabs";

/** Barra de abas no desenho do `.sub` do visual v215. */
export function ModuleTabs({ tabs, current, label }: { tabs: readonly Tab[]; current: string | undefined; label: string }) {
  return (
    <nav className="module-tabs no-print" aria-label={label}>
      {tabs.map((tab) => (
        <Link key={tab.href} href={tab.href} className={tab.href === current ? "active" : undefined}
          aria-current={tab.href === current ? "page" : undefined}>{tab.label}</Link>
      ))}
    </nav>
  );
}

export function ModuleTabsByPath({ tabs, label }: { tabs: readonly Tab[]; label: string }) {
  const pathname = usePathname();
  return <ModuleTabs tabs={tabs} current={activeTab(pathname, tabs)?.href} label={label} />;
}
```

Acrescentar ao fim de `app/globals.css` (medidas do `.main .sub button` em `theme-215/theme.css:32-34`):

```css
/* Abas dos módulos — .sub do visual v215 */
.module-tabs { display: flex; flex-wrap: wrap; gap: 7px; margin: 0 0 16px; padding-bottom: 16px; border-bottom: 1px solid #e1eaee; }
.module-tabs a { display: inline-flex; align-items: center; min-height: 44px; padding: 10px 14px; border-radius: 10px; border: 1px solid transparent; font-size: 14px; font-weight: 700; color: #526f7e; text-decoration: none; }
.module-tabs a:hover { background: #eaf3f6; }
.module-tabs a.active { color: #fff; background: #356f8f; border-color: #356f8f; }
@media (max-width: 720px) {
  .module-tabs { flex-wrap: nowrap; overflow-x: auto; scroll-snap-type: x mandatory; gap: 6px; }
  .module-tabs a { flex: 0 0 auto; white-space: nowrap; scroll-snap-align: start; }
}
:root[data-theme="dark"] .module-tabs { border-color: var(--line); }
:root[data-theme="dark"] .module-tabs a { color: var(--muted); }
:root[data-theme="dark"] .module-tabs a:hover { background: var(--button-hover); }
:root[data-theme="dark"] .module-tabs a.active { color: #fff; background: var(--blue-800); border-color: var(--blue-800); }
```

Antes de colar, confirme que `--line`, `--muted`, `--button-hover` e `--blue-800` existem no bloco do tema escuro de `app/globals.css` (`grep -n "data-theme=\"dark\"" app/globals.css`). Se `--muted` não existir lá, use a variável de texto secundário que o bloco define.

- [ ] **Step 6: Usar nas três telas**

Em `app/sistema/[modulo]/[[...secao]]/page.tsx`, trocar o bloco `<nav className="row-actions …">…</nav>` por:

```tsx
<ModuleTabs label={`Seções de ${page.title}`}
  tabs={visible.map((s) => ({ href: `/sistema/${page.slug}${s.slug ? `/${s.slug}` : ""}`, label: s.label }))}
  current={`/sistema/${page.slug}${current.slug ? `/${current.slug}` : ""}`} />
```

com `import { ModuleTabs } from "@/components/module-tabs";`, removendo o `import Link` se ele ficar sem uso.

Em `components/education/education-nav.tsx`, manter a lista `tabs` e renderizar:

```tsx
<ModuleTabs label="Seções do departamento" current={`/sistema/${department}${current ? `/${current}` : ""}`}
  tabs={tabs.map(([path, label]) => ({ href: `/sistema/${department}${path ? `/${path}` : ""}`, label }))} />
```

O link "Evangelizadores (fichas)" continua até a fase 5, que o transforma em aba. Por enquanto ele fica como `<p><Link className="button" …>` logo abaixo da barra.

Em `lib/modules.ts`, `doutrinaSubnav` passa a ser:

```ts
export const doutrinaSubnav = [
  { href: "/sistema/doutrina", label: "Painel" },
  { href: "/sistema/doutrina/trabalhadores", label: "Trabalhadores" },
  { href: "/sistema/doutrina/palestrantes", label: "Palestrantes Externos" },
  { href: "/sistema/doutrina/estudos", label: "Biblioteca de Estudos" },
  { href: "/sistema/doutrina/escalas", label: "Escala Mensal" },
  { href: "/sistema/doutrina/frequencia", label: "Frequência" },
  { href: "/sistema/doutrina/culto-lar", label: "Culto no Lar" }
] as const;
```

Antes de mudar, rode `grep -rn doutrinaSubnav app components lib` para achar quem mais usa a lista e confirmar que nenhum outro uso depende de ela não ter o Painel.

`app/sistema/doutrina/layout.tsx` (leia `node_modules/next/dist/docs/` sobre layouts aninhados antes):

```tsx
import { ModuleTabsByPath } from "@/components/module-tabs";
import { doutrinaSubnav } from "@/lib/modules";

export default function DoutrinaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="page-heading">
        <div><h1>Dpto de Doutrina</h1><p>Treinamentos, escalas, estudos, palestras, Culto no Lar e trabalhadores.</p></div>
      </header>
      <ModuleTabsByPath tabs={doutrinaSubnav} label="Seções da Doutrina" />
      {children}
    </>
  );
}
```

Em seguida, tirar o `<header className="page-heading">` de cada `app/sistema/doutrina/*/page.tsx` que tiver um, porque o layout já mostra o cabeçalho. Ache os arquivos com `grep -ln 'page-heading' app/sistema/doutrina -r`. A página de impressão `escalas/imprimir` fica de fora da barra: confira se ela já tem a classe `no-print` ou se tem layout próprio, e se não tiver, mova a página de impressão para um grupo de rotas. Em `app/sistema/doutrina/page.tsx`, apagar o `<header>` e a grade final `doutrinaSubnav.map(...)`.

- [ ] **Step 7: Verificar**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run`
Expected: sem erros, e todos os testes PASS.

Run: `pnpm dev`, entrar com o usuário local (veja `docs/LOCAL_SETUP.md`) e abrir `/sistema/doutrina/escalas`, `/sistema/patrimonio/limpeza` e `/sistema/infancia/frequencia` em 1440 px e em 390 px.
Expected: a aba ativa fica azul `#356f8f`, com texto branco. Em 390 px as abas rolam para o lado sem barra horizontal na página. Comparar com `tmp/visual-215-ref/doutrina.png`.

- [ ] **Step 8: Commit (só se o Ryan pediu commits)**

```bash
git add lib/module-tabs.ts lib/module-tabs.test.ts components/module-tabs.tsx app/sistema/doutrina app/sistema/\[modulo\] components/education/education-nav.tsx lib/modules.ts app/globals.css
git commit -m "feat: abas dos módulos no desenho do visual v215"
```

---

### Task 4: "Sugestões e melhorias" e "Sobre o departamento" em todos os módulos

**Files:**
- Create: `components/suggestions-box.tsx`
- Create: `components/department-about.tsx`
- Modify: `app/sistema/home-client.tsx:292-298` (passa a usar `SuggestionsBox`)
- Modify: `app/sistema/[modulo]/[[...secao]]/page.tsx`, `app/sistema/doutrina/layout.tsx`, `components/education/education-nav.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `departmentInfoFor(slug)` e `DepartmentInfo` (Task 2).
- Produces: `<SuggestionsBox />` e `<DepartmentAbout info={DepartmentInfo} coordinators={string[]} />`. A fase 2 em diante coloca `DepartmentAbout` no topo de cada Painel.

- [ ] **Step 1: Extrair `SuggestionsBox`**

```tsx
import Link from "next/link";

/** Caixa recolhível "Sugestões e melhorias", presente em toda página do visual v215. */
export function SuggestionsBox() {
  return (
    <details className="visual-suggestions">
      <summary><span>Sugestões e melhorias</span><span className="visual-suggestions-hint">Enviar uma ideia ou acompanhar</span></summary>
      <div className="sg-heading">
        <p>O que você escrever chega à Diretoria. Você acompanha a resposta na central de sugestões.</p>
        <Link className="button primary" href="/sistema/sugestoes">Enviar sugestão</Link>
      </div>
    </details>
  );
}
```

Em `home-client.tsx`, trocar o `<details className="visual-suggestions">…</details>` por `<SuggestionsBox />`.

- [ ] **Step 2: Criar `DepartmentAbout`**

```tsx
import type { DepartmentInfo } from "@/lib/department-info";

/** "Sobre o departamento — …": quadro recolhível do Painel (op-department do visual v215). */
export function DepartmentAbout({ info, coordinators }: { info: DepartmentInfo; coordinators: string[] }) {
  return (
    <details className="op-department">
      <summary>
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
        <span>Sobre o departamento — {info.title}<small>Coordenação, atividades e orientações institucionais</small></span>
      </summary>
      <div className="dept-board">
        <div className="dept-board-head">
          <h3>Quadro do Departamento — {info.title}</h3>
          <p>{info.purpose}</p>
          {info.basis ? <p className="small"><strong>Base normativa:</strong> {info.basis}</p> : null}
        </div>
        <div className="dept-board-grid">
          <section className="dept-board-card">
            <h4>Quem coordena</h4>
            <p>{coordinators.length ? coordinators.join(" / ") : "Sem coordenador vinculado"}</p>
            <p className="small muted">Preenchimento automático conforme o perfil e o departamento dos usuários ativos no Controle de Acesso.</p>
          </section>
          <section className="dept-board-card">
            <h4>Principais atividades</h4>
            <ul>{info.activities.map((a) => <li key={a}>{a}</li>)}</ul>
          </section>
          {info.flow ? (
            <section className="dept-board-card">
              <h4>Fluxo resumido</h4>
              <p>{info.flow}</p>
            </section>
          ) : null}
        </div>
      </div>
    </details>
  );
}
```

CSS, ao fim de `app/globals.css` (valores do bloco `lar-operational-v210` do HTML):

```css
/* Sobre o departamento — op-department do visual v215 */
.op-department { border: 1px solid #d7e4ed; border-radius: 11px; background: #fff; margin: 0 0 20px; overflow: hidden; }
.op-department > summary { display: flex; align-items: center; gap: 12px; padding: 15px 19px; cursor: pointer; list-style: none; color: #315e7d; font-weight: 650; font-size: 14px; min-height: 54px; }
.op-department > summary::-webkit-details-marker { display: none; }
.op-department > summary small { display: block; color: #768c9b; font-weight: 400; font-size: 11px; margin-top: 3px; }
.op-department > summary::after { content: "+"; margin-left: auto; font-size: 22px; font-weight: 400; color: #6f90a8; }
.op-department[open] > summary::after { content: "−"; }
.op-department[open] > summary { border-bottom: 1px solid #e1eaf1; background: #f8fbfd; }
.op-department .dept-board { padding: 18px 19px; }
.op-department .dept-board-head h3 { margin: 0 0 8px; color: #203e50; }
.op-department .dept-board-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; margin-top: 14px; }
.op-department .dept-board-card { border: 1px solid #e1eaee; border-radius: 10px; padding: 14px; }
.op-department .dept-board-card h4 { margin: 0 0 8px; color: #285870; }
:root[data-theme="dark"] .op-department { background: var(--surface); border-color: var(--line); }
:root[data-theme="dark"] .op-department[open] > summary { background: var(--surface); border-color: var(--line); }
:root[data-theme="dark"] .op-department .dept-board-card { border-color: var(--line); }
```

- [ ] **Step 3: Colocar `SuggestionsBox` em todos os módulos**

Logo depois da `<ModuleTabs …/>` em `[modulo]/[[...secao]]/page.tsx`, no `doutrina/layout.tsx` e no `EducationNav`, acrescentar `<SuggestionsBox />` com `style` de margem `0 0 16px` (crie a classe `.visual-suggestions + * { margin-top: 16px }` se ela ainda não existir no CSS). O `DepartmentAbout` **não** entra aqui, porque ele pertence ao Painel (Task 5).

- [ ] **Step 4: Verificar**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run`
Expected: sem erros.

No navegador, abra `/sistema`, `/sistema/eventos/itens` e `/sistema/juventude/cronograma`. A caixa "Sugestões e melhorias" aparece fechada abaixo das abas e abre com "−". Repita com `document.documentElement.dataset.theme = "dark"` no console: tudo continua legível.

- [ ] **Step 5: Commit (só se o Ryan pediu commits)**

```bash
git add components/suggestions-box.tsx components/department-about.tsx app/sistema/home-client.tsx app/sistema/\[modulo\] app/sistema/doutrina/layout.tsx components/education/education-nav.tsx app/globals.css
git commit -m "feat: sugestões e quadro do departamento no desenho do visual v215"
```

---

### Task 5: Aba "Painel" em todos os departamentos e a ordem das abas do HTML

**Files:**
- Create: `lib/department-dashboard.ts`
- Test: `lib/department-dashboard.test.ts`
- Create: `components/modules/department-dashboard.tsx` (componente de servidor)
- Modify: `lib/module-pages.ts` (Painel como raiz + ordem do HTML)
- Modify: `app/sistema/[modulo]/[[...secao]]/page.tsx` (renderiza `panel: "painel"` no servidor)
- Modify: `app/api/pendencias/route.ts:39,46` e `app/api/agenda/route.ts:31,36` (links passam a apontar para as abas)
- Modify: `app/sistema/home-client.tsx:46-53` (atalhos com aba explícita)
- Test: `lib/modules.test.ts` (acrescentar casos)

**Interfaces:**
- Consumes: `departmentInfoFor` (Task 2), `DepartmentAbout` (Task 4), `MODULE_PAGES` e `findModulePage`.
- Produces: `workerDepartmentKey(page: ModulePage): string`, que devolve a chave de `app.worker_departments`; `buildDepartmentDashboard(input: { active: number; pending: number; birthdays: number; alerts: string[] }): { kpis: { label: string; value: string }[]; alerts: string[] }`. As fases 2–6 trocam os KPIs genéricos pelos do HTML, módulo a módulo, sem mudar a assinatura.

- [ ] **Step 1: Escrever os testes que falham**

`lib/department-dashboard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildDepartmentDashboard, workerDepartmentKey } from "@/lib/department-dashboard";
import { findModulePage } from "@/lib/module-pages";

describe("painel do departamento", () => {
  it("usa a chave do departamento quando o módulo tem uma", () => {
    expect(workerDepartmentKey(findModulePage("assistencia")!)).toBe("assistencia_social");
    expect(workerDepartmentKey(findModulePage("patrimonio")!)).toBe("patrimonio");
  });
  it("usa a chave certa para módulos sem departamento", () => {
    expect(workerDepartmentKey(findModulePage("tesouraria")!)).toBe("tesouraria");
    expect(workerDepartmentKey(findModulePage("secretaria")!)).toBe("secretaria");
    expect(workerDepartmentKey(findModulePage("conselhofiscal")!)).toBe("conselho_fiscal");
    expect(workerDepartmentKey(findModulePage("presidencia")!)).toBe("diretoria");
  });
  it("monta três indicadores e diz quando não há alerta", () => {
    const d = buildDepartmentDashboard({ active: 7, pending: 2, birthdays: 1, alerts: [] });
    expect(d.kpis).toEqual([
      { label: "Trabalhadores ativos", value: "7" },
      { label: "Fichas aguardando a Diretoria", value: "2" },
      { label: "Aniversariantes do mês", value: "1" }
    ]);
    expect(d.alerts).toEqual([]);
  });
});
```

Acrescentar a `lib/modules.test.ts`:

```ts
import { MODULE_PAGES, SECTOR_ROLE_RESOURCE } from "@/lib/module-pages";

describe("abas na ordem do visual", () => {
  it("todo módulo de departamento tem o Painel na raiz", () => {
    for (const slug of ["patrimonio", "eventos", "assistencia", "secretaria", "tesouraria", "conselhofiscal", "juridico", "presidencia"]) {
      const painel = MODULE_PAGES.find((p) => p.slug === slug)!.sections.find((s) => s.slug === "")!;
      expect(painel.label).toBe("Painel");
      expect(["painel", "presidencia-painel"]).toContain(painel.panel);
    }
  });
  it("a Secretaria mostra Reuniões e Atas antes do Painel, como no visual", () => {
    const sec = MODULE_PAGES.find((p) => p.slug === "secretaria")!;
    expect(sec.sections.slice(0, 2).map((s) => s.label)).toEqual(["Reuniões e Atas", "Painel"]);
  });
  it("Painel não tem acesso de setor, então perfil de setor não o vê", () => {
    const sectorResources = new Set(Object.values(SECTOR_ROLE_RESOURCE));
    const painel = MODULE_PAGES.find((p) => p.slug === "assistencia")!.sections.find((s) => s.slug === "")!;
    expect(sectorResources.has(painel.access?.resource ?? "")).toBe(false);
  });
  it("as abas antigas da raiz ganham endereço próprio", () => {
    const slugs = (s: string) => MODULE_PAGES.find((p) => p.slug === s)!.sections.map((x) => x.slug);
    expect(slugs("tesouraria")).toContain("caixa");
    expect(slugs("eventos")).toContain("agenda");
    expect(slugs("secretaria")).toContain("reunioes");
    expect(slugs("patrimonio")).toContain("bens");
    expect(slugs("conselhofiscal")).toContain("analises");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run lib/department-dashboard.test.ts lib/modules.test.ts`
Expected: FAIL. O import de `@/lib/department-dashboard` não resolve e `sections[0].label` ainda não é "Painel".

- [ ] **Step 3: Funções puras**

`lib/department-dashboard.ts`:

```ts
/** Painel genérico dos departamentos (KPIs e alertas). Módulo puro. */
import type { ModulePage } from "@/lib/module-pages";

const KEY_BY_SLUG: Record<string, string> = {
  tesouraria: "tesouraria", secretaria: "secretaria", conselhofiscal: "conselho_fiscal", presidencia: "diretoria"
};

export function workerDepartmentKey(page: ModulePage): string {
  return page.access.department ?? KEY_BY_SLUG[page.slug] ?? page.slug;
}

export function buildDepartmentDashboard(input: { active: number; pending: number; birthdays: number; alerts: string[] }) {
  return {
    kpis: [
      { label: "Trabalhadores ativos", value: String(input.active) },
      { label: "Fichas aguardando a Diretoria", value: String(input.pending) },
      { label: "Aniversariantes do mês", value: String(input.birthdays) }
    ],
    alerts: input.alerts
  };
}
```

- [ ] **Step 4: Painel como raiz e ordem do HTML em `lib/module-pages.ts`**

Em cada módulo abaixo, a primeira seção passa a ser `{ slug: "", label: "Painel", panel: "painel" }`, e a antiga seção raiz ganha o slug indicado. A ordem das demais segue a tabela do inventário. Abas que o app tem e o HTML não tem vão para o fim.

| Módulo | Antiga raiz → slug novo | Ordem final |
| --- | --- | --- |
| patrimonio | Bens → `bens` (rótulo "Cadastro de Bens") | Painel, Cadastro de Bens, Trabalhadores, Relatório Anual, Autorização de Baixa, Escala de Limpeza, Aniversariantes |
| eventos | Agenda → `agenda` (rótulo "Agenda de Eventos") | Painel, Agenda de Eventos, Itens do Evento, Avaliação do Evento, Escala de Trabalho, Trabalhadores, Relatório Anual |
| assistencia | Famílias → `familias` | Painel, Rancho (rótulo "Rancho dos Evangelizandos"), Voluntários (rótulo "Cadastro de Voluntários"), Mantenedores (rótulo "Mantenedores da Cesta Básica"), Café das Crianças (rótulo "Doadores do Café das Crianças"), Trabalhadores, Aniversariantes, Relatório Anual, Brechó — Livro Caixa, Clube de Mães — Livro Caixa, Clube de Mães — Pessoas, Clube de Mães — Entregas, Planejamento Anual, Controle de Atividades, Kits de Higiene, Famílias |
| secretaria | Reuniões e Atas → `reunioes` | Reuniões e Atas, Painel, Admissões (rótulo "Acompanhar admissões"), Aniversariantes, Gravador. **Exceção:** no HTML o Painel é a 2ª aba da Secretaria. Aqui `reunioes` fica primeiro na lista e o Painel continua com slug `""` (o teste do Step 1 cobre isso) |
| tesouraria | Caixa Mensal → `caixa` | Painel, Contribuições, Mantenedores, Plano de Contas, Caixa Mensal, Aniversariantes, Relatório Anual, WhatsApp, Extrato e Conciliação (rótulo "Extrato Bancário"), Lançamentos, Doações recebidas |
| conselhofiscal | Análises e Pareceres → `analises` | Painel, Análises e Pareceres |
| juridico | Eleições → `eleicoes` | Painel, Eleições, Relatório Anual, Trabalhadores |
| presidencia | Painel (`presidencia-painel`) continua na raiz **com `panel: "presidencia-painel"`**: ele já é o Painel. Só a ordem muda | Painel, Aprovação de Trabalhadores, Autorizações de Baixa, Sugestões |
| divulgacao | sem mudança nesta task (fase 5) | — |

Para Tesouraria, Secretaria, Conselho Fiscal e Presidência, a seção Painel não leva `access` próprio e herda o do módulo. Assim um perfil de setor não a vê, porque o filtro `sectorResource` em `[modulo]/[[...secao]]/page.tsx` já descarta seções sem `access` de setor.

- [ ] **Step 5: Componente de servidor do Painel**

`components/modules/department-dashboard.tsx`:

```tsx
import { DepartmentAbout } from "@/components/department-about";
import { query } from "@/lib/db";
import { buildDepartmentDashboard, workerDepartmentKey } from "@/lib/department-dashboard";
import { departmentInfoFor } from "@/lib/department-info";
import type { ModulePage } from "@/lib/module-pages";

/** Aba "Painel" dos departamentos: quadro do departamento, três indicadores e alertas. */
export async function DepartmentDashboard({ page }: { page: ModulePage }) {
  const key = workerDepartmentKey(page);
  const [counts, coordinators] = await Promise.all([
    query<{ active: number; pending: number; birthdays: number }>(
      `select count(*) filter (where w.status = 'active')::int as active,
              count(*) filter (where w.status = 'pending')::int as pending,
              count(*) filter (where w.status = 'active' and extract(month from w.birth_date) = extract(month from (now() at time zone 'America/Sao_Paulo')))::int as birthdays
         from app.workers w join app.worker_departments d on d.worker_id = w.id and d.department_key = $1`, [key]),
    query<{ full_name: string }>(
      `select u.full_name from app.users u join app.user_departments ud on ud.user_id = u.id and ud.department_key = $1
        where u.status = 'active' and u.role_key = 'coordenador' order by u.full_name`, [key])
  ]);
  const c = counts.rows[0] ?? { active: 0, pending: 0, birthdays: 0 };
  const alerts = c.pending ? [`${c.pending} ficha(s) aguardando a Diretoria.`] : [];
  const data = buildDepartmentDashboard({ ...c, alerts });
  const info = departmentInfoFor(page.slug);
  return (
    <>
      {info ? <DepartmentAbout info={info} coordinators={coordinators.rows.map((r) => r.full_name)} /> : null}
      <div className="grid cards" style={{ marginBottom: 16 }}>
        {data.kpis.map((k) => <article key={k.label} className="card kpi"><span className="small muted">{k.label}</span><b>{k.value}</b></article>)}
      </div>
      <section className="card">
        <h2>Alertas</h2>
        {data.alerts.length ? <ul>{data.alerts.map((a) => <li key={a}>{a}</li>)}</ul> : <p className="muted">Nenhum alerta.</p>}
      </section>
    </>
  );
}
```

Antes de rodar, confirme os nomes das colunas usadas (`app.user_departments.department_key`, `app.users.role_key`, `app.workers.birth_date`). A query de `app/sistema/doutrina/page.tsx` usa os mesmos nomes, então basta comparar com ela.

Em `[modulo]/[[...secao]]/page.tsx`, trocar a última linha do JSX por:

```tsx
{def ? <ResourceManager resourceKey={def.key} />
  : current.panel === "painel" ? <DepartmentDashboard page={page} />
  : current.panel ? <ModulePanel name={current.panel} /> : null}
```

- [ ] **Step 6: Links que apontavam para a raiz**

- `app/api/pendencias/route.ts:39`: `"/sistema/tesouraria"` → `"/sistema/tesouraria/caixa"`.
- `app/api/pendencias/route.ts:46`: `"/sistema/conselhofiscal"` → `"/sistema/conselhofiscal/analises"`.
- `app/api/agenda/route.ts:31`: `"/sistema/eventos"` → `"/sistema/eventos/agenda"`.
- `app/api/agenda/route.ts:36`: `"/sistema/secretaria"` → `"/sistema/secretaria/reunioes"`.
- `app/sistema/home-client.tsx:46-53`, atalhos: Contribuições → `/sistema/tesouraria/contribuicoes`, Agenda de eventos → `/sistema/eventos/agenda`, Cadastro de bens → `/sistema/patrimonio/bens`, Reuniões e atas → `/sistema/secretaria/reunioes`. O campo `needs` continua sendo a raiz do módulo, porque é ela que decide a permissão.
- `app/sistema/home-client.tsx:217`: `/sistema/eventos` → `/sistema/eventos/agenda`.

Depois rode `grep -rn '"/sistema/\(patrimonio\|eventos\|tesouraria\|secretaria\|conselhofiscal\|juridico\|assistencia\)"' app lib components` e confira cada resultado que sobrar. Os cards da Visão Geral (`home-client.tsx:33-40`) podem continuar na raiz, que agora é o Painel.

- [ ] **Step 7: Rodar os testes**

Run: `pnpm vitest run && pnpm typecheck && pnpm lint`
Expected: tudo PASS, sem erros.

- [ ] **Step 8: Verificar no navegador**

Com `pnpm dev`, entrar como administrador local e abrir `/sistema/patrimonio`, `/sistema/tesouraria`, `/sistema/secretaria` e `/sistema/presidencia`. Os três primeiros mostram "Sobre o departamento — …" fechado, três indicadores e Alertas. Comparar com `tmp/visual-215-ref/patrimonio__pat-painel.png`. Clicar numa pendência da Visão Geral deve abrir a aba certa, e nunca um 404.

Entrar com um usuário de perfil `brecho` (crie em `/sistema/usuarios` se não houver) e abrir `/sistema/assistencia`. O resultado esperado é cair em `/sistema/assistencia/brecho`, sem a aba Painel.

- [ ] **Step 9: Commit (só se o Ryan pediu commits)**

```bash
git add lib/department-dashboard.ts lib/department-dashboard.test.ts components/modules/department-dashboard.tsx lib/module-pages.ts lib/modules.test.ts app/sistema/\[modulo\] app/api/pendencias/route.ts app/api/agenda/route.ts app/sistema/home-client.tsx
git commit -m "feat: aba Painel nos departamentos e abas na ordem do visual v215"
```

---

## Depois da fase 1

1. Rodar a fase 1 inteira em produção: push na `main`, esperar o deploy da Vercel e conferir `https://sistema.lardabencao.org/api/health` → `ok`.
2. Escrever o plano da fase 2 (Doutrina) a partir de `tmp/visual-215-ref/doutrina__p-caravana-lar.png`, `doutrina__p-training-plan.png` e dos campos dos formulários. Para listar os campos, use a mesma técnica do script da Task 1: clicar em "+ Novo treinamento" e ler os `input/select/textarea` do diálogo.
3. Repetir para as fases 3 a 6, na ordem da tabela de fases.
