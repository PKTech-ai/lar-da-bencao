# Carregamento, CPF obrigatório e primeiro acesso pelo CPF

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` (or `subagent-driven-development`) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Avisar o usuário enquanto o sistema troca de módulo ou grava uma ação, e mostrar a mensagem quando a ação falha; exigir CPF no cadastro do trabalhador; na aprovação, criar o acesso com o CPF como usuário e como senha inicial, e obrigar a troca dessa senha no primeiro login; deixar a barra lateral e os blocos da Visão Geral legíveis no tema escuro.

**Architecture:** O aviso de espera e o aviso de erro vivem no shell de `/sistema` (barra no topo + texto `role="status"` ou `role="alert"`), sem alterar o HTML de demonstração. O tema escuro já troca os tokens em `:root[data-theme="dark"]`; o que falta é parar de pintar texto com hex do tema claro em cima dessas superfícies escuras. O CPF entra em `app.workers` e nos dois formulários de ficha (público e interno). A aprovação chama o Auth do Supabase, grava `app.users` com papel `trabalhador` e a marca `must_reset_password`. O login aceita CPF ou e-mail; quem ainda precisa trocar a senha só chega em `/definir-senha`.

**Tech Stack:** Next.js 16.3 (App Router), React 19, Postgres via `lib/db.ts`, Supabase Auth (`lib/supabase/admin.ts`), Zod, Vitest, pnpm.

## Decisões já fechadas

A próxima sessão executa estas decisões. Não reabrir com o usuário.

1. **Onde o CPF aparece.** Campo obrigatório no cadastro público (`app/cadastro/trabalhador/public-worker-form.tsx`) e na ficha interna (`components/worker-ficha-form.tsx`). A fila de revisão copia o CPF para a ficha. Fichas antigas podem continuar sem CPF; **aprovar sem CPF falha** com a mensagem `Preencha o CPF na ficha antes de aprovar.`
2. **Formato.** Somente os 11 dígitos, com os dois dígitos verificadores. Sequências repetidas (`00000000000` e iguais) são inválidas. A tela pode mostrar `000.000.000-00`; o banco guarda só os dígitos.
3. **Unicidade.** Um CPF por ficha (`app.workers.cpf` único). Um CPF por acesso (`app.users.cpf` único).
4. **Login.** O campo da tela de login passa a ser `CPF ou e-mail institucional`. Onze dígitos válidos buscam `app.users.cpf` e entram no Supabase com o e-mail gravado nessa conta. E-mail continua o caminho de quem já tem conta institucional. Falha de CPF desconhecido ou senha errada usa a mesma frase genérica já existente: `E-mail ou senha inválidos.`
5. **E-mail da conta nova.** `app.users.email` continua obrigatório e único. A conta criada na admissão usa `{cpf}@acesso.lardabencao.org`. O e-mail de contato da ficha permanece em `app.workers.email` e não vira login.
6. **Senha inicial.** Os 11 dígitos do CPF, sem pontuação. A regra de 14 caracteres (`app/definir-senha/password-form.tsx`, `app/sistema/conta/account-client.tsx`) vale para a senha nova, não para esta senha inicial. Se o Supabase recusar a senha de 11 dígitos, a aprovação falha e a ficha continua pendente. Não inventar senha mais longa.
7. **Troca obrigatória.** `app.users.must_reset_password = true` na criação. Depois do login, `requirePageActor` manda para `/definir-senha?motivo=primeiro-acesso` antes dos termos. A senha nova tem no mínimo 14 caracteres e não pode ser o CPF. Só então a marca volta para `false`.
8. **Papel.** A pessoa admitida entra como `trabalhador`, com os departamentos da ficha. Outro papel fica para a tela de usuários, depois.
9. **Reprovação não cria acesso.** Aprovar de novo uma ficha que já tem `user_id` não cria outra conta.
10. **Auditoria.** Registrar que o acesso foi criado. Não gravar a senha. No texto da auditoria, mascarar o CPF (`***.***.***-00`, últimos dois dígitos).
11. **Demonstração.** Não editar `dist/index.html`, `scripts/demo-gate.mjs` nem `public/visual-v215.html`.
12. **Privacidade.** Acrescentar em `docs/PRIVACIDADE.md` que o CPF é dado pessoal, identificador de login depois da admissão, e que a senha inicial deve ser trocada no primeiro acesso.
13. **Tema escuro.** Não redesenhar o tema. As cores escuras já existem em `:root[data-theme="dark"]`. O defeito das capturas de 19/10/2026 (`/sistema`, Visão Geral e o cartaz do QR) é texto do tema claro pintado por cima: a barra lateral fica quase ilegível, e o mesmo acontece em “Pronto para uso”, nos cartões de módulo, nos indicadores e no rodapé. Trocar esses hex pelas variáveis que já mudam com o tema. O item atual do menu continua em destaque. Cartões que já são claros de propósito (boas-vindas, Memória Institucional, Agenda, Pendências) continuam claros, com texto escuro. O QR impresso continua preto no branco.
14. **Erro visível.** Toda ação que falha mostra a frase na tela, em `role="alert"`, nos dois temas. A API já devolve `{ error, code, protocol? }` em `lib/errors.ts`. Mostrar `error`. Se vier `protocol`, acrescentar `Protocolo {protocol}.` Falha de rede: `Sem resposta do sistema. Tente de novo.` Não deixar o botão só desabilitar e voltar ao normal sem texto.

## Mapa de arquivos

- Criar: `lib/cpf.ts`, `lib/cpf.test.ts`
- Criar: `lib/worker-access.ts`, `lib/worker-access.test.ts`
- Criar: `components/system-feedback.tsx`
- Criar: `supabase/migrations/202610191200_worker_cpf_access.sql`
- Alterar: `lib/workers.ts`, `lib/worker-submissions.ts`, `components/worker-ficha-form.tsx`, `app/cadastro/trabalhador/public-worker-form.tsx`
- Alterar: `app/api/workers/[id]/decision/route.ts`
- Alterar: `app/api/auth/login/route.ts`, `app/login/login-form.tsx`, `lib/auth.ts`, `lib/page-auth.ts`
- Alterar: `app/definir-senha/page.tsx`, `app/definir-senha/password-form.tsx`
- Criar: `app/api/auth/password/route.ts`
- Alterar: `app/sistema/layout.tsx`, `app/globals.css` (aviso de espera e contraste do tema escuro), `components/sidebar.tsx` (só o clique do menu; não mexer no `useEffect` do `localStorage` que o CI já aponta)
- Alterar: `docs/PRIVACIDADE.md`
- Testes existentes que montam ficha ou envio público: `lib/workers.test.ts`, `lib/worker-submissions.test.ts`

---

### Task 1: Validar CPF

**Files:**
- Create: `lib/cpf.ts`
- Create: `lib/cpf.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, expect, it } from "vitest";
import { cpfDigits, formatCpf, isValidCpf, maskCpf } from "./cpf";

describe("cpf", () => {
  it("aceita um CPF com dígitos verificadores", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(cpfDigits("529.982.247-25")).toBe("52998224725");
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
  });

  it("recusa tamanho errado, sequência repetida e dígito errado", () => {
    expect(isValidCpf("5299822472")).toBe(false);
    expect(isValidCpf("11111111111")).toBe(false);
    expect(isValidCpf("529.982.247-24")).toBe(false);
  });

  it("mascara deixando só o fim", () => {
    expect(maskCpf("52998224725")).toBe("***.***.***-25");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm exec vitest run lib/cpf.test.ts`
Expected: FAIL, módulo `./cpf` inexistente.

- [ ] **Step 3: Implementar**

```ts
export function cpfDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function isValidCpf(value: string) {
  const digits = cpfDigits(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const check = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) sum += Number(digits[index]) * (length + 1 - index);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  return check(9) === Number(digits[9]) && check(10) === Number(digits[10]);
}

export function formatCpf(value: string) {
  const digits = cpfDigits(value);
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export function maskCpf(value: string) {
  const digits = cpfDigits(value);
  return `***.***.***-${digits.slice(9)}`;
}

export const cpfSchemaMessage = "Informe um CPF válido.";
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm exec vitest run lib/cpf.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/cpf.ts lib/cpf.test.ts
git commit -m "$(cat <<'EOF'
feat: validar CPF com dígitos verificadores

EOF
)"
```

---

### Task 2: Coluna de CPF e marca de primeiro acesso

**Files:**
- Create: `supabase/migrations/202610191200_worker_cpf_access.sql`

- [ ] **Step 1: Escrever a migração**

```sql
alter table app.workers
  add column if not exists cpf text;

alter table app.workers
  drop constraint if exists workers_cpf_digits;
alter table app.workers
  add constraint workers_cpf_digits check (cpf is null or cpf ~ '^[0-9]{11}$');

create unique index if not exists workers_cpf_unique
  on app.workers (cpf) where cpf is not null;

alter table app.users
  add column if not exists cpf text,
  add column if not exists worker_id uuid references app.workers(id),
  add column if not exists must_reset_password boolean not null default false;

alter table app.users
  drop constraint if exists users_cpf_digits;
alter table app.users
  add constraint users_cpf_digits check (cpf is null or cpf ~ '^[0-9]{11}$');

create unique index if not exists users_cpf_unique
  on app.users (cpf) where cpf is not null;

create unique index if not exists users_worker_unique
  on app.users (worker_id) where worker_id is not null;
```

- [ ] **Step 2: Aplicar no banco local se o projeto já tiver o fluxo de migração documentado em `docs/LOCAL_SETUP.md`**

Não rodar `supabase db reset` se isso apaga dados que a sessão não foi pedida para apagar. Se o comando local de migração incremental existir, usá-lo. Se não houver banco local nesta sessão, a migração fica no arquivo e os testes de unidade seguem com o banco simulado dos testes atuais.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/202610191200_worker_cpf_access.sql
git commit -m "$(cat <<'EOF'
feat: guardar CPF do trabalhador e a troca obrigatória de senha

EOF
)"
```

---

### Task 3: CPF na ficha e no cadastro público

**Files:**
- Modify: `lib/workers.ts` (`fichaSchema`, `insertWorker`, `updateWorkerFicha`)
- Modify: `lib/worker-submissions.ts` (`submissionPayloadSchema`, `fichaFromSubmission`, `submissionDiff`)
- Modify: `components/worker-ficha-form.tsx` (`FichaValues`, `readFicha`, o campo visual depois de Nome completo)
- Modify: `app/cadastro/trabalhador/public-worker-form.tsx` (campo e o JSON do POST)
- Modify: `app/sistema/trabalhadores/[id]/ficha/page.tsx` (linha do CPF na leitura da ficha)
- Modify: testes em `lib/workers.test.ts` e `lib/worker-submissions.test.ts` que montam o objeto da ficha ou do envio

- [ ] **Step 1: Teste do schema**

Em `lib/worker-submissions.test.ts`, um caso novo:

```ts
it("exige CPF válido no envio público", () => {
  expect(submissionPayloadSchema.safeParse({ ...validPayload, cpf: "" }).success).toBe(false);
  expect(submissionPayloadSchema.safeParse({ ...validPayload, cpf: "529.982.247-25" }).success).toBe(true);
});
```

`validPayload` é o objeto que o arquivo já usa nos outros casos. Acrescente `cpf: "529.982.247-25"` nele para os casos que devem continuar passando. O parse deve guardar `52998224725`.

Em `lib/workers.test.ts`, o mesmo para `fichaSchema`: sem `cpf` falha; com CPF válido o resultado traz os 11 dígitos.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm exec vitest run lib/workers.test.ts lib/worker-submissions.test.ts`
Expected: FAIL nos casos novos.

- [ ] **Step 3: Schema e persistência**

Em `fichaSchema` e `submissionPayloadSchema`, campo:

```ts
cpf: z.string().trim().refine(isValidCpf, cpfSchemaMessage).transform(cpfDigits),
```

`fichaFromSubmission` copia `payload.cpf`. `submissionDiff` ganha a linha `{ field: "cpf", label: "CPF", before: formatCpf(existing.cpf ?? ""), after: formatCpf(next.cpf) }` quando os dígitos diferem. Incluir `cpf` no tipo `ExistingFicha`.

`insertWorker`: coluna `cpf` no `insert`, valor `input.cpf`. `updateWorkerFicha`: `cpf=$…` no `update`. Ajustar a lista de parâmetros e os testes que inspecionam a SQL simulada (`values[n]`), sem mudar o significado dos campos que já existem.

Formulários, logo após o nome:

```tsx
<label>CPF *
  <input name="cpf" required inputMode="numeric" autoComplete="off" minLength={11} maxLength={14}
    placeholder="000.000.000-00" defaultValue={initial?.cpf ? formatCpf(initial.cpf) : undefined} />
</label>
```

No público, sem `defaultValue`. `readFicha` inclui `cpf: text("cpf")`. O POST público inclui `cpf` no JSON.

Na página de leitura da ficha, uma linha `["CPF", ficha.cpf ? formatCpf(ficha.cpf) : "Não informado"]`. O `select` dessa página precisa trazer `w.cpf`.

- [ ] **Step 4: Rodar os testes desses arquivos**

Run: `pnpm exec vitest run lib/workers.test.ts lib/worker-submissions.test.ts lib/cpf.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/workers.ts lib/worker-submissions.ts lib/workers.test.ts lib/worker-submissions.test.ts components/worker-ficha-form.tsx app/cadastro/trabalhador/public-worker-form.tsx app/sistema/trabalhadores/[id]/ficha/page.tsx
git commit -m "$(cat <<'EOF'
feat: exigir CPF no cadastro do trabalhador

EOF
)"
```

---

### Task 4: Criar o acesso na aprovação

**Files:**
- Create: `lib/worker-access.ts`
- Create: `lib/worker-access.test.ts`
- Modify: `app/api/workers/[id]/decision/route.ts`

- [ ] **Step 1: Teste da função pura**

```ts
import { describe, expect, it } from "vitest";
import { accessEmailForCpf, initialPasswordForCpf } from "./worker-access";

describe("acesso do trabalhador", () => {
  it("usa o CPF como senha e como usuário institucional", () => {
    expect(initialPasswordForCpf("529.982.247-25")).toBe("52998224725");
    expect(accessEmailForCpf("52998224725")).toBe("52998224725@acesso.lardabencao.org");
  });
});
```

- [ ] **Step 2: Implementar as funções e o provisionamento**

`lib/worker-access.ts` exporta `accessEmailForCpf`, `initialPasswordForCpf` e `provisionWorkerAccess`.

`provisionWorkerAccess` recebe o client da transação, o worker `{ id, full_name, cpf, departments }`, o `authorId` e um `createAuthUser` injetável (nos testes, um fake; na rota, `createAdminClient().auth.admin.createUser`).

Regras, nesta ordem:

- Sem `cpf` ou CPF inválido: `AppError("Preencha o CPF na ficha antes de aprovar.", 409, "CPF_REQUIRED")`.
- `select id from app.users where worker_id = $1`: se existir, devolver esse id e não criar outra conta.
- `select id from app.users where cpf = $1`: se existir em outra ficha, `AppError("Este CPF já tem acesso ao sistema.", 409, "CPF_IN_USE")`.
- Criar o usuário Auth com `email: accessEmailForCpf(cpf)`, `password: initialPasswordForCpf(cpf)`, `email_confirm: true`. Se a API recusar, `AppError` com a mensagem do Supabase e código `AUTH_CREATE_FAILED` (a transação da rota ainda não gravou a aprovação).
- Inserir em `app.users`: `auth_user_id`, `email` sintético, `full_name`, `role_key = 'trabalhador'`, `status = 'active'`, `cpf`, `worker_id`, `must_reset_password = true`, `created_by` / `updated_by` = autor.
- Inserir `app.user_departments` para cada departamento da ficha.
- Auditoria (a rota já audita a aprovação; acrescentar no `details` a frase `Acesso criado. Login pelo CPF ${maskCpf(cpf)}. Troca de senha obrigatória no primeiro acesso.`). Não incluir a senha.

A rota de decisão, só quando `approved`:

1. Ler também `w.cpf` no `select ... for update`.
2. Chamar `provisionWorkerAccess` **antes** do `insert` da decisão e do `update` que marca `active`.
3. Se o Auth foi criado e o `transaction` falhar depois, chamar `auth.admin.deleteUser` no `catch` com o id recém-criado, e relançar o erro. Se a conta já existia (`worker_id` preenchido), não apagar o usuário Auth.

- [ ] **Step 3: Teste do fluxo com query falsa**

No mesmo arquivo de teste, simular `query` em memória:

- ficha sem CPF → erro `CPF_REQUIRED` e `createAuthUser` não é chamado
- CPF já usado por outro `app.users` → `CPF_IN_USE`
- aprovação feliz → `createAuthUser` chamado com senha `52998224725` e e-mail `52998224725@acesso.lardabencao.org`; insert de `app.users` com `must_reset_password` true e papel `trabalhador`; departamentos copiados
- segunda chamada com o mesmo `worker_id` → `createAuthUser` não é chamado de novo

- [ ] **Step 4: Rodar**

Run: `pnpm exec vitest run lib/worker-access.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/worker-access.ts lib/worker-access.test.ts app/api/workers/[id]/decision/route.ts
git commit -m "$(cat <<'EOF'
feat: abrir acesso com o CPF quando a ficha é aprovada

EOF
)"
```

---

### Task 5: Entrar com o CPF e trocar a senha no primeiro acesso

**Files:**
- Modify: `app/api/auth/login/route.ts`
- Modify: `app/login/login-form.tsx`
- Modify: `lib/auth.ts` (incluir `mustResetPassword` no `Actor`)
- Modify: `lib/page-auth.ts`
- Modify: `app/definir-senha/page.tsx`
- Modify: `app/definir-senha/password-form.tsx`
- Create: `app/api/auth/password/route.ts`
- Test: criar `lib/login-identifier.test.ts` se a resolução do identificador for extraída para uma função pura; senão cobrir a função no arquivo ao lado da rota. Preferir função pura em `lib/login-identifier.ts`.

- [ ] **Step 1: Função pura do identificador**

```ts
export function loginIdentifier(value: string): { kind: "email"; email: string } | { kind: "cpf"; cpf: string } | { kind: "invalid" } {
  const trimmed = value.trim();
  if (trimmed.includes("@")) return { kind: "email", email: trimmed.toLowerCase() };
  if (isValidCpf(trimmed)) return { kind: "cpf", cpf: cpfDigits(trimmed) };
  return { kind: "invalid" };
}
```

Testes: `usuario@lar.org` → email; `529.982.247-25` → cpf; `123` → invalid.

- [ ] **Step 2: Login**

`POST /api/auth/login` continua recebendo `{ email, password }` para não quebrar o cliente no meio da troca. O campo `email` passa a aceitar os dois formatos (o nome do JSON fica; o rótulo da tela muda).

- `invalid` → 400 `Informe um CPF válido ou o e-mail institucional.`
- `cpf` → `select email, must_reset_password from app.users where cpf = $1 and status = 'active'`. Sem linha, responder como senha inválida (a frase genérica já usada). Com linha, `signInWithPassword({ email: row.email, password })`.
- `email` → caminho atual.
- Resposta quando o login funciona e `must_reset_password` é true: `{ next: "/definir-senha?motivo=primeiro-acesso" }`. Caso contrário, `{ next: "/sistema" }`.
- A chave de throttle do CPF é os 11 dígitos.

Tela `app/login/login-form.tsx`:

- label `CPF ou e-mail institucional`
- `type="text"`, `autoComplete="username"`, sem `type="email"`
- `minLength={11}` (o CPF tem 11; a senha inicial também). O campo senha fica `minLength={11}` só neste formulário. A troca de senha continua em 14.

- [ ] **Step 3: Bloquear o sistema até trocar a senha**

`requireActor` inclui `u.must_reset_password` no `select` e no tipo `Actor` como `mustResetPassword: boolean`.

`requirePageActor`, depois de carregar o ator e **antes** da checagem de termos:

```ts
if (actor.mustResetPassword) redirect("/definir-senha?motivo=primeiro-acesso");
```

`/definir-senha` não usa `requirePageActor` (hoje já usa só `getUser`). Manter assim para não redirecionar para si mesmo.

- [ ] **Step 4: Troca da senha inicial**

`app/api/auth/password/route.ts` `POST`, sessão obrigatória, mesma origem:

```ts
const schema = z.object({
  password: z.string().min(14, "Use pelo menos 14 caracteres."),
  confirmation: z.string()
});
```

- Confirmação diferente → 400 `A confirmação não confere.`
- Carregar `cpf` e `must_reset_password` do usuário. Se `cpfDigits(password) === cpf` → 400 `A senha nova não pode ser o CPF.`
- `supabase.auth.updateUser({ password })` com o client da sessão.
- `update app.users set must_reset_password = false, updated_at = now() where id = $1`
- Auditoria `Senha definida no primeiro acesso` quando a marca estava true; senão `Senha definida ou alterada`.
- Resposta `{ next: "/sistema" }`.

`password-form.tsx` envia a senha para essa rota em vez de `updateUser` direto. Enquanto `busy`, o botão usa a classe `is-loading` e o texto `Salvando a nova senha…`. Erro aparece no `role="alert"` que já existe. Sucesso: `router.push(next)`.

`page.tsx` lê `searchParams.motivo`. Quando for `primeiro-acesso`, o parágrafo é: `Sua senha inicial é o seu CPF. Troque agora por uma senha exclusiva, com pelo menos 14 caracteres, diferente do CPF.`

- [ ] **Step 5: Testes**

Run: `pnpm exec vitest run lib/login-identifier.test.ts lib/cpf.test.ts lib/worker-access.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/login-identifier.ts lib/login-identifier.test.ts app/api/auth/login/route.ts app/login/login-form.tsx lib/auth.ts lib/page-auth.ts app/definir-senha/page.tsx app/definir-senha/password-form.tsx app/api/auth/password/route.ts
git commit -m "$(cat <<'EOF'
feat: entrar com o CPF e obrigar a troca da senha inicial

EOF
)"
```

---

### Task 6: Aviso ao trocar de módulo e ao gravar uma ação

**Files:**
- Create: `components/system-feedback.tsx`
- Modify: `app/sistema/layout.tsx`
- Modify: `app/globals.css`
- Modify: `components/sidebar.tsx` (atributo no link, somente)
- Modify: `app/cadastro/trabalhador/public-worker-form.tsx` (o botão público fica fora do shell)

O shell cobre os botões de `/sistema`. O cadastro público fica de fora e precisa do próprio aviso.

- [ ] **Step 1: Barra e texto no shell**

`components/system-feedback.tsx` é client component, montado em `app/sistema/layout.tsx` dentro de `.app-main`, antes de `{children}`.

Comportamento:

- Clique em `a.nav-link` (capture): guardar o texto de `.nav-label`, mostrar a barra e o status `Abrindo {rótulo}…`.
- Quando `usePathname()` mudar: status `Módulo aberto.` e esconder a barra depois de 900 ms.
- Clique em `button` dentro de `.app-main`: acrescentar `is-loading` nesse botão e status `Aguarde, registrando sua ação…`.
- Envolver `window.fetch` uma vez (`const original = window.fetch`). Só contar pedidos same-origin cujo pathname começa com `/api/` e que começaram até 1,5 s depois do clique. Ao terminar o último: se `response.ok`, status `Pronto. Ação registrada.`. Se não for `ok`, ler o JSON e mostrar o campo `error` (mais `Protocolo {protocol}.` quando existir), num bloco `error` com `role="alert"`. Sem JSON, mostrar `Não foi possível concluir a operação.` Se o `fetch` lançar, mostrar `Sem resposta do sistema. Tente de novo.` Tirar `is-loading` do botão. A Task 9 detalha esse alerta.
- Se o clique no botão não gerar `/api/` em 600 ms, limpar o status e o `is-loading` (botão que só mexe na tela).
- No cleanup, devolver `window.fetch` original. Guardar a função com uma marca para o Strict Mode não embrulhar duas vezes.
- Um único `<p className="ops-save" role="status" aria-live="polite">` com a frase. A barra é `<div className="route-progress" hidden={barra oculto}>`.

Não embrulhar `fetch` de navegação RSC. Por isso o filtro é só `/api/`.

CSS em `app/globals.css`:

```css
.route-progress { position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 80; background: #1d4e89; transform-origin: left; animation: lar-route 1s ease-in-out infinite; }
.route-progress[hidden] { display: none; }
@keyframes lar-route { 0% { transform: scaleX(.15); } 50% { transform: scaleX(.85); } 100% { transform: scaleX(.15); } }
```

No tema escuro, a barra usa `#8eb6e8` se o arquivo já tiver um bloco `[data-theme="dark"]` ou classe equivalente. Procurar o seletor de tema que o projeto já usa e repetir a cor lá. Não criar tema novo.

- [ ] **Step 2: Cadastro público**

No submit de `public-worker-form.tsx`: botão com `is-loading` enquanto `busy`; região `role="status"` com `Enviando o cadastro…` durante o envio, a mensagem de sucesso que o formulário já mostra quando termina, e o erro atual em `role="alert"`.

- [ ] **Step 3: Ver na tela**

Subir o app (`pnpm dev` se já não estiver rodando). No browser:

- Entrar em `/sistema` com um usuário de teste já existente.
- Clicar num módulo da barra lateral. A barra aparece e a frase muda para `Abrindo …` e depois `Módulo aberto.`
- Salvar uma ficha ou qualquer formulário que chame `/api/`. A frase passa por `Aguarde…` e chega em `Pronto. Ação registrada.` ou na frase de falha.
- Abrir `/cadastro/trabalhador`, enviar sem CPF: o navegador bloqueia o campo obrigatório. Enviar com CPF inválido no servidor (se o HTML deixar passar): a mensagem de erro fica visível.

- [ ] **Step 4: Commit**

```bash
git add components/system-feedback.tsx app/sistema/layout.tsx app/globals.css components/sidebar.tsx app/cadastro/trabalhador/public-worker-form.tsx
git commit -m "$(cat <<'EOF'
feat: avisar enquanto o módulo abre e a ação é gravada

EOF
)"
```

---

### Task 7: Privacidade e verificação final

**Files:**
- Modify: `docs/PRIVACIDADE.md`

- [ ] **Step 1: Um parágrafo curto**

No ponto que lista dados do trabalhador, incluir: o CPF é obrigatório no cadastro; depois da aprovação ele é o usuário de login; a senha inicial é o próprio CPF e o sistema exige a troca no primeiro acesso; a senha não é gravada em auditoria; o CPF na auditoria da criação do acesso aparece mascarado.

- [ ] **Step 2: Testes unitários dos arquivos tocados**

Run: `pnpm exec vitest run lib/cpf.test.ts lib/worker-access.test.ts lib/login-identifier.test.ts lib/workers.test.ts lib/worker-submissions.test.ts`
Expected: PASS

Não rodar `tests/e2e/fundacao-onda1.spec.ts`.

- [ ] **Step 3: Commit**

```bash
git add docs/PRIVACIDADE.md
git commit -m "$(cat <<'EOF'
docs: registrar o CPF como dado de login do trabalhador

EOF
)"
```

---

### Task 8: Tema escuro legível

**Referência visual:** capturas de `https://sistema.lardabencao.org/sistema` em 19/10/2026. A barra lateral está quase apagada. Só ficam legíveis o item atual (pílula branca, “Visão Geral”) e o campo de busca (fundo branco). O mesmo tom some em “Pronto para uso”, nos cartões de módulo, nos quatro indicadores e no rodapé.

**Causa:** `app/globals.css` já escurece o fundo com os tokens (`--blue-100: #1b323f` na lateral, `--cream: #101a22` na página, `--surface: #17242e` nos cartões). Vários textos continuam com hex do tema claro, então azul-escuro fica em cima de azul-escuro. Exemplos: `.nav-link { color: #294f63 }`, `.sidebar .brand-lockup strong { color: #203e50 }`, `.ops-save { color: #346849 }`, `.mods .mod strong { color: #203e50 }`, `.op-stat > b { color: #203e50 }`, `.lar-system-footer { color: #617683 }`, `.page-heading h1 { color: #203e50 }`.

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Trocar o hex do shell pelas variáveis**

Na barra lateral, no título da página e no status, usar as variáveis que já existem. No tema claro elas continuam escuras; no escuro elas já são claras (`--text-nav: #bcd4e2`, `--blue-900: #e7eef2`, `--muted: #9db3c0`, `--success: #6fbf95`).

| Regra | Trocar para |
| --- | --- |
| `.sidebar .brand-lockup strong` | `color: var(--blue-900)` |
| `.sidebar .brand-lockup small`, `.sidebar .module-search`, `.nav-group > summary`, `.nav-group > summary::after` | `color: var(--muted)` |
| `.nav-link`, `.sidebar-collapse` | `color: var(--text-nav)`; hover `background: var(--surface-hover); color: var(--blue-900)` |
| `.nav-link[data-current="true"]` | `background: var(--surface); color: var(--blue-700)` |
| `.nav-icon` | `color: var(--blue-800)` |
| `.page-heading h1` | `color: var(--blue-900)` |
| `.page-heading p`, `.lar-demo-note` | `color: var(--muted)` |
| `.ops-save` | `color: var(--success)` |
| bordas `#dae5e9` / `#c7dce4` da lateral e do status | `var(--line)` |

O campo “Nome do departamento” pode continuar com fundo claro e texto escuro: é um input, e nas capturas ele já se lê.

- [ ] **Step 2: Os outros pontos das capturas**

Mesma troca, só onde o fundo já é token escuro no tema dark:

- `.mods .mod strong` → `var(--blue-900)`; `.mods .mod p` → `var(--muted)`; borda → `var(--line)`.
- `.op-stat` (fundo `var(--surface)`): rótulo `var(--muted)`, número `var(--blue-900)`, legenda `var(--muted)`, borda `var(--line)`. O número de pendência (`.op-stat.op-pending > b`) usa `var(--warning)`.
- `.lar-system-footer`: texto `var(--muted)`, `strong` `var(--blue-800)`, borda `var(--line)`.
- `.visual-suggestions-hint` e o “+” do sumário, no tema escuro: `var(--muted)`. O bloco já ganha `background: var(--surface)` no override escuro.
- `.notice` já usa `var(--blue-100)`. Conferir o aviso azul do cartaz do QR: texto herdado precisa ser `var(--blue-900)`.

Não mudar o cartão de boas-vindas (`.card.lar-welcome`, fundo `#eaf3f6`), a Memória Institucional (`.home-institution-card`, fundo `#fff`), Agenda e Pendências (`.op-section`, fundo `#fff`). Eles são painéis claros de propósito e o texto escuro neles está certo. Não mudar as cores do SVG do QR (`#000` / `#fff` em `app/sistema/admissoes/cadastros-online/qr/page.tsx`).

- [ ] **Step 3: Conferir nos dois temas**

Com o app aberto, alternar o tema e olhar, nesta ordem: `/sistema` (cartões de módulo, rodapé, “Pronto para uso”), a Visão Geral (indicadores) e `/sistema/admissoes/cadastros-online/qr` (aviso e texto em volta do código). No escuro, o menu inativo, o nome “Lar da Bênção”, “Diretoria”, os cartões e o rodapé precisam ser lidos sem encostar o olho. No claro, o menu continua azul-escuro sobre a lateral clara. Item atual continua destacado nos dois.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "$(cat <<'EOF'
fix: deixar a barra lateral e os cartões legíveis no tema escuro

EOF
)"
```

---

### Task 9: Mostrar o erro da ação

**Files:**
- Modify: `components/system-feedback.tsx` (criado na Task 6)
- Modify: `app/cadastro/trabalhador/public-worker-form.tsx`
- Modify: `app/login/login-form.tsx`
- Modify: `app/definir-senha/password-form.tsx`
- Modify: `app/sistema/admissoes/admissions-client.tsx`

- [ ] **Step 1: O shell lê a mensagem da API**

No embrulho de `fetch` da Task 6, quando `response.ok` for falso:

```ts
const body = await response.clone().json().catch(() => null) as { error?: string; protocol?: string } | null;
const detail = body?.error || "Não foi possível concluir a operação.";
const protocol = body?.protocol ? ` Protocolo ${body.protocol}.` : "";
setAlert(`${detail}${protocol}`);
```

`setAlert` renderiza `<p className="error" role="alert">`. Sucesso continua em `<p className="ops-save" role="status">`. Os dois não aparecem ao mesmo tempo. Limpar o alerta no próximo clique.

Isso cobre os botões de `/sistema` que chamam `/api/`, inclusive aprovação de ficha, gravação e falha 409 do CPF.

- [ ] **Step 2: Telas fora do shell**

Estas três não passam pelo shell. Cada uma já tem um estado de erro; garantir que a frase do servidor (ou a frase de rede) apareça num bloco `.error` com `role="alert"`, e que o botão mostre `is-loading` enquanto espera:

- Login: CPF inválido, senha errada (`E-mail ou senha inválidos.`) e rede.
- Definir senha: confirmação diferente, senha igual ao CPF, senha curta, falha do Auth.
- Cadastro público: resposta não ok do `POST /api/public/worker-submissions`, mostrando `error` do JSON; rede com `Sem resposta do sistema. Tente de novo.`

- [ ] **Step 3: Ver na tela**

- No login, senha errada: a frase fica visível, o botão sai do carregando.
- Numa ação autenticada que a API recusa (por exemplo aprovar ficha sem CPF, depois da Task 4): o alerta mostra `Preencha o CPF na ficha antes de aprovar.`
- Desligar a rede no devtools e gravar de novo: aparece `Sem resposta do sistema. Tente de novo.`

- [ ] **Step 4: Commit**

```bash
git add components/system-feedback.tsx app/cadastro/trabalhador/public-worker-form.tsx app/login/login-form.tsx app/definir-senha/password-form.tsx app/sistema/admissoes/admissions-client.tsx
git commit -m "$(cat <<'EOF'
fix: mostrar na tela a mensagem quando uma ação falha

EOF
)"
```

---

## Self-review

- Cobertura do pedido: aviso na troca de módulo e no clique que grava; CPF obrigatório nos dois cadastros; na admissão o login e a senha inicial são o CPF; a troca é obrigatória no primeiro acesso; tema escuro legível na lateral e nos blocos citados das capturas; erro de ação visível, com a frase da API.
- O CPF de 11 dígitos não passa pela regra de 14. Essa regra fica na senha nova.
- Contas antigas continuam entrando com e-mail. Fichas antigas sem CPF não ganham acesso até alguém preencher o campo.
- Sem marcadores `TBD`. Sem alteração na demonstração HTML.
- O `useEffect` de `localStorage` em `components/sidebar.tsx` que o CI já reprova fica como está.
- Painéis claros de propósito (boas-vindas, memória, agenda, pendências) e o QR preto no branco ficam como estão.
