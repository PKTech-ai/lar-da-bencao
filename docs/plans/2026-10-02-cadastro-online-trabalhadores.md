# Plano — Cadastro online de trabalhadores (formulário público via QR code)

> Para o próximo chat: leia este arquivo inteiro antes de começar. As **decisões em aberto (seção 2)** precisam ser confirmadas com o usuário antes de escrever código. Siga o `AGENTS.md` (Next.js 16 com mudanças incompatíveis: consulte `node_modules/next/dist/docs/` antes de usar qualquer API).

## 1. Objetivo

Os trabalhadores do Lar da Bênção preenchem ou atualizam a própria ficha pelo celular, abrindo um link ou lendo um QR code, **sem precisar de login**. Os dados chegam ao sistema e passam a fazer parte do cadastro de trabalhadores (`app.workers`).

Prioridade do usuário: primeiro o **cadastro dos trabalhadores**. Outros cadastros online ficam para depois.

## 2. Decisões em aberto (perguntar antes de implementar)

1. **Revisão antes de gravar (recomendado) ou gravação direta?**
   Recomendação: o envio público cai numa **fila de revisão** (`app.worker_submissions`). A Secretaria confere, vincula a uma ficha existente ou cria uma nova, e só então grava em `app.workers`.
   Motivo: o formulário é anônimo. Sem revisão, qualquer pessoa com o link poderia sobrescrever a ficha de outra.
2. **Como identificar quem já tem cadastro?** Hoje `app.workers` **não tem CPF** nem outro identificador único; existem fichas importadas da v215.
   Opções:
   - (a) a Secretaria vincula manualmente, com sugestão automática por nome + data de nascimento + telefone (recomendado para começar);
   - (b) acrescentar CPF à ficha (coluna nova, única, validada; muda a base legal no `docs/PRIVACIDADE.md`);
   - (c) link individual por trabalhador (token) já preenchido com os dados atuais. Mais seguro para "atualizar", mas exige mandar um link para cada pessoa; não serve para um QR code único.
3. **Quais campos o trabalhador preenche?** Proposta (subconjunto de `fichaSchema` em `lib/workers.ts`):
   - nome completo, telefone, e-mail, data de nascimento, naturalidade, estado civil, profissão, endereço;
   - departamentos em que atua (lista de `app.departments` ativos);
   - funções da Doutrina (só se marcar Doutrina);
   - dias disponíveis;
   - descrição do serviço voluntário;
   - aceite do termo de voluntariado (Lei 9.608/98), autorização de imagem e ciência do aviso de privacidade.

   **Não** expor no formulário público: contribuição mensal, dia previsto, observações internas, status.
4. **O formulário fica aberto sempre ou por campanha?** Recomendado: liga e desliga por feature flag (`public_worker_form`) em "Módulos e ondas".
5. **Domínio:** o QR code precisa apontar para uma URL estável. Hoje `sistema.lardabencao.org` está fora do ar porque a troca de nameservers na Locaweb está travada (chamado em aberto). Confirme qual URL usar no QR **antes de imprimir**, porque reimprimir custa caro. O link deve sair de `APP_URL`, nunca de um valor fixo no código.

### Decisões confirmadas com o usuário (2026-10-02)

1. **Fila de revisão.** O envio público só grava em `app.worker_submissions`.
2. **Vínculo manual com sugestão** por nome (sem acento) ou nascimento + telefone. Sem CPF.
3. **Campos:** a lista proposta acima. Obrigatórios: nome, telefone com DDD, nascimento, ao menos um departamento, aceite do termo de voluntariado e ciência do aviso de privacidade.
4. **Flag `public_worker_form`, começando desligada.**
5. **URL do QR:** `https://sistema.lardabencao.org/cadastro/trabalhador` (sai de `APP_URL`). O cartaz só deve ser impresso depois que o domínio voltar ao ar.
6. **Quem revisa (seção 4.4):** somente o Administrador (permissão `modules:admin`), não a Secretaria. Onde este plano diz “a Secretaria confere”, leia-se “o Administrador confere”.
7. **Dependência (seção 4.5):** pacote `qrcode` aprovado.

## 3. Como o sistema funciona hoje (verificado em 2026-10-02)

- **Ficha:** `app.workers` (+ `app.worker_departments`), schema em `supabase/migrations/202609161200_business_wave1.sql` e `202609161330_worker_admissions.sql`; contribuição em `202609172300_contribuicoes_por_trabalhador.sql`.
- **Validação e regras:** `lib/workers.ts`:
  - `fichaSchema` e `normalizeFicha`: funções só valem para quem marcou Doutrina;
  - `statusAfterEdit`: mudar departamentos ou funções de uma ficha aprovada a devolve para `pending`.
- **Criação interna:** `POST /api/workers` (`app/api/workers/route.ts`). Exige login e a flag `module_workers`, nasce `pending` e é auditada no Dedo-duro (`appendAudit`).
- **Aprovação:** Diretoria em `/sistema/admissoes` (`app/api/workers/[id]/decision`).
- **Formulário interno reaproveitável como referência:** `components/worker-ficha-form.tsx` (layout, `readFicha`).
- **Rotas públicas:** lista `publicPaths` em `proxy.ts`. Toda rota pública nova precisa entrar nela.
- **Proteções existentes para copiar:**
  - `assertSameOrigin` (`lib/csrf.ts`);
  - limitação por IP e hash (`lib/login-throttle.ts` + tabela `app.auth_attempts`);
  - `errorResponse` (`lib/errors.ts`);
  - auditoria (`lib/audit.ts`).
- **CSP** (cabeçalhos em `next.config.ts`): `img-src 'self' data: blob:`. Um QR gerado como data URI ou SVG inline funciona sem mudar a CSP.
- **Tema:** o tema escuro já existe. Use só as classes de `app/globals.css` (`auth-shell`, `auth-card`, `form-stack`, `form-row`, `check-grid`, `button primary`, `notice`, `error`, `success`) e nenhuma cor fixa.

## 4. Desenho proposto (assumindo a recomendação de cada item da seção 2)

### 4.1 Banco: nova migration `supabase/migrations/2026MMDDHHMM_worker_submissions.sql`

`app.worker_submissions`:
- `id`, `created_at`;
- `payload jsonb` com os campos do formulário, validados;
- `status`: `received` | `applied` | `discarded`;
- `matched_worker_id` (nulo até vincular);
- `reviewed_by`, `reviewed_at`, `review_note`;
- `ip_hash`, `user_agent` (truncado);
- `privacy_version` (versão do aviso aceito).

Mais: um índice por `status` e o grant para `lar_app`, seguindo o padrão das migrations existentes. Nada é gravado em `app.workers` no envio público.

### 4.2 Página pública `app/cadastro/trabalhador/page.tsx` (mobile first)

- Layout `auth-shell` / `auth-card` com a marca (`components/brand.tsx`).
- Campos de 16px no celular; isso já vale em `globals.css` abaixo de 720px.
- Mostra "Formulário fechado" quando a flag está desligada.
- Inclui um campo honeypot escondido contra robôs.
- Exibe o texto do aviso de privacidade e os termos antes do botão de envio.
- Termina numa tela de confirmação, sem mostrar nenhum dado de volta.
- Adicionar `/cadastro` em `publicPaths` (`proxy.ts`).

### 4.3 API pública `POST /api/public/worker-submissions`

- Adicionar `/api/public` em `publicPaths`.
- `assertSameOrigin`, schema zod próprio (subconjunto do `fichaSchema`, mesma normalização), rejeição se o honeypot vier preenchido.
- Limite por IP (ex.: 5 envios por hora), reaproveitando o mecanismo de `lib/login-throttle.ts` ou criando um equivalente.
- Grava em `app.worker_submissions` e audita com ator nulo ("Envio de cadastro online de trabalhador", sem dados pessoais no `details`).
- Resposta genérica, sem revelar se a pessoa já existe.

### 4.4 Revisão interna `/sistema/trabalhadores/cadastros-online`

- **Quem acessa:** perfis com `secretaria:update`; ou também o departamento? Confirmar com o usuário.
- **Listagem:** envios `received` com sugestões de ficha parecida (mesmo nome normalizado sem acento, ou mesmo nascimento + telefone).
- **Ações:**
  - **Vincular e atualizar ficha existente:** mostra a diferença campo a campo e aplica com `version` (controle de concorrência), respeitando `statusAfterEdit`.
  - **Criar nova ficha:** reaproveita a lógica do `POST /api/workers` (nasce `pending` para a Diretoria aprovar, como hoje).
  - **Descartar** (com motivo).
- Cada ação é auditada.
- Contador de pendentes no menu ou na Visão Geral (opcional).
- Extrair a lógica de inserção do `POST /api/workers` para uma função em `lib/workers.ts`, usada pelas duas rotas, para não duplicar.

### 4.5 QR code na tela de trabalhadores

- Botão "QR code do cadastro online" mostra o QR de `${APP_URL}/cadastro/trabalhador` e uma versão para imprimir (cartaz A4).
- Gerar no servidor como SVG (ex.: pacote `qrcode`; confirmar com o usuário antes de adicionar a dependência).

### 4.6 Privacidade

- Atualizar `docs/PRIVACIDADE.md`: nova origem de coleta (formulário público), retenção dos envios descartados (sugestão: 90 dias) e quem acessa.
- Se entrar CPF (item 2b), registrar a base legal.
- Expurgo dos envios `discarded` e `applied` antigos no job de manutenção existente (`/api/maintenance/integrity`), se fizer sentido.

## 5. Testes

- **Unitários (vitest, padrão de `lib/*.test.ts`):**
  - schema público: campos proibidos são ignorados ou rejeitados;
  - honeypot;
  - limite por IP;
  - sugestão de vínculo;
  - aplicação numa ficha existente (inclui o caso `statusAfterEdit` → `pending`);
  - criação nova continua `pending`;
  - acesso negado na revisão para quem não tem permissão.
- **e2e (`tests/e2e`):** envio anônimo pelo celular (viewport mobile) → aparece na revisão → aplicar → ficha atualizada e auditada.
- **Verificação:** `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, e conferência visual da página pública em tema claro e escuro na largura de celular (Playwright, `colorScheme`).

## 6. Ordem sugerida

1. Confirmar as decisões da seção 2.
2. Migration + função compartilhada em `lib/workers.ts` + testes.
3. API pública + página pública + `publicPaths` + flag.
4. Tela de revisão.
5. QR code e cartaz.
6. Docs de privacidade e UAT (`docs/UAT_*.md`).
7. PR para `main`. O merge dispara o deploy na Vercel; a migration precisa ser aplicada no banco de produção.
