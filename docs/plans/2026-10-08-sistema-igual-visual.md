# Sistema igual ao visual — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Visão Geral em `https://sistema.lardabencao.org/sistema` fica com o mesmo desenho da página em `https://sistema.lardabencao.org/visual` (casca, painel de boas-vindas, quatro indicadores, agenda e pendências).

**Architecture:** O `/visual` continua servindo o HTML `dist/index.html`. O `/sistema` continua o app Next com Postgres. Esta leva copia a estrutura e as medidas do HTML para os componentes React da home e da casca. Os números e os itens de menu saem das APIs e das permissões que já existem.

**Tech Stack:** Next.js 16 (App Router), React 19, CSS em `app/globals.css`, Vitest. Antes de usar API do Next, ler o guia em `node_modules/next/dist/docs/`.

## Global Constraints

- Não trocar `/sistema` por iframe, rewrite ou cópia de `dist/index.html`.
- Não gravar no app os textos "Demonstração Funcional", "dados fictícios", "Restaurar dados fictícios" nem os números da foto do `/visual` (15 módulos, 5 pendências, "Café da manhã").
- O menu lista só rotas que o usuário já pode abrir. Não inventar Presidência, Secretaria ou departamento que a conta não tenha.
- A frase "Ambiente de teste · dados fictícios" só aparece quando `runtimeEnvironment().production` é falso. Em produção, essa frase não entra.
- Não rodar `tests/e2e/fundacao-onda1.spec.ts`. Esse spec chama `supabase db reset` e apaga o banco local.
- Não commitar `public/visual-v215.html` nem `test-results/`.
- Tema claro continua o padrão. Escuro só com `data-theme="dark"`.
- Telas internas (ficha, tabela, frequência, tesouraria) ficam fora deste plano. A casca muda em todas porque o layout é compartilhado; o miolo de cada módulo não muda.
- Cada tarefa termina com commit só se o Ryan pedir commit nesta sessão. Se pedir, uma mensagem por tarefa, no estilo do repositório.

---

## O que a foto do `/visual` tem e o `/sistema` ainda não

Referência de medida: `theme-215/theme.css` (bloco `@media screen`, linhas 1–132) e o HTML gerado em `dist/index.html` (a função que monta `#opDashboard`, por volta da linha 26251). Não editar esses dois arquivos.

| Peça | `/visual` | `/sistema` hoje |
| --- | --- | --- |
| Topo | Título à esquerda. Chip, "Minha área" e "Opções do sistema" à direita, com quebra de linha. Sem margem negativa. | `.page-heading` usa `margin: -58px` e `padding-right: 460px`, e o selo "Produção · Vercel" empurra o título. |
| Estado | Linha verde "Pronto para uso". | Não existe. |
| Boas-vindas | Sobrancelha, título, lema, dois botões, data, emblema. | O mesmo painel, mais "Casa fundada…" e "Olá, …" dentro dele. |
| Indicadores | Sempre quatro, com ícone: agenda de hoje, pendências, próximos eventos, módulos disponíveis. | Os dois primeiros cards que `homeCards()` devolver (trabalhadores e fichas). |
| Agenda | Título, seletor Hoje / 7 dias / 30 dias, data "11 OUT", nome e departamento. | Lista crua, sem seletor. |
| Pendências | Título "Pendências", rótulo "Acompanhamento", número em selo, texto e dica. | Uma linha por pendência, sem dica. |
| Sessão | Iniciais do nome, nome em negrito, perfil só se for diferente do nome. | Iniciais, nome e a chave `administrador` em vez do rótulo "Administrador do Sistema". |

Diferença que permanece de propósito: os nomes do menu e os números. A foto do `/visual` mostra departamentos de demonstração. O app mostra os módulos liberados e as contagens do banco.

## Arquivos

- Criar: `lib/home-dashboard.ts` — funções puras da home (iniciais, filtro da agenda, quatro indicadores).
- Criar: `lib/home-dashboard.test.ts`.
- Criar: `lib/navigation.ts` — lista de módulos visíveis, com `cache` do React, usada pelo layout e pela home.
- Modificar: `app/sistema/layout.tsx`, `components/system-bar.tsx`, `components/sidebar.tsx`, `app/globals.css`.
- Modificar: `app/sistema/page.tsx`, `app/sistema/home-client.tsx`.
- Modificar: `app/api/pendencias/route.ts` — campo `hint` em cada item.

---

### Task 1: Funções puras da home

**Files:**
- Create: `lib/home-dashboard.ts`
- Test: `lib/home-dashboard.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, expect, it } from "vitest";
import { addDays, buildHomeStats, filterAgenda, sessionInitials, sessionShowsRole } from "@/lib/home-dashboard";

describe("painel da visão geral", () => {
  it("soma os quatro indicadores com a agenda de hoje e os eventos", () => {
    const stats = buildHomeStats({
      today: "2026-10-08",
      moduleCount: 4,
      agenda: [
        { date: "2026-10-08", label: "Limpeza", module: "Patrimônio", href: "/sistema/patrimonio/limpeza" },
        { date: "2026-10-11", label: "Café", module: "Eventos", href: "/sistema/eventos" }
      ],
      pending: [{ key: "admissoes", label: "Fichas", count: 2, href: "/sistema/admissoes" }]
    });
    expect(stats.map((item) => [item.key, item.value])).toEqual([
      ["agenda", "1"],
      ["pending", "2"],
      ["events", "1"],
      ["modules", "4"]
    ]);
    expect(stats[1].pending).toBe(true);
  });

  it("filtra a agenda pelo período e fica nos seis primeiros", () => {
    const items = Array.from({ length: 8 }, (_, index) => ({
      date: addDays("2026-10-08", index),
      label: `Item ${index}`,
      module: "Eventos",
      href: "/sistema/eventos"
    }));
    expect(filterAgenda(items, "2026-10-08", 0)).toHaveLength(1);
    expect(filterAgenda(items, "2026-10-08", 7).map((item) => item.date).at(-1)).toBe("2026-10-15");
    expect(filterAgenda(items, "2026-10-08", 30)).toHaveLength(6);
  });

  it("monta as iniciais pulando da, de e do", () => {
    expect(sessionInitials("Administrador do Sistema")).toBe("AS");
    expect(sessionInitials("Ana")).toBe("A");
  });

  it("esconde o perfil quando o nome já é o rótulo do perfil", () => {
    expect(sessionShowsRole("Administrador do Sistema", "Administrador do Sistema")).toBe(false);
    expect(sessionShowsRole("Ana Souza", "Administrador do Sistema")).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar o teste e ver a falha**

Run: `pnpm exec vitest run lib/home-dashboard.test.ts`

Expected: FAIL, módulo `@/lib/home-dashboard` não existe.

- [ ] **Step 3: Implementar**

```ts
export type AgendaItem = { date: string; label: string; module: string; href: string };
export type PendingItem = { key: string; label: string; count: number; href: string; hint?: string };
export type HomeStat = { key: string; label: string; value: string; hint: string; icon: "calendar" | "check" | "people" | "org"; pending?: boolean };

const SKIP = new Set(["da", "de", "do", "das", "dos"]);

export function addDays(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function filterAgenda(items: AgendaItem[], today: string, periodDays: 0 | 7 | 30) {
  const end = addDays(today, periodDays);
  return items.filter((item) => item.date >= today && item.date <= end).slice(0, 6);
}

export function buildHomeStats(input: { today: string; moduleCount: number; agenda: AgendaItem[]; pending: PendingItem[] }): HomeStat[] {
  const todayCount = input.agenda.filter((item) => item.date === input.today).length;
  const pendingSum = input.pending.reduce((sum, item) => sum + item.count, 0);
  const events = input.agenda.filter((item) => item.module === "Eventos").length;
  return [
    { key: "agenda", label: "Na agenda de hoje", value: String(todayCount), hint: "Atividades programadas com data", icon: "calendar" },
    { key: "pending", label: "Pendências para acompanhar", value: String(pendingSum), hint: "Nos módulos liberados para seu perfil", icon: "check", pending: true },
    { key: "events", label: "Próximos eventos", value: String(events), hint: "Eventos futuros com data definida", icon: "people" },
    { key: "modules", label: "Módulos disponíveis", value: String(input.moduleCount), hint: "Conforme seu cadastro de acesso", icon: "org" }
  ];
}

export function sessionInitials(name: string) {
  return name.split(/\s+/).filter((part) => part && !SKIP.has(part.toLocaleLowerCase("pt-BR"))).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function sessionShowsRole(name: string, roleLabel: string) {
  const norm = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR").trim();
  return norm(name) !== norm(roleLabel);
}

export function todayInSaoPaulo(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
```

- [ ] **Step 4: Rodar o teste**

Run: `pnpm exec vitest run lib/home-dashboard.test.ts`

Expected: PASS, 4 testes.

- [ ] **Step 5: Commit, se o Ryan pediu**

```bash
git add lib/home-dashboard.ts lib/home-dashboard.test.ts
git commit -m "$(cat <<'EOF'
test: indicadores e período da visão geral no formato do visual

EOF
)"
```

---

### Task 2: Casca — topo, sessão e menu

O título e a barra deixam de se sobrepor. O chip usa o rótulo do perfil (`app.roles.label`). O menu agrupa Diretoria e mantém a ordem da foto, só com o que a conta pode abrir.

**Files:**
- Create: `lib/navigation.ts`
- Modify: `app/sistema/layout.tsx`
- Modify: `components/system-bar.tsx`
- Modify: `components/sidebar.tsx`
- Modify: `app/globals.css` (bloco da casca; a home entra na Task 3)

- [ ] **Step 1: Extrair a navegação para um módulo com cache**

Criar `lib/navigation.ts`. Copiar o laço que hoje está em `app/sistema/layout.tsx` (flags, `moduleCatalog`, permissões). Envolver com `cache` de `react` para o layout e a home chamarem a mesma função uma vez por request.

```ts
import { cache } from "react";
import type { Actor } from "@/lib/auth";
import { query } from "@/lib/db";
import { listEnabledFlags } from "@/lib/feature-flags";
import { moduleCatalog } from "@/lib/modules";
import { hasAnyDepartmentPermission, hasPermission } from "@/lib/permissions";

export type VisibleModule = { href: string; label: string };

export const loadNavigation = cache(async (actor: Actor) => {
  const flags = await listEnabledFlags();
  const [audit, attachments, users, moduleAdmin, role] = await Promise.all([
    hasPermission(actor, "audit", "read"),
    hasPermission(actor, "attachments", "admin"),
    hasPermission(actor, "users", "admin"),
    hasPermission(actor, "modules", "admin"),
    query<{ label: string }>("select label from app.roles where key = $1", [actor.role])
  ]);
  const modules: VisibleModule[] = [];
  for (const mod of moduleCatalog) {
    if (mod.key === "home") continue;
    if (!flags.get(mod.flagKey)) continue;
    const allowed = mod.department
      ? await hasPermission(actor, mod.permissionResource, "read", mod.department)
      : mod.permissionResource === "department"
        ? await hasAnyDepartmentPermission(actor, "read")
        : await hasPermission(actor, mod.permissionResource, "read");
    if (allowed) modules.push({ href: mod.href, label: mod.label });
  }
  return {
    modules,
    roleLabel: role.rows[0]?.label ?? actor.role,
    capabilities: { audit, attachments, users, moduleAdmin, modules }
  };
});
```

`app/sistema/layout.tsx` passa a ser:

```tsx
import { Sidebar } from "@/components/sidebar";
import { SystemBar } from "@/components/system-bar";
import { runtimeEnvironment } from "@/lib/environment";
import { loadNavigation } from "@/lib/navigation";
import { requirePageActor } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function SystemLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const actor = await requirePageActor();
  const nav = await loadNavigation(actor);
  const env = runtimeEnvironment();

  return (
    <div className="app-shell">
      <Sidebar actor={actor} capabilities={nav.capabilities} />
      <main className="app-main">
        <SystemBar actor={actor} roleLabel={nav.roleLabel} />
        <p className="ops-save" role="status">Pronto para uso</p>
        {env.production ? null : (
          <details className="lar-demo-note">
            <summary>Ambiente de teste · dados fictícios</summary>
            <div className="notice" role="note"><strong>{env.label}.</strong> Não cadastre dados pessoais reais neste ambiente.</div>
          </details>
        )}
        {children}
      </main>
    </div>
  );
}
```

O selo "Produção · Vercel" sai da barra. As páginas de anexos e auditoria que usam `production-badge` dentro do próprio título não mudam.

- [ ] **Step 2: Chip da sessão**

`components/system-bar.tsx` recebe `roleLabel: string`. Trocar o cálculo de iniciais pela função da Task 1. A linha pequena some quando `sessionShowsRole` devolve falso.

```tsx
import { sessionInitials, sessionShowsRole } from "@/lib/home-dashboard";

export function SystemBar({ actor, roleLabel }: { actor: { name: string; role: string }; roleLabel: string }) {
  const initials = sessionInitials(actor.name) || "LB";
  const showRole = sessionShowsRole(actor.name, roleLabel);
  // logout permanece como está
  return (
    <div className="system-bar">
      <Link href="/sistema/conta" className="session-chip">
        <span className="session-avatar" aria-hidden="true">{initials}</span>
        <span className="session-text">
          <strong>{actor.name}</strong>
          {showRole ? <small>{roleLabel}</small> : null}
        </span>
      </Link>
      <Link href="/sistema/conta" className="button">Minha área</Link>
      <details className="system-menu">
        <summary className="button">Opções do sistema</summary>
        <div>
          <button className="button" type="button" onClick={() => void logout("local")}>Sair deste aparelho</button>
          <button className="button" type="button" onClick={() => void logout("global")}>Sair de todos os aparelhos</button>
          <ThemeToggle />
        </div>
      </details>
    </div>
  );
}
```

- [ ] **Step 3: Ordem do menu, com Diretoria agrupada**

Em `components/sidebar.tsx`, separar os links nesta ordem. Grupo Diretoria, aberto se a rota atual começa com um dos hrefs:

1. `/sistema` — Visão Geral
2. `/sistema/documentos` — Estatuto e Regimento, se estiver em `capabilities.modules`
3. `/sistema/organograma` — Organograma
4. `/sistema/acesso` — Controle de Acesso, se `capabilities.users`
5. `<details className="nav-group">` com `<summary>Diretoria</summary>` e, nesta ordem, só os que existirem em `capabilities.modules`: `/sistema/presidencia`, `/sistema/secretaria`, `/sistema/tesouraria`, `/sistema/conselhofiscal`
6. O restante de `capabilities.modules` que não entrou acima (Trabalhadores, Admissões, Doutrina, Infância, e assim por diante), na ordem do catálogo
7. Ferramentas, cada uma com a mesma condição de hoje: auditoria, anexos, usuários, instituição, sugestões, módulos, importação

A busca atual continua: um item some se o texto digitado não estiver no rótulo. O grupo Diretoria some inteiro se nenhum filho passar na busca.

Cada link continua com `NavIcon` e `data-current`.

A marca fica com `subtitle="Sistema integrado"`. Não usar o subtítulo de demonstração do HTML.

- [ ] **Step 4: CSS da casca em `app/globals.css`**

Substituir as regras atuais de `.system-bar`, `.session-chip`, `.page-heading` e o tamanho da logo da sidebar. O `main` vira grid: o título ocupa a coluna 1, a barra a coluna 2, e o resto ocupa as duas colunas. Isso elimina `margin: -58px` e `padding-right: 460px`.

```css
.sidebar .brand-logo { width: 52px; height: 65px; flex-basis: 52px; padding: 5px; border-radius: 12px; }
.app-main { display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, max-content); column-gap: 20px; row-gap: 0; align-items: start; padding: 24px 30px 32px; }
.system-bar { grid-column: 2; grid-row: 1; display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 8px; max-width: 420px; margin: 0; position: relative; z-index: 2; }
.page-heading { grid-column: 1; grid-row: 1; margin: 0; padding: 0 0 20px; border-bottom: 0; }
.page-heading h1 { margin: 0 0 6px; font-size: 28px; letter-spacing: -.5px; line-height: 1.25; color: #203e50; }
.page-heading p { margin: 0; color: #617683; font-size: 14px; }
.ops-save, .lar-demo-note, .app-main > :not(.system-bar):not(.page-heading) { grid-column: 1 / -1; }
.ops-save { font-size: 13px; color: #346849; margin: 0 0 16px; line-height: 1.5; }
.lar-demo-note { font-size: 13px; color: #617683; margin: 0 0 16px; }
.lar-demo-note summary { cursor: pointer; min-height: 38px; padding: 8px 0; }
.session-chip { border-radius: 12px; min-height: 48px; max-width: 290px; }
.session-text strong { font-size: 14px; }
.session-text small { font-size: 12px; color: #617683; }
.nav-group { margin: 3px 0; }
.nav-group > summary { color: #617683; font-size: 14px; min-height: 44px; padding: 12px; cursor: pointer; list-style: none; }
.nav-group > summary::-webkit-details-marker { display: none; }
.nav-group .nav-link { margin-left: 12px; }
```

No `@media (max-width: 980px)`, a barra e o título empilham: `.app-main { grid-template-columns: 1fr; }`, `.system-bar, .page-heading { grid-column: 1; max-width: none; }`, e `.page-heading { margin-top: 16px; padding-right: 0; }` no lugar da margem negativa.

- [ ] **Step 5: Checagem de tipo**

Run: `pnpm exec tsc --noEmit`

Expected: exit 0. Se `cache` do React não existir nesta versão do Next, ler `node_modules/next/dist/docs/` e usar o helper de cache de request que a documentação indicar, com a mesma assinatura `loadNavigation(actor)`.

- [ ] **Step 6: Commit, se o Ryan pediu**

```bash
git add lib/navigation.ts app/sistema/layout.tsx components/system-bar.tsx components/sidebar.tsx app/globals.css
git commit -m "$(cat <<'EOF'
fix: topo e menu do sistema no mesmo lugar do visual

EOF
)"
```

---

### Task 3: Visão Geral no desenho do `/visual`

**Files:**
- Modify: `app/sistema/page.tsx`
- Modify: `app/sistema/home-client.tsx`
- Modify: `app/api/pendencias/route.ts`
- Modify: `app/globals.css`

- [ ] **Step 1: Dica em cada pendência**

Em `app/api/pendencias/route.ts`, o tipo ganha `hint: string`. Cada `add` passa a gravar a dica:

| key | hint |
| --- | --- |
| admissoes | Consultar fichas encaminhadas à Diretoria |
| baixas | Acompanhar pedidos de autorização |
| limpeza | Conferir taxas ainda sem recebimento |
| sugestoes | Consultar a central de melhorias |
| conciliacao | Conciliar as linhas do extrato |
| caixa | Fechar os meses ainda abertos |
| parecer | Emitir o parecer do Conselho Fiscal |
| emprestimos | Registrar a devolução dos livros atrasados |

O `if (count)` continua. Item com contagem zero não entra na lista.

- [ ] **Step 2: A página só entrega a contagem de módulos**

`app/sistema/page.tsx`:

```tsx
import { HomeClient } from "./home-client";
import { loadNavigation } from "@/lib/navigation";
import { requirePageActor } from "@/lib/page-auth";

export default async function DashboardPage() {
  const actor = await requirePageActor();
  const nav = await loadNavigation(actor);

  return (
    <>
      <header className="page-heading">
        <div>
          <h1>Visão Geral do Sistema</h1>
          <p>Acesse cada departamento pelo seu próprio módulo.</p>
        </div>
      </header>
      <HomeClient moduleCount={nav.modules.length} />
    </>
  );
}
```

`firstName` sai. A saudação "Olá" não está no painel do `/visual`.

- [ ] **Step 3: Reescrever o miolo de `home-client.tsx`**

Manter os três fetches (`/api/home`, `/api/pendencias`, `/api/agenda`) e o bloco "Minha área" que já existe no final do arquivo (escala, eventos, contribuições). Ele fica depois das duas colunas e só quando `home.myArea.worker` existe.

Tirar de dentro do painel azul: o parágrafo "Casa fundada…" e o "Olá". A data continua, em `<small className="lar-welcome-date">`.

Estado novo: `period`, união `0 | 7 | 30`, valor inicial `30`.

```tsx
const today = todayInSaoPaulo();
const stats = buildHomeStats({ today, moduleCount, agenda, pending });
const visibleAgenda = filterAgenda(agenda, today, period);
const agendaTotal = agenda.filter((item) => item.date >= today && item.date <= addDays(today, period)).length;
```

O painel usa as classes que já existem (`.card.lar-welcome`, `.op-eyebrow`, `.lar-welcome-emblem`). O emblema continua `<img src="/marca-lar-da-bencao.png" alt="" />`.

Os quatro indicadores, sempre, nesta ordem, cada um com ícone:

```tsx
<div className="op-stats">
  {stats.map((card) => (
    <article key={card.key} className={card.pending ? "op-stat op-pending" : "op-stat"}>
      <OpIcon name={card.icon} />
      <span>{card.label}</span>
      <b>{card.value}</b>
      <small>{card.hint}</small>
    </article>
  ))}
</div>
```

`OpIcon` é um componente no mesmo arquivo. SVG 24×24, `stroke="currentColor"`, `fill="none"`, classe `op-icon`. Traços:

- calendar: retângulo `M5 5h14v15H5z` e linha `M5 10h14`
- check: `M5 12.5 9.5 17 19 7`
- people: o mesmo path de pessoas já usado em `components/nav-icon.tsx` para trabalhadores
- org: quatro quadrados, o path de grade já usado como fallback em `nav-icon.tsx`

Agenda e pendências, no lugar do bloco atual `.home-columns`:

```tsx
<div className="op-columns">
  <section className="op-section">
    <div className="op-section-head">
      <h3>Agenda</h3>
      <label>Período
        <select aria-label="Período da agenda" value={period} onChange={(event) => setPeriod(Number(event.target.value) as 0 | 7 | 30)}>
          <option value={0}>Hoje</option>
          <option value={7}>Próximos 7 dias</option>
          <option value={30}>Próximos 30 dias</option>
        </select>
      </label>
    </div>
    {visibleAgenda.length ? (
      <ul className="op-list">
        {visibleAgenda.map((item, index) => (
          <li key={`${item.date}-${index}`}>
            <Link href={item.href} className="op-agenda-link">
              <span className="op-date"><b>{item.date.slice(8)}</b>{monthShort(item.date)}</span>
              <span className="op-line-copy"><strong>{item.label}</strong><small>{item.module}</small></span>
              <span className="op-arrow" aria-hidden="true">›</span>
            </Link>
          </li>
        ))}
      </ul>
    ) : (
      <div className="op-empty">
        <strong>Nenhuma atividade neste período</strong>
        <p>Confira as agendas dos seus departamentos ou escolha outro período.</p>
      </div>
    )}
    <p className="op-footnote">
      {agendaTotal > 6
        ? `Exibindo as próximas 6 de ${agendaTotal} atividades. Abra o departamento para consultar a agenda completa.`
        : "Agenda formada pelos eventos, atividades, reuniões e limpeza cadastrados nos módulos liberados."}
    </p>
  </section>
  <section className="op-section">
    <div className="op-section-head">
      <h3>Pendências</h3>
      <span>Acompanhamento</span>
    </div>
    {pending.length ? (
      <ul className="op-list">
        {pending.map((item) => (
          <li key={item.key}>
            <Link href={item.href} className="op-pending-link">
              <span className="op-count">{item.count}</span>
              <span className="op-line-copy"><strong>{item.label}</strong><small>{item.hint}</small></span>
              <span className="op-arrow" aria-hidden="true">›</span>
            </Link>
          </li>
        ))}
      </ul>
    ) : (
      <div className="op-empty">
        <strong>Nenhuma pendência neste resumo</strong>
        <p>Não há fichas, pedidos ou sugestões aguardando análise nas categorias exibidas.</p>
      </div>
    )}
  </section>
</div>
```

O tipo local `Pending` ganha `hint?: string`. `monthShort` permanece.

- [ ] **Step 4: CSS das seções, em `app/globals.css`**

Acrescentar, e ajustar o que já existe para estes valores. Medidas do HTML, não inventadas:

```css
.op-welcome, .card.lar-welcome { margin-bottom: 24px; }
.op-eyebrow { text-transform: uppercase; }
.op-stats { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-bottom: 22px; }
.op-stat > span:not(.op-icon) { font-size: 14px; min-height: 44px; color: #526f7e; padding-right: 38px; }
.op-stat > b { color: #203e50; font-size: 32px; }
.op-stat > small { font-size: 13px; color: #617683; }
.op-stat .op-icon { position: absolute; right: 16px; top: 18px; background: #eef5f0; color: #356f52; width: 38px; height: 38px; padding: 8px; border-radius: 10px; }
.op-stat.op-pending > b { color: #8b631d; }
.op-columns { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); gap: 18px; }
.op-section { border: 1px solid #dae5e9; background: #fff; border-radius: 16px; padding: 22px; min-width: 0; }
.op-section-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 15px; flex-wrap: wrap; }
.op-section h3 { margin: 0; font-size: 19px; color: #203e50; }
.op-section-head label, .op-section-head span { font-size: 13px; color: #617683; font-weight: 400; }
.op-section-head select { font-size: 14px; max-width: 195px; min-height: 44px; }
.op-list { list-style: none; margin: 0; padding: 0; }
.op-list > li + li { border-top: 1px solid #e7edf2; }
.op-agenda-link, .op-pending-link { display: flex; gap: 13px; align-items: center; width: 100%; padding: 14px 0; text-decoration: none; color: inherit; border-radius: 6px; }
.op-agenda-link:hover, .op-pending-link:hover { background: #f6f9fa; }
.op-date { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 0 0 48px; min-height: 54px; background: #eaf3f6; color: #356f8f; border-radius: 10px; font-size: 12px; text-transform: uppercase; }
.op-date b { font-size: 21px; line-height: 1.1; }
.op-line-copy { min-width: 0; flex: 1; }
.op-line-copy strong, .op-line-copy small { display: block; }
.op-line-copy strong { font-size: 15px; color: #203e50; }
.op-line-copy small { font-size: 13px; color: #617683; }
.op-count { font-size: 17px; font-weight: 700; min-width: 36px; min-height: 36px; padding: 6px; border-radius: 9px; background: #fff5df; color: #90641a; text-align: center; }
.op-arrow { color: #617683; font-size: 18px; }
.op-empty { padding: 24px 12px; text-align: center; color: #617683; font-size: 14px; }
.op-empty strong { display: block; font-size: 16px; color: #203e50; margin-bottom: 5px; }
.op-footnote { font-size: 13px; color: #617683; margin: 14px 0 0; }
```

Breakpoints, copiados de `theme-215/theme.css`:

- até 1200px: `.op-columns { grid-template-columns: 1fr; }`, `.op-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }`, emblema 106×106 e a imagem 59×81
- até 900px: indicadores continuam em 2 colunas; emblema 94×94, borda 5px, imagem 51×71
- até 540px: `.card.lar-welcome { display: block; }`, `.lar-welcome-emblem { display: none; }`, `.lar-welcome-actions { display: grid; grid-template-columns: 1fr; }`, `.op-stats { grid-template-columns: 1fr; }`

Apagar a regra antiga `.home-columns` se nenhum outro arquivo a usar. Conferir com busca no repositório antes de apagar.

- [ ] **Step 5: Testes e tipo**

Run: `pnpm exec vitest run lib/home-dashboard.test.ts && pnpm exec tsc --noEmit`

Expected: PASS e exit 0.

- [ ] **Step 6: Commit, se o Ryan pediu**

```bash
git add app/sistema/page.tsx app/sistema/home-client.tsx app/api/pendencias/route.ts app/globals.css
git commit -m "$(cat <<'EOF'
fix: visão geral com os quatro indicadores e a agenda do visual

EOF
)"
```

---

### Task 4: Conferir no navegador

Não declarar a tarefa pronta com um print estático. A home precisa ser usada.

- [ ] **Step 1: Subir o app**

A porta 3000 pode estar com um `next start` antigo. Usar outra porta.

Run: `pnpm exec next dev --port 3010`

O comando precisa rodar fora do sandbox (`required_permissions: ["all"]`), porque o `next dev` no sandbox falha em `uv_interface_addresses`.

- [ ] **Step 2: Entrar e percorrer a home**

Abrir `http://127.0.0.1:3010/sistema` com um usuário que já exista. Não criar usuário novo e não rodar Playwright.

Conferir, nesta ordem:

1. O título "Visão Geral do Sistema" fica à esquerda. O chip, "Minha área" e "Opções do sistema" ficam à direita, sem cobrir o título. "Opções do sistema" abre e mostra os dois saídas e o tema.
2. A linha "Pronto para uso" aparece. Em produção local, se `runtimeEnvironment().production` for falso, o aviso de ambiente de teste abre e fecha. O texto "dados fictícios" não pode aparecer se o ambiente for produção.
3. O painel azul tem "SEJA BEM-VINDO", "Ao Lar da Bênção", o lema, os dois botões, a data e o emblema. Não tem "Casa fundada" nem "Olá".
4. "Atualizar painel" recarrega a página. "Acessar minha área" abre `/sistema/conta`.
5. São quatro cards, com ícone. Os números batem com a API, não com a foto do `/visual`.
6. O seletor muda entre Hoje, 7 dias e 30 dias e a lista muda. Vazio mostra as duas frases da Task 3.
7. Pendências mostram o selo com o número e a dica. Vazio mostra "Nenhuma pendência neste resumo".
8. Abrir Trabalhadores (ou a primeira rota do menu). O título dessa tela também não encosta na barra.
9. Estreitar a janela para menos de 720px. O emblema some, os botões do painel ficam um embaixo do outro, e o menu continua utilizável.

- [ ] **Step 3: Comparar com o `/visual`**

Com os dois abertos, a diferença que pode restar é o texto do menu e os números. Se o painel, os quatro cards ou as duas colunas ainda tiverem outra forma, ajustar só o CSS da Task 3 e repetir o passo 2.

- [ ] **Step 4: Deploy, só se o Ryan pedir**

`vercel.json` só publica a branch `main`. Push em `main` dispara o deploy. Confirmar em seguida que `https://sistema.lardabencao.org/sistema` responde o título novo. Hard refresh se o navegador guardar a página anterior.

---

## Fora deste plano

Formulários, tabelas, abas e impressão de cada módulo. Quando a home estiver igual, um plano seguinte aplica em `app/globals.css` as regras de `.visual-table`, botão e campo que estão nas linhas 31–48 e 89–91 de `theme-215/theme.css`. Não misturar esse trabalho com as quatro tarefas acima.

## Auto-revisão

- Casca, boas-vindas, quatro indicadores, período da agenda e pendências têm tarefa.
- Dados fictícios da foto estão proibidos na seção Global Constraints.
- `buildHomeStats`, `filterAgenda`, `sessionInitials` e `sessionShowsRole` têm o mesmo nome no teste e na implementação.
- `loadNavigation` é a única lista de módulos, usada pelo layout e por `moduleCount`.
