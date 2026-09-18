# BACKLOG_OPERACIONAL

Inventário operacional da migração **v215 (mock HTML em `dist/index.html`) → v216 (Next.js + Supabase/Postgres)**.

**Fontes auditadas (repo flattenado na raiz):**
- Mock: `dist/index.html` (~16 `data-page`, storage `KEY=lar_bencao_demo_integrado_2026_v121_parecer_cf_estatuto_regimento`, IndexedDB `KEY_voluntariado_arquivos` stores `files`/`chunks`, session `lar_dt127_home_after_reset`)
- App: `app/login|mfa|recuperar|definir-senha|sistema/{auditoria,anexos,usuarios}` + `app/api/{auth,users,audit,attachments,bootstrap,health,maintenance}`
- Lib: `auth`, `permissions`, `audit`, `attachments`, `db`, `csrf`, `env`, `supabase/*`
- Schema: `supabase/migrations/202609150001_initial.sql` — tabelas `roles`, `departments`, `users`, `user_departments`, `role_permissions`, `feature_flags`, `audit_events`, `attachments`, `attachment_chunks`, `legacy_imports`; flags `audit=true`, `attachments=true`, `legacy_import=false`, `business_modules=false`
- PRD: ondas 1–3 + gates §14; RF-001..015
- Visual: `theme-215/theme.css|js` **não** incorporado em `app/globals.css`
- **Atualização 2026-09-16:** itens BL-001/002/003/005/010/011/013/014/021/022/027/028/029/056/058–063 revisados; cada um traz “Entregue” e “Pendências”. Migrações novas: `202609161300`…`202609161410`.

**Legenda de estado v216:** `já coberto` · `parcial` · `placeholder` · `só HTML` · `furo ops`

---

## Fundação (bloqueia qualquer onda com dados reais)

### BL-001 — Códigos de recuperação MFA (uso único)
- **Módulo:** Autenticação / RF-001
- **Severidade:** bloqueia uso
- **Onda:** fundação
- **Origem mock:** N/A (auth real inexistente no HTML; sessão demo por perfil)
- **Estado v216:** já coberto (código + testes automatizados; falta a validação manual contra Supabase local, ver abaixo)
- **Entregue (2026-09-16):**
  - schema: `app.mfa_recovery_codes` (só hash SHA-256; códigos de 80 bits `XXXXX-XXXXX-XXXXX-XXXXX`, entrada normalizada)
  - API: `POST /api/mfa/recovery-codes` (aal2; invalida emissão anterior), `PUT` (consumo único → invalida os demais, remove fator TOTP via Admin API, encerra as outras sessões; 5 falhas/15 min → 429; sucesso, falha e bloqueio auditados no Dedo-duro)
  - API admin: `POST /api/users/[id]/mfa/reset` (`users.admin`, aal2; remove fatores, invalida códigos, encerra sessões; vedado para a própria conta; nunca devolve códigos)
  - UI: `/mfa` mostra os códigos na ativação; “Perdeu o autenticador?” consome o código e leva direto ao recadastro TOTP + novos códigos; `/sistema/usuarios` ganhou “Redefinir MFA”
  - teste: `lib/mfa-recovery.test.ts` (consumo único, invalidação após uso, bloqueio sem aal2, limite de tentativas, rollback se o Auth falhar, reset admin)
- **Pendências residuais:**
  - validação manual ponta a ponta em Supabase local (ativar → usar código → recadastrar → conferir o Dedo-duro)
  - reemissão de códigos pelo titular já autenticado fica com BL-004 (tela de troca de aparelho)
  - notificação ao titular sobre redefinição de MFA fica com BL-004
- **Critério de aceite:** ✅ usuário ativa TOTP, recebe códigos de recuperação de uso único; ✅ login com código consome e audita; ✅ admin não visualiza códigos; ✅ comportamento alinhado a RF-001 sem depender de localStorage.

### BL-002 — Revogação administrativa de sessões
- **Módulo:** Autenticação / Controle de Acesso
- **Severidade:** bloqueia uso
- **Onda:** fundação
- **Origem mock:** `page-acesso` / `accessControl` (troca de sessão demo; sem revoke real)
- **Estado v216:** já coberto (código + testes; migração `202609161300_session_revocation.sql` a aplicar)
- **Entregue (2026-09-16):**
  - bug corrigido: a rota antiga chamava `auth.admin.signOut(userId)`, mas essa API exige o **JWT** da sessão, então a revogação nunca funcionava
  - schema: `app.users.sessions_valid_after` + função `app.revoke_auth_sessions(uuid)` (SECURITY DEFINER; apaga `auth.sessions`, e os refresh tokens caem em cascata)
  - `requireActor` recusa na hora sessões autenticadas antes do corte (horário de login do `amr` no JWT, estável no refresh) → `SESSION_REVOKED`
  - `/auth/signout` limpa os cookies da sessão recusada (evita loop `/login` ↔ `/sistema`); o login avisa “sessão encerrada”
  - API `POST /api/users/[id]/sessions/revoke` (`users.admin`, aal2, CSRF, auditoria de sucesso e falha); UI “Encerrar sessões” em `/sistema/usuarios`
  - teste: `lib/sessions.test.ts`
- **Pendência residual:** confirmar no Supabase de dev que o owner da migração tem DELETE em `auth.sessions` (se não tiver, a função falha e a revogação é abortada e auditada como falha)
- **Critério de aceite:** ✅ admin encerra todas as sessões de um usuário; ✅ aparelhos ativos são desconectados (corte na aplicação + Auth); ✅ evento no Dedo-duro; ✅ sem expor tokens.

### BL-003 — Encerrar todas as sessões do titular
- **Módulo:** Autenticação
- **Severidade:** importante
- **Onda:** fundação
- **Origem mock:** N/A
- **Estado v216:** já coberto
- **Entregue:** botões “Sair deste aparelho” (`scope: "local"`) e “Sair de todos os aparelhos” (`scope: "global"`) em `components/sidebar.tsx`; o Dedo-duro agora distingue os dois eventos (`logout` × `logout_global`).
- **Critério de aceite:** ✅ titular encerra todas as sessões.

### BL-004 — Troca de autenticador com reautenticação
- **Módulo:** Autenticação / MFA
- **Severidade:** importante
- **Onda:** fundação
- **Origem mock:** N/A
- **Estado v216:** já coberto (falta notificação por e-mail)
- **Entregue (2026-09-16):**
  - reautenticação: `requireActor` expõe a última confirmação TOTP (`amr` do JWT); `assertRecentTotp` exige código confirmado nos últimos 5 minutos
  - `/sistema/conta` (“Minha conta”, pelo nome na barra lateral): situação do autenticador, códigos disponíveis, **gerar novos códigos**, **trocar de aparelho** e **alterar senha**, sempre pedindo o código atual
  - `POST /api/account/mfa/replace`: remove o fator, invalida os códigos, encerra as outras sessões, audita (inclusive a recusa) e leva ao recadastro em `/mfa`
  - emissão de códigos (`POST /api/mfa/recovery-codes`) também exige TOTP recente
  - aviso ao titular dentro do sistema: “Últimos eventos de segurança da sua conta” (inclui ações da administração)
  - teste: `lib/account.test.ts`, `lib/sessions.test.ts`, `lib/mfa-recovery.test.ts`
- **Pendência:** notificação por e-mail (depende de SMTP/automação do Supabase)
- **Critério de aceite:** ✅ alteração/remoção de MFA exige nova autenticação; ✅ auditoria; ⏳ notificação por e-mail (hoje aviso na conta).

### BL-005 — Limitação e bloqueio progressivo de tentativas
- **Módulo:** Autenticação / Segurança
- **Severidade:** bloqueia uso
- **Onda:** fundação
- **Origem mock:** N/A
- **Estado v216:** parcial (código pronto; falta aplicar a configuração do Supabase/Vercel descrita em `docs/SECURITY_AUTH.md`)
- **Entregue (2026-09-16):**
  - schema: `app.auth_attempts` (só HMAC de e-mail/IP), migração `202609161310_auth_attempts.sql`; expurgo de 2 dias no cron de integridade
  - API: `POST /api/auth/login` (login no servidor). Limite progressivo por e-mail (5/15 min, 10/60 min, 20/24 h) e por IP (20/15 min, 60/60 min); 429 com `Retry-After`; mesma resposta para conta inexistente
  - Dedo-duro: “Falha de login” e “Login bloqueado por excesso de tentativas”, com e-mail mascarado
  - UI: `/login` usa a rota do servidor
  - teste: `lib/login-throttle.test.ts` (sem enumeração, bloqueio progressivo, reset por sucesso só no e-mail, bloqueio por IP, normalização)
  - doc: `docs/SECURITY_AUTH.md` (checklist Supabase Auth: rate limits, senha, sessões, CAPTCHA; regra de firewall Vercel)
- **Pendências (ops):**
  - aplicar e registrar com print a configuração da seção 2 do `docs/SECURITY_AUTH.md` no Supabase de produção
  - regra de firewall na Vercel (seção 3)
  - limitação conhecida: chamadas diretas à API do Supabase Auth (chave publicável) só são contidas pelos limites do próprio Supabase
- **Critério de aceite:** ✅ tentativas abusivas pela aplicação sofrem limitação/bloqueio; ✅ recuperação e login não revelam se o e-mail existe; ⏳ evidência da configuração Auth (checklist documentado, falta aplicar e registrar em produção).

### BL-006 — Matriz de permissões editável com auditoria (paridade acesso)
- **Módulo:** Controle de Acesso
- **Severidade:** bloqueia uso
- **Onda:** fundação
- **Origem mock:** `AccessMatrixEditor` / `ACCESS_PROFILES`
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - modelo de acesso por página (`app.pages`, `app.page_grants`, `app.page_grant_overrides`), com paridade ao `ACCESS_PROFILES` do mock
  - `/sistema/acesso` → “Matriz de acesso”: cada perfil em cada página, com o padrão do perfil e as exceções (completo, consulta, sem acesso)
  - API `GET/PUT /api/acesso/matriz`; toda alteração vai ao Dedo-duro com autor, antes e depois
  - a página “Controle de Acesso” nunca é concedida pela matriz; o Administrador enxerga tudo e não aparece nela
  - decisão do servidor: `app.page_level_for(perfil, departamentos, página)` é a única fonte, usada por `app.has_permission`
- **Critério de aceite:** ✅ matriz editável com exceções auditadas; ✅ o que a matriz mostra é o que o servidor aplica.

### BL-007 — Biênio / gestão vigente
- **Módulo:** Controle de Acesso / Diretoria
- **Severidade:** bloqueia uso
- **Onda:** fundação
- **Origem mock:** biênio da Diretoria
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - `app.bienniums` com CRUD em `/sistema/acesso` → “Biênios” e vínculo do biênio na ficha do usuário
  - `app.user_access_allowed`: cargos da Diretoria (presidente, vice, secretaria, tesouraria, conselho fiscal) só acessam dentro do biênio, com 15 dias de tolerância após o fim (fuso de São Paulo)
  - fora do biênio a sessão cai em `/auth/signout?motivo=bienio` com aviso claro; a lista de usuários mostra “Fora do biênio”
  - teste de integração: o presidente perde a permissão quando o biênio vence
- **Critério de aceite:** ✅ cargo sem biênio vigente não acessa; ✅ o Administrador continua entrando para corrigir o cadastro.

### BL-008 — Central de sugestões e melhorias
- **Módulo:** transversal
- **Severidade:** desejável
- **Onda:** fundação
- **Origem mock:** `Suggestions`
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - `app.suggestions` + `/sistema/sugestoes`: qualquer pessoa autenticada envia e acompanha as próprias
  - envio anônimo esconde o nome da Diretoria (a autoria fica no banco para responsabilização; o Dedo-duro não repete o conteúdo)
  - a Diretoria responde e muda a situação (recebida, em análise, respondida, arquivada)
- **Critério de aceite:** ✅ sugestões no Postgres, com resposta da Diretoria e impressão.

### BL-009 — Testar acessos (simulação de perfil)
- **Módulo:** Controle de Acesso
- **Severidade:** desejável
- **Onda:** fundação
- **Origem mock:** `AccessTesting`
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - aba “Testar acessos” em `/sistema/acesso`, disponível apenas fora de produção
  - simula perfil + departamentos com `app.page_level_for` — a mesma função que decide o acesso de verdade, sem abrir sessão de ninguém
  - cada simulação fica registrada no Dedo-duro
- **Critério de aceite:** ✅ conferência de acesso sem personificar usuário; ✅ indisponível em produção.

### BL-010 — Importação/migração ZIP v215
- **Módulo:** Fundação / RF-005
- **Severidade:** bloqueia uso
- **Onda:** fundação
- **Origem mock:** `CompleteBackup.pack/unpack` + `localStorage[KEY]` + IndexedDB anexos
- **Estado v216:** parcial (onda 1 pronta em código e testes; falta ensaio com um pacote real e a decisão da Diretoria sobre a fonte oficial)
- **Entregue (2026-09-16):**
  - leitura no navegador (`lib/legacy/zip.ts`, sem dependências): pacotes de até 300 MB sem passar pelo limite de corpo da Vercel; confere o manifesto (`lar-bencao-completo` v1, chave da v215), o SHA-256 do `dados.json` e de cada `anexos/*.bin`
  - plano da onda 1 (`lib/legacy/v215.ts`): fichas de trabalhadores com histórico de decisões, palestrantes, pastas e estudos (Doutrina/Infância/Juventude), evangelizandos com renovações e fotos, evangelizadores por turma, chamadas P/F, cronograma, frequência da Doutrina, escalas (IDs remapeados) e contato do departamento; usuários **não** são importados (contas só por convite)
  - servidor (`/api/legacy-import`, `modules:admin` + flag `legacy_import`): **simulação real** (executa e desfaz a transação: nada é gravado, mas as restrições do banco são testadas); importação idempotente pelo `app.legacy_id_map` (registro legado nunca duplica; o mesmo pacote não entra duas vezes); relatório origem × destino (novos / já existentes) em `legacy_imports.report`; **reversão** por `app.rollback_legacy_import` (SECURITY DEFINER; remove só o que a importação criou, nunca pastas pré-existentes)
  - zero fictício: pacote com a semente de demonstração do mock é recusado em produção (checado no servidor)
  - fotos: enviadas depois do commit pelo fluxo de anexos inspecionados
  - UI `/sistema/importacao` (menu do administrador): conferência, avisos, simulação, importação, histórico e reversão; tudo no Dedo-duro
  - migração `202609161400_legacy_import.sql`; teste `lib/legacy/v215.test.ts` (ZIP real, integridade, mapeamento, demonstração, simulação sem escrita, 409 duplicado, 422 em produção, reversão)
- **Pendências:**
  - ensaio com um backup real e conferência manual do relatório (o `applyPlan` foi testado só com o banco simulado, não contra Postgres)
  - PDFs dos roteiros (ESE embutidos no HTML e `file` dos estudos) não vêm no backup: anexar pela Biblioteca ou criar um carregador à parte
  - demais anexos do IndexedDB (voluntariado, extratos, atas em áudio) e módulos das ondas 2 e 3: estender o plano quando esses módulos existirem
  - pacote original: guardar o ZIP fora do sistema (os anexos aceitam até 20 MB); o hash fica registrado em `legacy_imports`
- **Critério de aceite:** ✅ dry-run sem escrita; ✅ relatório origem × destino; ✅ idempotência e reversão; ✅ hash dos anexos conferido; ⏳ reconciliação com um pacote real da Diretoria.

### BL-011 — Ativar `business_modules` por onda
- **Módulo:** Fundação / feature flags
- **Severidade:** bloqueia uso
- **Onda:** fundação
- **Origem mock:** todos `data-page`
- **Estado v216:** já coberto (a liberação real de cada onda depende do UAT, BL-063)
- **Entregue (2026-09-16):**
  - schema: migração `202609161320_module_flags.sql` (`wave`, `uat_reference`, `enabled_at`; módulos e chave-mestra **desligados** até haver UAT registrado; `lar_app` com UPDATE só nas colunas de controle)
  - regra: módulo `module_*` só responde com a chave-mestra `business_modules` também ligada (`lib/feature-flags.ts`); departamento sem módulo migrado → 404 (`flagForDepartment`)
  - páginas: `requireModulePage` → 404 com flag desligada ou sem permissão (antes dava erro 500)
  - API: `GET/PATCH /api/feature-flags` (`modules:admin`, só administrador; liberar módulo de onda exige referência de UAT; Dedo-duro com antes/depois; `audit` protegido)
  - UI: `/sistema/modulos` (“Módulos e ondas”) no menu do administrador
  - geral: erros de validação (Zod) agora respondem 400 em vez de 500
  - teste: `lib/feature-flags.test.ts` (chave-mestra, 404 em GET/POST de negócio com flag off, UAT obrigatório, proteção do Dedo-duro, 403 para não-admin)
- **Critério de aceite:** ✅ nenhum módulo de negócio aceita dado com flag off; ✅ ativação por onda com UAT registrado.

### BL-012 — Paridade visual theme-215 no app Next
- **Módulo:** UI institucional
- **Severidade:** importante
- **Onda:** fundação
- **Origem mock:** `theme-215/theme.css` + `LarVisual215` / `theme.js`
- **Estado v216:** parcial
- **O que falta:**
  - UI: portar tokens (`--g/#356f8f`, sidebar clara `#eaf3f6`, welcome, KPIs, toque 44–48px) para `app/globals.css` (hoje azul escuro `--blue-900`, Arial, shell auth/dashboard genérico)
  - teste: regressão visual mobile/desktop vs evidências theme-215
- **Critério de aceite:** telas v216 usam a identidade aprovada 215; impressões comuns com paleta; oficiais intactos.

### BL-013 — Cadastro-base de trabalhadores (admissão/aprovação)
- **Módulo:** Cadastros-base / Diretoria / departamentos
- **Severidade:** bloqueia uso
- **Onda:** 1
- **Origem mock:** `BoardAdmissions` / `workers` / `dir-admissoes` / `sec-admissoes` / `request-worker`
- **Estado v216:** já coberto (código + testes; migração `202609161330_worker_admissions.sql`; UAT pendente)
- **Entregue (2026-09-16):**
  - brechas corrigidas: `POST /api/workers` aceitava `status: active` (pulava a Diretoria); listagens ignoravam o escopo de departamento; qualquer `department:approve` (coordenador) aprovava; escala e Culto no Lar aceitavam trabalhador não aprovado; `lar_app` sem DELETE em `attendance_marks`/`scale_assignments`
  - schema: ficha completa em `app.workers` (naturalidade, estado civil, profissão, endereço, preenchimento, serviço voluntário, termo de voluntariado, autorização de imagem, funções da Doutrina, dias disponíveis, solicitante, `requested_at`/`approved_at`) + histórico `app.worker_approval_decisions` (data da deliberação, ata, motivo, departamentos e funções no momento da decisão)
  - regras do mock: ficha nasce **pendente**; funções só para quem atua na Doutrina; mudar departamentos ou funções de ficha aprovada, ou salvar ficha reprovada → volta para análise; decisão só de Presidente/Administrador (`presidencia:approve`), data até hoje, motivo obrigatório na reprovação, recusa se a ficha mudou durante a análise; afastar/reativar só ficha aprovada
  - API: `GET/POST /api/workers` (escopo por departamento; Presidência/Secretaria/Admin veem tudo), `GET/PATCH /api/workers/[id]`, `POST /api/workers/[id]/decision`, `GET /api/departments`; rotas antigas `/api/admissions` removidas (tabela `admission_requests` mantida só como histórico)
  - UI: `/sistema/trabalhadores` (ficha completa, filtros, editar, afastar/reativar), `/sistema/admissoes` (Diretoria: analisar ficha, histórico, aprovar/reprovar), `/sistema/trabalhadores/[id]/ficha` (impressão só de aprovado, auditada)
  - escala e Culto no Lar: `assertSchedulableWorker` (aprovado, ativo, no departamento e, quando pedido, com a função)
  - teste: `lib/workers.test.ts`
- **Critério de aceite:** ✅ igual ao mock; ✅ dados no Postgres; ✅ auditoria de admissão; ✅ trabalhador só entra em escala após aprovação.

### BL-014 — Aniversariantes multi-departamento
- **Módulo:** transversal
- **Severidade:** importante
- **Onda:** 1
- **Origem mock:** painéis `*-aniversariantes`
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - API `GET /api/aniversariantes` (mês ou ano inteiro) com escopo: Secretaria e Presidência veem todos; os demais, só os departamentos que podem ler
  - painel comum `BirthdaysPanel`, usado por Secretaria e pelos módulos das ondas 2 e 3, com impressão
  - só trabalhadores ativos com data de nascimento no cadastro
- **Critério de aceite:** ✅ aniversariantes por departamento e no geral, sem expor dados fora do escopo de leitura.

### BL-015 — Relatórios anuais genéricos por departamento
- **Módulo:** transversal
- **Severidade:** importante
- **Onda:** 1
- **Origem mock:** `AnnualReportModes`
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - `lib/reports.ts` declara, por departamento, os cadastros que entram no relatório e a coluna de data — nenhuma tabela ou coluna vem da requisição
  - `GET /api/relatorios/[department]?year=` e painel comum “Relatório Anual” em Assistência, Eventos, Divulgação, Secretaria e Jurídico
  - mostra o movimento mês a mês, os totais e a soma de valores quando o cadastro tem dinheiro; consulta é auditada como impressão
  - Patrimônio e Tesouraria mantêm relatórios próprios, com contas e centros de custo
- **Critério de aceite:** ✅ relatório anual com a mesma estrutura em todos os módulos, imprimível e no escopo de leitura.

### BL-016 — Autosave / conflitos / LarReliableStore
- **Módulo:** transversal
- **Severidade:** importante
- **Onda:** 1
- **Origem mock:** `LarReliableStore` (autosave em localStorage)
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - **conflito**: todo cadastro do motor genérico usa versão otimista — quem salva depois recebe “Registro alterado por outra sessão. Recarregue a página.” em vez de sobrescrever
  - **autosave**: a transcrição da reunião grava sozinha no banco a cada 20 segundos, mostrando a hora do último salvamento
  - **aviso de saída**: formulário com alteração pendente avisa antes de fechar ou trocar de registro
  - diferente do mock, nada é guardado no navegador: o rascunho vive no PostgreSQL, com auditoria
- **Critério de aceite:** ✅ nenhum trabalho perdido por conflito silencioso; ✅ autosave sem localStorage.

### BL-017 — Backup ZIP / restauração demo (descontinuar em prod)
- **Módulo:** sistema
- **Severidade:** importante
- **Onda:** fundação
- **Origem mock:** `CompleteBackup` (baixa/restaura o localStorage inteiro)
- **Estado v216:** descontinuado por decisão (2026-09-17)
- **Decisão:** o backup do mock existia porque os dados viviam no navegador. Na v216 os dados estão no PostgreSQL, com
  backup contínuo (PITR) e restauração testada — `docs/BACKUP_RESTORE.md`. Um “baixar tudo” pela tela criaria uma cópia
  completa de dados pessoais fora do banco, sem auditoria de quem levou o arquivo; por isso não será implementado.
- **No lugar dele:** exportação por módulo, com permissão e registro no Dedo-duro (Dedo-duro em CSV já disponível; demais
  módulos usam a impressão/relatório anual). Restauração é sempre operação de banco, no runbook.
- **Critério de aceite:** ✅ decisão registrada; ✅ backup e restauração cobertos por PITR e runbook, não por download de tela.

---

## Onda 1 — Identidade já parcial; módulos educacionais e agendas

### BL-018 — Home / Visão Geral operacional
- **Módulo:** home
- **Severidade:** bloqueia uso
- **Onda:** 1
- **Origem mock:** `OperationalVisual` / memória institucional e cards por perfil
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - `GET /api/home`: memória institucional (fundação, idade e próximo aniversário no fuso de São Paulo), indicadores e “Minha área”
  - **cada indicador só aparece se a pessoa pode ler aquele módulo e se ele está ligado** — os KPIs fixos que mostravam números para todo mundo saíram
  - os cards de “Migração” das ondas 2 e 3 saíram: a Visão Geral mostra apenas o que existe
  - “Minha área”: ficha vinculada, escala de limpeza, eventos e contribuições da própria pessoa
  - teste: `lib/home.test.ts` (idade e próximo aniversário, inclusive no dia)
- **Critério de aceite:** ✅ home com memória institucional e cards por permissão; ✅ nenhum número fora do escopo de leitura.

### BL-019 — Estatuto e Regimento (documentos institucionais)
- **Módulo:** institucional
- **Severidade:** importante
- **Onda:** 1
- **Origem mock:** `INSTITUTIONAL_DOCS` (PDFs embutidos no HTML)
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - `app.institutional_documents` + `/sistema/documentos`: os 10 documentos do mock, cada um com descrição, versão e PDF anexado
  - leitura liberada aos perfis que o mock libera (inclusive trabalhador, evangelizador, Brechó, Clube de Mães e auditoria)
  - substituição do PDF só pelo Administrador, com o arquivo já inspecionado pelo antimalware e a troca auditada
  - “Abrir” usa visualização embutida (`?inline=1`) e “Salvar PDF” baixa o arquivo
- **Pendências residuais:** extrair os PDFs embutidos no HTML v215 fica na Importação v215.
- **Critério de aceite:** ✅ Estatuto e Regimento no Postgres, com permissão de leitura ampla e troca controlada.

### BL-020 — Organograma sintético e analítico
- **Módulo:** transversal
- **Severidade:** desejável
- **Onda:** 1
- **Origem mock:** página Organograma
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - `/sistema/organograma`: Diretoria do biênio vigente e coordenação de cada departamento, a partir dos cadastros reais
  - leitura liberada a todas as contas ativas (como no mock), com impressão
- **Critério de aceite:** ✅ organograma montado a partir de usuários e departamentos, sem lista fixa no código.

### BL-021 — Doutrina — painel, trabalhadores, palestrantes, estudos
- **Módulo:** doutrina
- **Severidade:** bloqueia uso
- **Onda:** 1
- **Origem mock:** `page-doutrina` / `p-dash|p-workers|p-speakers|p-studies` / `workers` `speakers` `studies` `studyFolders`
- **Estado v216:** já coberto (código + testes; migração `202609161340_doutrina.sql`; UAT pendente)
- **Entregue (2026-09-16):**
  - painel `/sistema/doutrina`: KPIs (trabalhadores ativos, palestrantes, estudos, situação da escala do mês, participações, fichas pendentes), alertas (escala não gerada, vagas vazias, conflitos, não publicada, fichas aguardando Diretoria), responsável (vem do Controle de Acesso) + contato do departamento (`PUT /api/doutrina/contact`), que também sai na escala impressa
  - trabalhadores `/sistema/doutrina/trabalhadores`: vinculados à Doutrina com funções, dias e situação; cadastro pela ficha (BL-013)
  - palestrantes externos: casa, cidade, temas, contato, editar, inativar/reativar (`/api/speakers`, `/api/speakers/[id]`); inativos não entram em novas escalas
  - biblioteca de estudos (componente compartilhado com Infância/Juventude): pastas padrão ESE/ESDE/MEP/LE/Treinamentos, pastas e subpastas (renomear; excluir só vazia), estudos com tipo/código/tema/referência, upload inspecionado (`study_material_*`, download para quem lê o departamento), retirar/restaurar (`/api/studies`, `/api/studies/[id]`, `/api/study-folders`)
  - teste: `lib/doutrina-scale.test.ts`
- **Pendência residual:** importar os roteiros ESE/ESDE e seus PDFs do pacote v215 (BL-010)
- **Critério de aceite:** ✅ cadastros e biblioteca equivalentes ao mock, no Postgres.

### BL-022 — Doutrina — escala mensal e frequência
- **Módulo:** doutrina
- **Severidade:** bloqueia uso
- **Onda:** 1
- **Origem mock:** `p-scale` `p-frequency` / `scales` `doctrineAttendance` / `ScaleOperations`
- **Estado v216:** já coberto (código + testes; UAT pendente)
- **Entregue (2026-09-16):**
  - motor `lib/doutrina-scale.ts`, porte de `buildDoctrineScale`/`cf`/`opts`: folhas por dia (seg, qua, qui, sex, sáb, dom) com seções e funções do mock; só trabalhador aprovado, da Doutrina, com a função e o dia; rodízio por carga; palestrante externo/interno alternado; estudos pelo tipo da atividade; folga quarta/sexta do psicofônico; posições adicionais só em Passistas do Grupo do Passe, Recepção e Psicofônicos
  - fluxo: gerar → gerar novamente (com confirmação) → conferir (duplicidade no dia, alternância quarta/sexta, posição que ficou inválida) → aprovar (bloqueado com pendências) → publicar (só aprovada); edição manual volta para “Em conferência”; exclusão lógica do mês (frequência preservada); controle de versão contra edição simultânea; tudo no Dedo-duro
  - schema: `scale_months.status/reviewed/deleted_at/published_at`, `scale_assignments.slot_key/slot_value/speaker_id/study_id/is_extra/edited`
  - API `GET/POST/PATCH/PUT /api/doutrina/scale`; a rota genérica antiga `/api/scales` foi removida
  - UI `/sistema/doutrina/escalas` (grade com seleção por posição, marcação de duplicidade e conflito, adicionais) e impressão `/sistema/doutrina/escalas/imprimir` (folha ou mês consolidado, com responsável, contato e citação; impressão auditada)
  - frequência: `app.attendance_counts` por atividade/dia (configuração do mock), total do dia automático, KPIs (encontros, total, média); `GET/PUT /api/doutrina/attendance`; tela `/sistema/doutrina/frequencia` com impressão
  - teste: `lib/doutrina-scale.test.ts` (geração, funções/dias, folga, alternância de palestrante, tipos de estudo, determinismo, conflitos, validação manual, adicionais, frequência e API: gerar/regerar, 403, aprovação com pendências, publicar só aprovada, versão, edição manual, exclusão)
- **Diferença consciente do mock:** o palestrante interno é escolhido pela menor carga (no mock era sempre o primeiro da lista)
- **Critério de aceite:** ✅ gerar/editar/imprimir escala e frequência como no mock; ✅ dados centralizados.

### BL-023 — Doutrina — Culto no Lar
- **Módulo:** doutrina
- **Severidade:** importante
- **Onda:** 1
- **Origem mock:** `p-culto-lar` / `cultoLar`
- **Estado v216:** só HTML
- **O que falta:**
  - schema/API/UI: escala Culto no Lar
  - permissão/teste: paridade mock
- **Critério de aceite:** cultos do mês gerenciáveis no Postgres como no mock.

### BL-024 — Doutrina — planejamento de treinamentos
- **Módulo:** doutrina
- **Severidade:** importante
- **Onda:** 1
- **Origem mock:** `p-training-plan` / `DoctrineTraining` / `doctrineTrainingPlans`
- **Estado v216:** só HTML
- **O que falta:**
  - schema/API/UI: treinamentos, sessões, status, participantes
  - permissão: edição coordenação
  - teste: “Em andamento” exige sessão agendada
- **Critério de aceite:** planejamento igual ao mock; persistido no Postgres.

### BL-025 — Doutrina — WhatsApp (fila demo → fila segura)
- **Módulo:** doutrina / WhatsApp / RF-011
- **Severidade:** importante
- **Onda:** 3
- **Origem mock:** `p-wa` / `messages` (“WhatsApp simulado”)
- **Estado v216:** só HTML
- **O que falta:**
  - schema: consentimentos, fila, dead-letter
  - API: worker backend (credenciais fora do browser)
  - UI: prévia + confirmação de lote
  - permissão/ops: ambiente teste não envia real
  - teste: idempotência
- **Critério de aceite:** nenhuma mensagem real pelo browser; fila segura com histórico auditável.

### BL-026 — Doutrina — Caravana no Lar
- **Módulo:** doutrina
- **Severidade:** depois
- **Onda:** 1
- **Origem mock:** `CaravanaLar` / `doctrineCaravanaLar` / nav “Caravana no Lar”
- **Estado v216:** só HTML
- **O que falta:**
  - schema/API/UI completos
  - permissão/teste
- **Critério de aceite:** fluxo Caravana igual ao mock no Postgres.

### BL-027 — Infância — evangelizandos, evangelizadores, estudos
- **Módulo:** infancia
- **Severidade:** bloqueia uso
- **Onda:** 1
- **Origem mock:** `page-infancia` / `inf-evangelizandos|inf-trabalhadores|inf-estudos` / `evangelizandos` `infanciaStudies` `infanciaStudyFolders` `infanciaClassEvangelizers`
- **Estado v216:** já coberto (código + testes; migração `202609161350_education.sql`; UAT e decisão de privacidade RF-013 pendentes)
- **Entregue (2026-09-16):**
  - regras (`lib/education.ts`): turma pela idade em 30 de junho (Maternal 3–4, Jardim 5–6, 1º/2º/3º Ciclo 7–12); responsável obrigatório; rancho exige responsável; matrícula anual válida até 31/12 do ano, renovação com recálculo da turma e histórico (`evangelizando_renewals`), inativação manual, exclusão definitiva com a frequência (como no mock)
  - ficha completa (endereço, ponto de referência, pai/mãe e contatos, religião, estado civil, WhatsApp, observações), foto como anexo inspecionado (`evangelizando_photo_*`), pedido de rancho registrado para a Assistência (onda 2)
  - turmas (`education_group_evangelizers`): 2 evangelizadores diferentes por turma, só trabalhadores aprovados e ativos do departamento; KPIs de inscritos e evangelizadores
  - escopo evangelizador × turma: o perfil Evangelizador só vê e lança dados das turmas em que está vinculado (vínculo pela ficha com o mesmo e-mail da conta); nova permissão `education_class:update`
  - evangelizadores: cadastro pela ficha de trabalhador (BL-013), link na navegação
  - biblioteca de estudos: mesmo componente da Doutrina (`department=infancia`)
  - API: `/api/evangelizandos`, `/api/evangelizandos/[id]` (update, renew, photo, delete), `/api/education/[department]/groups`
  - UI: `/sistema/infancia` (painel/turmas), `/evangelizandos`, `/aniversariantes`, `/estudos`
  - teste: `lib/education.test.ts`
- **Pendências residuais:** decisão de privacidade/base legal para dados de menores e foto (BL-061); importar evangelizandos e fotos do pacote v215 (BL-010)
- **Critério de aceite:** ✅ cadastros/matrículas equivalentes ao mock; ✅ dados de menores com escopo por turma e auditoria; ⏳ base legal formal (BL-061).

### BL-028 — Infância — frequência, cronograma, planejamento, relatório
- **Módulo:** infancia
- **Severidade:** bloqueia uso
- **Onda:** 1
- **Origem mock:** `inf-frequencia|inf-cronograma|inf-planejamento|inf-relatorio` / `evangelizandoAttendance` `evangelizandoCronograma` `infanciaAnnualPlanning` / `MonthlyAttendanceSheet` `PlanningRecess`
- **Estado v216:** já coberto (código + testes; UAT pendente)
- **Entregue (2026-09-16):**
  - calendário: só domingos; recesso em janeiro e fevereiro, retorno no primeiro domingo de março (`classSundays`, `firstSundayOfMarch`; também validado no banco)
  - chamada mensal P/F/em branco por evangelizando com matrícula vigente, filtro por turma, totais e frequência por aluno e geral, impressão (`/api/education/[department]/attendance`)
  - cronograma: uma linha por turma em cada domingo, tema e evangelizadores (padrão: os vinculados à turma) (`/schedule`)
  - planejamento anual: diretrizes (objetivo, prioridades, resultados, observações; modelo do mock), programa de aulas integrado ao cronograma (objetivo, material, recursos, situação), atividades especiais e ações de organização com recesso aplicado (`/plan`, `/plan/items`)
  - relatório anual emitido do Postgres: matrículas por turma, frequência mensal, aulas e atividades planejadas × realizadas, impressão e consulta auditada
  - 1ª coluna fixa no celular nas grades (`.scale-sheet`)
  - teste: `lib/education.test.ts` (recesso, domingo, P/F, limpeza, escopo, 403/400)
- **Critério de aceite:** ✅ frequência, cronograma, planejamento e relatório anual equivalentes ao mock, no Postgres.

### BL-029 — Juventude — pacote espelho da Infância
- **Módulo:** juventude
- **Severidade:** bloqueia uso
- **Onda:** 1
- **Origem mock:** `page-juventude` / painéis `juv-*` / `juventudeStudies` `juventudeGroupEvangelizers` `juventudeAnnualPlanning` / `JuventudePlanning`
- **Estado v216:** já coberto (mesmo código parametrizado por departamento; UAT pendente)
- **Entregue (2026-09-16):** grupos Pré-Juventude (13–14) e Juventude (15–21); responsável obrigatório só para menores de 18; todas as telas de BL-027/BL-028 em `/sistema/juventude/*`, inclusive aniversariantes (`juv-aniversariantes`); isolamento: cada rota valida o departamento, a flag `module_juventude` e a permissão do departamento; anexos e fotos com vínculo próprio (`*_juventude`)
- **Critério de aceite:** ✅ paridade funcional com o mock e com a Infância; ✅ dados no Postgres; ✅ isolamento Infância × Juventude.

### BL-030 — Agendas / escalas transversais (ops diárias)
- **Módulo:** transversal
- **Severidade:** importante
- **Onda:** 1
- **Origem mock:** agenda do dia a dia
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - `GET /api/agenda`: próximos 45 dias com limpeza, eventos, reuniões e kits programados — só do que a pessoa pode ler e com o módulo ligado
  - `GET /api/pendencias`: fichas aguardando decisão, baixas pendentes, taxas a receber, sugestões sem resposta, extrato a conciliar, meses em aberto, meses aguardando parecer e empréstimos atrasados
  - as duas listas aparecem na Visão Geral e o feed de pendências também no painel da Diretoria
- **Critério de aceite:** ✅ cada pessoa vê o que precisa fazer e o que está marcado, sem nada fora do escopo.

---

## Onda 2 — Social, Patrimônio, Eventos, Divulgação, Secretaria

### BL-031 — Assistência — painel e trabalhadores
- **Módulo:** assistencia
- **Severidade:** bloqueia uso
- **Onda:** 2
- **Origem mock:** `social-painel` `social-trabalhadores` / `SocialRegistry`
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - `/sistema/assistencia` com abas por seção e escopo de página (`assistencia`)
  - perfis de setor (`brecho`, `clube_maes`) entram direto na aba do próprio setor e não enxergam as demais (regra do mock)
  - trabalhadores do departamento seguem no cadastro único de Trabalhadores (BL-013), sem duplicar ficha
  - teste de integração: cada setor só lança no próprio livro caixa; a coordenação enxerga os dois
- **Critério de aceite:** ✅ módulo Social no Postgres com escopo setorial.

### BL-032 — Assistência — Rancho dos Evangelizandos
- **Módulo:** assistencia
- **Severidade:** bloqueia uso
- **Onda:** 2
- **Origem mock:** `social-rancho` / `RanchoFrequencyPolicy`
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - schema `app.social_families` e `app.social_rancho_deliveries` (migração `202609171700`)
  - entrega por mês de referência, com situação (programada, entregue, não retirada, cancelada), cestas e comprovante anexado
  - regra: família encerrada não recebe nova entrega e a entrega não é anterior ao início do acompanhamento
- **Pendências residuais:** política de frequência configurável (periodicidade por família) fica com BL-037.
- **Critério de aceite:** ✅ rancho controlado por família e mês no Postgres.

### BL-033 — Assistência — Doação de rancho e relação de entrega
- **Módulo:** assistencia
- **Severidade:** bloqueia uso
- **Onda:** 2
- **Origem mock:** `social-doacao` `social-entrega`
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - doações combinadas ficam em Mantenedores da Cesta (BL-034); a entrega efetiva, em Rancho (BL-032), com itens, responsável e comprovante
  - relação de entrega impressa a partir da lista filtrada por mês
- **Critério de aceite:** ✅ doação e entrega registradas e imprimíveis, sem duplicar cadastro.

### BL-034 — Assistência — voluntários e mantenedores de cesta
- **Módulo:** assistencia
- **Severidade:** importante
- **Onda:** 2
- **Origem mock:** `social-voluntarios` `social-mantenedores` / `SocialRegistry`
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - schema `app.social_volunteers` e `app.social_basket_supporters` (migração `202609171700`)
  - campos do mock: área de apoio, disponibilidade, habilidades; tipo de mantenedor, tipo de contribuição, valor, periodicidade e dia previsto
  - aviso do mock mantido: o cadastro não ativa a pessoa como trabalhadora nem equivale a doação recebida
- **Critério de aceite:** ✅ voluntários e mantenedores no Postgres com as situações do mock.

### BL-035 — Assistência — Brechó e Clube de Mães (livro caixa + comprovantes)
- **Módulo:** assistencia / setores
- **Severidade:** bloqueia uso
- **Onda:** 2
- **Origem mock:** `SocialSectors` `socialSectors` / perfis `brecho` e `clube_maes`
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - schema `app.social_sector_ledger` (coluna `sector` separando os dois livros), `app.club_people` e `app.club_deliveries`
  - permissão: recursos `social_brecho` e `social_clube_maes`; quem tem acesso completo à Assistência enxerga e lança nos dois
  - comprovante por lançamento (`social_brecho_proof` / `social_clube_maes_proof`) no Postgres
  - teste de integração do isolamento entre setores
- **Pendências residuais:** estorno de lançamento (reversão) e fechamento mensal ficam com BL-037.
- **Critério de aceite:** ✅ cada setor lança apenas no próprio caixa; ✅ comprovantes e auditoria no Postgres.

### BL-036 — Assistência — sopa, kits de higiene, café das crianças, atividades
- **Módulo:** assistencia
- **Severidade:** importante
- **Onda:** 2
- **Origem mock:** `social-sopa` `social-kits-higiene` `SocialCoffee` `SocialActivityControl`
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - schema `app.social_hygiene_kits`, `app.social_activities` e `app.social_coffee_donors` (migração `202609171700`)
  - Controle de Atividades cobre sopa, café das crianças, corte de cabelo e demais ações, com programado x realizado, quantidade, unidade, público e local
  - Café das Crianças mantém os doadores com vínculo, contribuição e periodicidade
- **Critério de aceite:** ✅ atividades e kits controlados no Postgres como no mock.

### BL-037 — Assistência — planejamento e relatório anual / execução
- **Módulo:** assistencia
- **Severidade:** importante
- **Onda:** 2
- **Origem mock:** `SocialAnnualPlanning` `AnnualAnalytic` `SocialExecution`
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - `app.social_plan_items`: ações do ano por mês, com fundamento, meta, responsável e situação
  - a execução não é redigitada: sai do Controle de Atividades, das entregas de rancho e dos kits, no Relatório Anual
- **Pendências residuais:** comparação automática entre meta e realizado mês a mês (hoje a leitura é lado a lado no relatório).
- **Critério de aceite:** ✅ planejamento anual no Postgres e execução lida dos registros reais, sem duplicar digitação.

### BL-038 — Patrimônio — cadastro de bens
- **Módulo:** patrimonio
- **Severidade:** bloqueia uso
- **Onda:** 2
- **Origem mock:** `pat-inventario` / `PatrimonyAssets` `patrimonyAssets`
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - motor de cadastros declarativos (`lib/resources/*`): campos, validação, SQL com colunas de lista permitida, versão otimista, arquivamento com motivo, histórico pelo Dedo-duro e anexos por tipo
  - schema: `app.patrimony_assets` (migração `202609171300`), tombamento único mesmo entre arquivados (comparação sem espaços e sem caixa)
  - API: `/api/r/patrimonio-bens` (lista/filtros/busca sem acento, inclusão, edição, arquivamento, histórico)
  - UI: `/sistema/patrimonio` com fotos e notas fiscais (até 20 anexos por bem, 15 MB cada, inspeção antimalware), impressão e KPIs
  - permissão: página `patrimonio` (acesso por página, `app.page_level`)
  - teste: `lib/patrimonio.test.ts` + integração (duplicidade recusada, inclusão auditada)
- **Critério de aceite:** ✅ inventário com os campos do mock; ✅ anexos no Postgres com tipo (foto/nota fiscal); ✅ duplicidade de tombamento recusada.

### BL-039 — Patrimônio — autorização de baixa (com Diretoria)
- **Módulo:** patrimonio / diretoria
- **Severidade:** bloqueia uso
- **Onda:** 2
- **Origem mock:** `PatrimonyDisposals` `patrimonyDisposalRequests` / `pat-baixas` `dir-baixas-patrimonio`
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - schema: `app.patrimony_disposals` com numeração `PAT-BAIXA-AAAA-NNNN`, retrato do bem no momento do pedido e um pendente por bem (índice parcial)
  - API: `POST /api/patrimonio/baixas` (solicita), `POST /api/patrimonio/baixas/[id]` (`decide` | `cancel`)
  - UI: mesma aba nos dois módulos (`/sistema/patrimonio/baixas` e `/sistema/presidencia/baixas`), memorando para impressão
  - permissão: Patrimônio solicita e cancela; decide apenas Administrador ou Presidente com acesso completo à Diretoria (regra do mock)
  - regra: autorização bloqueada se o cadastro do bem mudou depois do memorando; ao autorizar, a baixa entra na ficha do bem na data decidida
  - teste: integração (um pendente por bem, coordenador não decide, baixa registrada na ficha, decisão repetida recusada)
- **Critério de aceite:** ✅ fluxo de baixa igual ao mock; ✅ auditoria nos dois lados; ✅ dados no Postgres.

### BL-040 — Patrimônio — escala de limpeza
- **Módulo:** patrimonio
- **Severidade:** importante
- **Onda:** 2
- **Origem mock:** `pat-limpeza` / `PatrimonyCleaning` `patrimonyCleaningRoster`
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - schema: `app.cleaning_roster` (um registro por trabalhador em cada domingo) e `app.cleaning_conflict_decisions` (repetição no ano mantida conscientemente)
  - API: `/api/patrimonio/limpeza` (período, inclusão em equipe, edição), `/gerar` (escala automática sem repetir trabalhador no ano) e `/conflitos`
  - UI: `/sistema/patrimonio/limpeza` com período de até 12 meses, conferência de conflitos, impressão e totais da taxa
  - regras do mock: só domingos, recesso até o primeiro domingo de março, taxa de serviço de R$ 50,00 com recebimento (PIX/Dinheiro/Transferência/Cartão), recebimento pago trava alterações até voltar a pendente com motivo, cancelamento exige motivo
  - teste: `lib/patrimonio.test.ts` (calendário, taxa, edição) + integração (sábado e recesso recusados, repetição no ano, recebimento)
- **Critério de aceite:** ✅ escala de limpeza igual ao mock no Postgres; ✅ taxa e pagamentos auditados.

### BL-041 — Eventos — agenda e itens
- **Módulo:** eventos
- **Severidade:** bloqueia uso
- **Onda:** 2
- **Origem mock:** `evt-agenda` `evt-itens` `evt-escala` `evt-avaliacao` / `EventPlanning` `eventsPlanning`
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - schema `app.events`, `app.event_items`, `app.event_shifts`, `app.event_reviews` (migração `202609171400`)
  - abas em `/sistema/eventos`: Agenda, Itens (previsto x disponível), Escala de Trabalho e Avaliação
  - regra do mock: “Realizado” só com a data efetiva, até hoje; um trabalhador não entra duas vezes na escala do mesmo evento
  - anexos do evento (fotos e documentos) no Postgres; impressão em todas as abas
- **Critério de aceite:** ✅ agenda, itens, escala e avaliação iguais ao mock, no Postgres, com auditoria.

### BL-042 — Divulgação — estrutura + Livraria
- **Módulo:** divulgacao
- **Severidade:** bloqueia uso
- **Onda:** 2
- **Origem mock:** `page-divulgacao` / `div-livraria` / `Bookshop` `BookshopAnnual` `BookshopProofs`
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - schema `app.books`, `app.book_stock_moves`, `app.book_loans`, `app.book_loan_returns`, `app.book_sales` (migração `202609171500`)
  - abas em `/sistema/divulgacao`: Painel da Livraria (disponibilidade e empréstimos em aberto/atrasados), Obras, Estoque, Empréstimos e Vendas
  - regras: obra por destinação (empréstimo ou revenda), baixa e empréstimo limitados ao disponível, devolução parcial, venda com comprovante anexado
- **Pendências residuais:** RP, Biblioteca e Brinquedoteca seguem como estrutura mínima (não há operação no mock).
- **Critério de aceite:** ✅ livraria operacional como no mock; ✅ empréstimos atrasados visíveis; ✅ comprovantes no Postgres.

### BL-043 — Secretaria — reuniões e atas (áudio)
- **Módulo:** secretaria
- **Severidade:** bloqueia uso
- **Onda:** 2
- **Origem mock:** `sec-reunioes` / `LarMeetings` `secretariaMeetings`
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - schema `app.meetings` (migração `202609171600`): pauta, participantes, transcrição, decisões e minuta da ata
  - aba “Gravador”: gravação pelo navegador (MediaRecorder), envio do áudio para `app.attachments` (`meeting_audio`) e transcrição ao vivo quando o navegador oferecer reconhecimento de voz
  - anexos da ata assinada (`meeting_document`); histórico de alterações pelo Dedo-duro
- **Critério de aceite:** ✅ reunião, ata e áudio no Postgres; ✅ nada é inventado pelo sistema — a minuta é escrita por quem secretaria.

### BL-044 — Secretaria — admissões e aniversariantes gerais
- **Módulo:** secretaria
- **Severidade:** importante
- **Onda:** 2
- **Origem mock:** `sec-admissoes` `sec-aniversariantes`
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - aba “Admissões” leva ao cadastro único de Trabalhadores, onde a Secretaria acompanha as fichas de todos os departamentos (sem duplicar cadastro)
  - aba “Aniversariantes” usa o painel comum, que para a Secretaria mostra todos os trabalhadores ativos
- **Critério de aceite:** ✅ Secretaria acompanha admissões e aniversariantes de toda a Casa, dentro da própria página.

### BL-045 — Presidência — painel, módulos, aprovações
- **Módulo:** presidencia
- **Severidade:** importante
- **Onda:** 2
- **Origem mock:** `page-diretoria`
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - `/sistema/presidencia`: pendências da Diretoria, situação de cada módulo (onda, ligado/desligado e referência do UAT) e atalhos para as aprovações
  - abas de Autorizações de Baixa (decisão sobre os memorandos do Patrimônio), Aprovação de Trabalhadores e Sugestões
  - a Diretoria **acompanha** a situação dos módulos; ligar e desligar continua só com o Administrador
- **Critério de aceite:** ✅ painel da Diretoria com o que espera decisão e a situação das ondas.

---

## Onda 3 — Tesouraria, Conselho Fiscal, Jurídico, anexos sensíveis, WhatsApp

### BL-046 — Tesouraria — contribuições e plano de contas
- **Módulo:** tesouraria
- **Severidade:** bloqueia uso
- **Onda:** 3
- **Origem mock:** `treasury-contrib` `treasury-chart` / `TreasuryContributionPdf`
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - `app.financial_accounts` com o plano de contas do mock (54 contas, natureza e grupo; sintéticas não recebem lançamento)
  - `app.treasury_contributions`: contribuinte, vínculo com a ficha do trabalhador, tipo, mês de referência, valor em centavos, forma e comprovante
  - abas “Plano de Contas” e “Contribuições” em `/sistema/tesouraria`, com impressão
- **Critério de aceite:** ✅ contribuições e plano de contas no Postgres, em centavos inteiros; ✅ impressão disponível.

### BL-047 — Tesouraria — caixa mensal e comprovantes
- **Módulo:** tesouraria
- **Severidade:** bloqueia uso
- **Onda:** 3
- **Origem mock:** `treasury-cash` `treasury-comprovantes` / `TreasuryProofs`
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - `app.treasury_entries` (lançamento com conta, centro de custo, forma, origem) e `app.treasury_months` (situação do mês)
  - painel “Caixa Mensal”: saldo anterior, entradas, saídas, saldo final, totais por conta e por centro de custo
  - fechamento, reabertura com motivo e envio ao Conselho Fiscal, tudo no Dedo-duro
  - mês fechado recusa inclusão e alteração de lançamento (código `MONTH_CLOSED`)
  - comprovantes (`treasury_proof`) por lançamento
- **Critério de aceite:** ✅ caixa mensal igual ao mock; ✅ fechamento protege o histórico; ✅ comprovantes no Postgres.

### BL-048 — Tesouraria — extrato bancário e conciliação
- **Módulo:** tesouraria
- **Severidade:** importante
- **Onda:** 3
- **Origem mock:** `treasury-extrato-bancario` / `TreasuryBankStatements` `BankInlineProofs`
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - `app.bank_statements` e `app.bank_statement_lines`; leitura de OFX (STMTTRN) e CSV (com ou sem cabeçalho, `;` ou `,`, valores no formato brasileiro)
  - linha repetida (mesmo dia, valor e histórico) não entra duas vezes: impressão digital SHA-256 por linha
  - conciliação sugere lançamentos do banco com o mesmo valor até cinco dias de diferença; conciliar exige valor igual; “deixar fora” exige motivo; dá para desfazer
  - o arquivo original fica anexado (`bank_statement`)
  - teste: `lib/treasury.test.ts` (leitura de OFX/CSV) + integração (importação sem repetir, conciliação por valor)
- **Pendências residuais:** extrato em PDF não é lido automaticamente (só anexado); o mock também não lia.
- **Critério de aceite:** ✅ extrato importado e conciliado no Postgres, com auditoria de cada decisão.

### BL-049 — Tesouraria — mantenedores e histórico de doações
- **Módulo:** tesouraria
- **Severidade:** importante
- **Onda:** 3
- **Origem mock:** `treasury-mantenedores` / `TreasurySupporters`
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - `app.treasury_supporters` (combinado, periodicidade, dia previsto, situação) e `app.treasury_donations` (recebimentos com destino e comprovante)
  - mantenedor encerrado não recebe novo lançamento de doação; mês fechado também bloqueia
- **Critério de aceite:** ✅ mantenedores e histórico de doações no Postgres, com comprovantes.

### BL-050 — Tesouraria — WhatsApp cobrança/avisos
- **Módulo:** tesouraria / doutrina
- **Severidade:** importante
- **Onda:** 3
- **Origem mock:** `treasury-whatsapp` / `TreasuryWhatsApp` `TreasuryWhatsAppBatch`
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - `app.whatsapp_messages`: fila por módulo (Tesouraria e Doutrina), consentimento obrigatório com a origem registrada, número normalizado (55 + DDD)
  - o sistema **não envia sozinho**: abre a conversa no WhatsApp e registra quem enviou; cancelamento exige motivo
  - no Dedo-duro, o telefone aparece mascarado (`***1234`)
- **Pendências residuais:** envio em lote e opt-out por link público ficam fora desta entrega (dependeriam de API externa).
- **Critério de aceite:** ✅ nenhuma mensagem sai sem consentimento registrado; ✅ fila e envios auditados.

### BL-051 — Tesouraria — integração Conselho Fiscal (envio mensal)
- **Módulo:** tesouraria / conselho fiscal
- **Severidade:** bloqueia uso
- **Onda:** 3
- **Origem mock:** `treasury-fiscal` / `fiscalReviews` `cashClosingChecks`
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - situação do mês em `app.treasury_months`: **fechar já libera** o relatório ao Conselho Fiscal, como no mock (não há passo separado de envio)
  - reabrir é possível enquanto o Conselho não decidiu, exige motivo e retira o parecer em análise da pauta (ele fica arquivado no histórico, em vez de ser apagado como no mock)
  - depois de “Deferido” ou “Indeferido”, ou com a decisão arquivada, o caixa não reabre
  - teste de integração cobre fechar, reabrir com parecer em análise, decidir e a recusa de reabertura
- **Critério de aceite:** ✅ envio mensal ao CF registrado dos dois lados, sem alterar lançamentos.

### BL-052 — Conselho Fiscal — análise, parecer, histórico, anexos
- **Módulo:** conselho fiscal
- **Severidade:** bloqueia uso
- **Onda:** 3
- **Origem mock:** `cf-analise` `cf-parecer` `cf-historico` / `CouncilFiscalProofs`
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - `app.fiscal_reviews`: um parecer vigente por competência, com a decisão do mock (Em análise → Deferido ou Indeferido), conselheiros presentes, análise e parecer
  - só aceita competência já fechada pela Tesouraria; o Conselho não altera lançamento nenhum
  - arquivar a decisão trava o parecer (não muda mais) e impede a reabertura do caixa
  - parecer assinado e documentos anexados (`fiscal_council_document`)
  - teste de integração: Tesouraria não escreve no parecer; parecer duplicado é recusado
- **Critério de aceite:** ✅ análise e parecer no Postgres, com histórico e anexos; ✅ separação de poderes preservada.

### BL-053 — Jurídico — eleições e documentos
- **Módulo:** juridico
- **Severidade:** importante
- **Onda:** 3
- **Origem mock:** `jur-eleicoes` / `JuridicoElections` `ElectionDocuments`
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - `app.elections`: etapas do mock (edital, inscrições, homologação, votação, apuração, posse, encerrada), datas encadeadas e biênio eleito
  - anexos `legal_document` agora aceitam também `.docx` (modelos de documento), com conferência da assinatura do arquivo
- **Pendências residuais:** extração dos modelos `.docx` embutidos no HTML v215 fica na Importação v215.
- **Critério de aceite:** ✅ eleições e documentos no Postgres, com as etapas e datas do mock.

### BL-054 — Trabalhadores por departamento (painéis `*-trabalhadores`)
- **Módulo:** transversal
- **Severidade:** importante
- **Onda:** 1
- **Origem mock:** painéis `*-trabalhadores`
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - painel comum “Trabalhadores” nas páginas de Patrimônio, Assistência, Eventos, Divulgação e Jurídico
  - lista por situação (ativos, aguardando a Diretoria, inativos), com funções, contato e data de aprovação; a ficha completa segue no cadastro único
  - respeita o escopo: só aparecem os departamentos que a pessoa pode ler
- **Critério de aceite:** ✅ cada departamento vê seus trabalhadores sem duplicar cadastro.

---

## Fundação já entregue (rastreio — gaps residuais)

### BL-055 — Dedo-duro: fechar paridade de filtros/impressão do mock
- **Módulo:** auditoria
- **Severidade:** importante
- **Onda:** 1
- **Origem mock:** impressão e filtros da auditoria
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - botão “Imprimir” no Dedo-duro respeitando os filtros aplicados
  - a própria impressão é auditada (`POST /api/audit/print`, categoria Impressão), com total e filtros usados
- **Critério de aceite:** ✅ impressão disponível e registrada, como manda a política de auditoria.

### BL-056 — Anexos: scanner, retenção, GC órfãos, volume
- **Módulo:** anexos / RF-004
- **Severidade:** bloqueia uso
- **Onda:** fundação
- **Origem mock:** IndexedDB + Base64 embutido em vários módulos
- **Estado v216:** parcial (código pronto; faltam o scanner real contratado e o ensaio de volume em banco de dev)
- **Entregue (2026-09-16):**
  - `lib/env.ts` recusa em produção scanner local ou sem HTTPS (e `APP_URL` sem HTTPS)
  - finalização: status HTTP do scanner conferido antes de ler a resposta; resposta inválida → 503 e o anexo continua pendente
  - scanner de desenvolvimento bloqueia a assinatura EICAR (ensaio de quarentena)
  - painel do administrador em `/sistema/anexos` (`/api/attachments/admin`): volume por situação e por vínculo, tamanho do banco, quarentena e uploads parados, descarte com motivo auditado (metadados mantidos)
  - cron diário: descarta anexos de estudo/foto órfãos após 24 h e remove o binário de quarentenas com mais de 30 dias (`lib/attachment-maintenance.ts`), além dos uploads incompletos (já existia)
  - novos vínculos da onda 1: `study_material_*` e `evangelizando_photo_*` (permissão do departamento; download = leitura)
  - ensaio de volume: `supabase/volume_check.sql` (gera 2× a projeção de 12 meses, mede e desfaz)
  - teste: `lib/attachment-maintenance.test.ts`
- **Pendências (ops):**
  - contratar e configurar `ANTIMALWARE_API_URL`/`TOKEN` reais e ensaiar um arquivo EICAR em produção antes do go-live
  - rodar `volume_check.sql` no banco de dev e registrar o resultado (gate de go-live)
  - política de retenção (`retention_until`) depende da decisão de privacidade (BL-061)
- **Critério de aceite:** ✅ upload→scan→active; ✅ download em stream autorizado; ✅ limites 15/20 MB; ✅ quarentena visível; ⏳ restauração comprovando SHA-256 (BL-058); ⏳ scanner real.

### BL-057 — Gestão de usuários: convite/MFA já ok; faltam jornadas RF-001
- **Módulo:** acesso
- **Severidade:** importante
- **Onda:** fundação
- **Origem mock:** `access-users`
- **Estado v216:** já coberto (falta teste E2E de navegador)
- **Entregue (2026-09-16):** coluna “Acesso” em `/sistema/usuarios` (convite pendente, MFA ativo ou ausente, último login pelo Dedo-duro); **Reenviar convite** (`POST /api/users/[id]/invite`, só para quem nunca acessou e não está suspenso); **Redefinir MFA** e **Encerrar sessões** (BL-001/002); jornada do titular em “Minha conta” (BL-004); suspensão bloqueia o acesso na hora (`requireActor`)
- **Critério de aceite:** ✅ jornadas mínimas RF-001 na UI do admin e do titular; ⏳ E2E convite → senha → MFA → login → recuperação → suspensão num Supabase de dev.

---

## Ops / go-live (PRD §14 e P0)

### BL-058 — Backup automático + restauração integral testada
- **Módulo:** ops / RF-007
- **Severidade:** bloqueia uso
- **Onda:** ops
- **Origem mock:** backup ZIP local
- **Estado v216:** furo ops (runbook e verificação prontos; falta ativar PITR e fazer o primeiro ensaio)
- **Entregue (2026-09-16):**
  - `docs/BACKUP_RESTORE.md`: PITR/backup diário, cópia isolada semanal criptografada (fora da CI), restauração integral trimestral e amostral mensal em projeto temporário, restauração de incidente com dupla confirmação, formulário de registro (RTO/RPO)
  - `supabase/verify_restore.sql`: prova de restauração íntegra (cadeia do Dedo-duro, SHA-256 de cada anexo recalculado das partes BYTEA, anexos sem binário, contagens); ensaiado no Postgres de teste (detecta anexo adulterado)
- **Pendências (ops):** ativar PITR no Supabase de produção; primeiro ensaio de restauração integral com registro; definir o armazenamento externo da cópia semanal e os dois responsáveis pela chave
- **Critério de aceite:** ⏳ restauração aprovada incluindo BYTEA; ⏳ auditoria da operação (registro no formulário + Dedo-duro).

### BL-059 — Isolamento prod × local/CI e zero fictício
- **Módulo:** ops / P0
- **Severidade:** bloqueia uso
- **Onda:** ops
- **Origem mock:** `seed()` / `applyDemoScenario` / `TreasuryFictionalSupporters`
- **Estado v216:** já coberto em código (falta conferir as variáveis só em Production na Vercel)
- **Entregue (2026-09-16):**
  - CI aplica **todas** as migrações num Postgres vazio, valida grants e roda a integração com login de runtime e credenciais sintéticas (`scripts/db-test-setup.sh`, `pnpm test:integration`); nenhuma credencial de produção na CI; integração ausente na CI é erro
  - `serverEnv()` recusa rodar em Preview (sem segredos nem banco); previews continuam desligados no `vercel.json`
  - selo de ambiente real (`lib/environment.ts`): “Produção · Vercel” só em produção; fora dela, aviso “somente dados sintéticos” em todas as telas
  - importação recusa a semente fictícia do mock em produção (BL-010); o app não tem função de “restaurar dados fictícios”
- **Pendência (ops):** conferir na Vercel que todas as variáveis estão só no escopo Production
- **Critério de aceite:** ✅ nenhum dado fictício misturado à produção; ✅ previews desabilitados; ⏳ conferência das variáveis.

### BL-060 — Observabilidade, alertas, health, WAF, domínio
- **Módulo:** ops / RNF-008
- **Severidade:** bloqueia uso
- **Onda:** ops
- **Origem mock:** N/A
- **Estado v216:** parcial (código pronto; monitor, alertas e WAF a configurar)
- **Entregue (2026-09-16):**
  - `/api/health`: banco, esquema na versão do código (marcador da última migração) e cron de integridade nas últimas 36 h → `ok`/`degraded`/`unavailable` (503)
  - erros internos devolvem **protocolo** (também no log); página de erro com protocolo em `/sistema`
  - produção exige `APP_URL` e scanner em HTTPS; `proxy.ts` mantém o domínio canônico
  - `docs/OBSERVABILIDADE.md`: monitor externo, alertas de 5xx, Supabase, revisão semanal do Dedo-duro, teste do alerta
- **Pendências (ops):** criar o monitor e os alertas; regra de firewall (docs/SECURITY_AUTH.md §3); DNS `sistema.lardabencao.org`; registrar o teste do alerta
- **Critério de aceite:** ⏳ health/métricas/alertas ativos; ✅ HTML fora do domínio canônico redirecionado.

### BL-061 — Privacidade, retenção, incidentes, termos
- **Módulo:** ops / RF-013 / RF-015
- **Severidade:** bloqueia uso
- **Onda:** ops
- **Origem mock:** N/A
- **Estado v216:** parcial (rascunhos técnicos prontos; aprovação institucional pendente)
- **Entregue (2026-09-16):**
  - `docs/PRIVACIDADE.md` (rascunho para aprovação): papéis, inventário da onda 1 com finalidade, base legal proposta, retenção proposta e acesso; controles implementados; procedimento do titular; formulário de incidente
  - `docs/RUNBOOKS.md`: severidades P1–P3, indisponibilidade, cadeia de auditoria quebrada, conta bloqueada/MFA, anexos/quarentena, integrações, suspeita de vazamento (comunicação em 3 dias úteis), suporte privilegiado
  - termos no primeiro acesso (já existia); expurgo automático das tentativas de login (2 dias)
- **Pendências (Diretoria/jurídico):** encarregado e canal do titular; bases legais (menores e fotos); prazos de retenção → implementar expurgos; revisão dos termos e contratos dos operadores
- **Critério de aceite:** ⏳ política aprovada; ✅ termos na 1ª autenticação; ✅ procedimento de incidente documentado (⏳ responsáveis nomeados).

### BL-062 — Segurança pré go-live (SAST, deps, pentest)
- **Módulo:** ops / RNF-004
- **Severidade:** bloqueia uso
- **Onda:** ops
- **Origem mock:** N/A
- **Estado v216:** parcial (testes e dependências em dia; pentest pendente)
- **Entregue (2026-09-16):**
  - matriz automática de autorização positiva e negativa por perfil contra o Postgres real (`tests/integration/database.test.ts`: 20 casos + perfil suspenso), além dos testes de rota de cada módulo (403/404/409)
  - runtime não altera auditoria nem exclui cadastros (testado com o login de runtime) e `verify_permissions.sql` ampliado
  - `pnpm audit`: **zero** vulnerabilidades (o CLI `vercel`, que trazia 1 crítica e 17 altas só em desenvolvimento, foi removido das dependências)
  - bugs de segurança/correção corrigidos nesta rodada: revogação de sessão que nunca funcionava (BL-002), aprovação de trabalhador contornável (BL-013), Dedo-duro que falharia no Supabase por `search_path` do pgcrypto, INSERT quebrado no cadastro de fichas
- **Pendências:** pentest profissional; revisão de CSP/cabeçalhos junto com o pentest; SAST na CI (ex.: CodeQL) a critério da equipe
- **Critério de aceite:** ⏳ zero vulnerabilidade crítica/alta pendente após pentest; ✅ testes de autorização positivos/negativos verdes.

### BL-063 — UAT, manual, treinamento, suporte e rollback por onda
- **Módulo:** processo
- **Severidade:** bloqueia uso
- **Onda:** fundação
- **Origem mock:** N/A
- **Estado v216:** artefatos prontos; execução com a Casa
- **Pronto (2026-09-17):**
  - `docs/UAT_ONDA1.md` e `docs/UAT_ONDAS_2_3.md`: roteiro módulo a módulo, com as regras que precisam ser vistas funcionando
  - `docs/GO_LIVE.md`: cada porta de entrada dos dados reais, quem executa, como comprovar, ordem de liberação e plano de volta atrás
  - rollback por onda já é código: desligar o módulo em `/sistema/modulos` (efeito imediato, dados preservados) e reverter importação v215
- **Falta (não é código):** executar o UAT com os donos de cada módulo, registrar as referências ao ligar cada módulo e treinar as pessoas.
- **Critério de aceite:** UAT das ondas executado e registrado; cada módulo ligado com a referência do respectivo UAT.

### BL-064 — Despublicar hosting estático antigo
- **Módulo:** ops
- **Severidade:** importante
- **Onda:** fundação
- **Origem mock:** site estático da v215
- **Estado v216:** dependente de quem hospeda hoje
- **Pronto (2026-09-17):** a porta está no checklist de go-live (`docs/GO_LIVE.md` §1), com a evidência esperada (URL antiga fora do ar ou com aviso do sistema novo).
- **Por que importa:** enquanto o HTML antigo estiver no ar, ele continua guardando dados no navegador de quem abrir, fora de qualquer auditoria — e as pessoas podem continuar usando o sistema errado.
- **Critério de aceite:** URL antiga fora do ar (ou redirecionando), confirmada antes da entrada de dados reais.

### BL-065 — Acessibilidade AA nas jornadas críticas
- **Módulo:** UI / RNF-007
- **Severidade:** depois
- **Onda:** ops
- **Origem mock:** theme-215 foco/toque
- **Estado v216:** parcial
- **O que falta:**
  - UI: auditoria WCAG 2.2 AA login/MFA/módulos onda
  - teste: teclado/leitor de tela
- **Critério de aceite:** jornadas críticas AA; controles ≥44px como theme-215.

### BL-066 — Configuração institucional sem redeploy (RF-012)
- **Módulo:** administração
- **Severidade:** importante
- **Onda:** fundação
- **Origem mock:** parâmetros embutidos no JS
- **Estado v216:** entregue (falta UAT)
- **Entregue (2026-09-17):**
  - `app.institution_settings` + `/sistema/instituicao` (somente Administrador): nome, fundação, CNPJ, endereço, telefone, e-mail e a frase da Casa
  - a Visão Geral passa a ler esses dados em vez de texto fixo no código; alteração auditada e com versão otimista
- **Critério de aceite:** ✅ parâmetros institucionais editáveis sem alterar código; ✅ segredos continuam apenas em variáveis de ambiente.

---

## Mapa rápido — módulos mock × estado v216

| `data-page` | Painéis principais (mock) | Onda | Estado v216 |
|---|---|---|---|
| `home` | Visão geral, atalhos, pendências | 1 | parcial (KPIs e atalhos; BL-018) |
| `documentos` | Estatuto/Regimento PDF | 1 | só HTML |
| `organograma` | sintético/analítico | 1 | só HTML |
| `acesso` | painel, biênio, usuários, matriz, audit, sugestões, testes, backup | fundação | parcial (usuários, MFA, sessões, Dedo-duro, módulos e ondas, importação v215) |
| `doutrina` | dash, workers, speakers, studies, scale, freq, culto, trainings, WA, caravana, relatório | 1 (+WA→3) | parcial (painel, trabalhadores, palestrantes, biblioteca, escala e frequência prontos; culto, treinamentos, caravana e relatório pendentes) |
| `infancia` | painel…relatório anual | 1 | já coberto (UAT pendente) |
| `juventude` | painel…relatório anual | 1 | já coberto (UAT pendente) |
| `assistencia` | rancho, doação, entrega, voluntários, mantenedores, brechó, clube, sopa, higiene, café, atividades… | 2 | só HTML |
| `tesouraria` | contrib, contas, caixa, CF, extrato, comprovantes, mantenedores, WA, aniversariantes, relatório | 3 | só HTML |
| `conselhofiscal` | painel, análise, parecer, histórico, relatório | 3 | só HTML |
| `patrimonio` | inventário, baixas, limpeza, trabalhadores, relatório | 2 | só HTML |
| `eventos` | agenda, itens, trabalhadores, relatório | 2 | só HTML |
| `divulgacao` | painel, livraria, trabalhadores, relatório | 2 | só HTML |
| `juridico` | painel, eleições, relatório | 3 | só HTML |
| `secretaria` | reuniões/atas, admissões, aniversariantes, trabalhadores, relatório | 2 | só HTML |
| `diretoria` | painel, aprovações, módulos, baixas, trabalhadores, relatório | 2 | parcial (aprovação de trabalhadores pronta — BL-013) |

**Storage mock a eliminar na migração:**
- `localStorage['lar_bencao_demo_integrado_2026_v121_parecer_cf_estatuto_regimento']` (DB inteiro)
- journals/`LarReliableStore` keys derivadas
- `sessionStorage['lar_dt127_home_after_reset']`
- IndexedDB `lar_bencao_demo_integrado_2026_v121_parecer_cf_estatuto_regimento_voluntariado_arquivos` (`files`, `chunks`)
- chaves de teste `lar_access_test_*`, `lar_admin_test_activation_v201`

**APIs/lib já existentes (não recriar — estender):**  
`/api/users`, `/api/audit`, `/api/attachments/*`, `/api/bootstrap`, `/api/health`, `/api/maintenance/integrity`, `/api/auth/{events,login}`, `/api/mfa/recovery-codes`, `/api/feature-flags`, `/api/workers/*`, `/api/doutrina/*`, `/api/speakers/*`, `/api/studies/*`, `/api/study-folders/*`, `/api/evangelizandos/*`, `/api/education/[department]/*`, `/api/legacy-import`, `/api/departments` · `lib/{auth,permissions,audit,attachments,db,csrf,env,supabase,sessions,login-throttle,feature-flags,page-auth,workers,doutrina-*,education*,study-library,legacy/*}`.

**Validação:** `pnpm typecheck && pnpm lint && pnpm test` (unitários) e `pnpm test:integration` (Postgres real; ver `scripts/db-test-setup.sh`).

**Regra de priorização:** qualquer item **Severidade: bloqueia uso** nas ondas fundação + onda alvo, mais o checklist PRD §14, impede go-live com dados reais.
