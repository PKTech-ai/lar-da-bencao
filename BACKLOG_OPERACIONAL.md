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
- **Severidade:** importante
- **Onda:** fundação
- **Origem mock:** `page-acesso` / `AccessMatrixEditor` / `access-matrix` / `ACCESS_PROFILES` / `role_permissions` seed
- **Estado v216:** parcial
- **O que falta:**
  - schema: versionamento histórico de `role_permissions` (hoje só seed estático)
  - API: CRUD matriz + invalidate sessão/capacidades
  - UI: painéis `access-matrix`, `access-biennium`, `access-dashboard` (hoje só usuários)
  - permissão: exclusivo administrador
  - teste: mudança entra em vigor sem redeploy; 403 em API
- **Critério de aceite:** matriz no Postgres editável como no mock; auditoria; frontend só consulta capacidades efetivas.

### BL-007 — Biênio / gestão vigente
- **Módulo:** Controle de Acesso
- **Severidade:** importante
- **Onda:** fundação
- **Origem mock:** `access-biennium` / `accessBienniumState`
- **Estado v216:** parcial
- **O que falta:**
  - schema: tabela `bienniums` (campo `users.biennium_id` existe sem entidade)
  - API/UI: vigência bloqueia edição quando biênio encerrado
  - teste: usuário fora do biênio não edita módulos
- **Critério de aceite:** mesmas regras do mock: acesso vigente por biênio; suspensão automática documentada.

### BL-008 — Central de sugestões e melhorias
- **Módulo:** Controle de Acesso / institucional
- **Severidade:** depois
- **Onda:** 2
- **Origem mock:** `Suggestions` / `developerSuggestions` / painel em `page-acesso`
- **Estado v216:** só HTML
- **O que falta:**
  - schema: `suggestions`
  - API/UI: CRUD + resposta admin
  - permissão: criar (ativos); administrar (admin)
  - teste: protocolo, filtros, paginação
- **Critério de aceite:** sugestões por módulo no Postgres; admin acompanha; Dedo-duro nas respostas.

### BL-009 — Testar acessos (simulação de perfil)
- **Módulo:** Controle de Acesso
- **Severidade:** depois
- **Onda:** fundação
- **Origem mock:** `AccessTesting` / nav “Testar Acessos”
- **Estado v216:** só HTML
- **O que falta:**
  - UI: modo impersonação **somente** em ambiente sintético (proibida em produção)
  - permissão/ops: flag; audit obrigatório
  - teste: produção não expõe a função
- **Critério de aceite:** ferramenta de QA sem troca de perfil demo em produção (RF-001); ou descontinuada formalmente.

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
- **Módulo:** Cadastros-base / transversal
- **Severidade:** importante
- **Onda:** 1
- **Origem mock:** `TreasuryBirthdays` / painéis `*-aniversariantes`
- **Estado v216:** parcial (Infância e Juventude prontas em `/sistema/{infancia,juventude}/aniversariantes`; faltam os demais departamentos e mantenedores)
- **O que falta:**
  - schema/API/UI: filtros por período; impressão
  - permissão: leitura no escopo do departamento
  - teste: Infância (evangelizandos) vs trabalhadores/mantenedores
- **Critério de aceite:** mesmas listas/impressões do mock a partir do Postgres.

### BL-015 — Relatórios anuais genéricos por departamento
- **Módulo:** Relatórios / RF-009
- **Severidade:** importante
- **Onda:** 1
- **Origem mock:** `AnnualAnalytic` / `AnnualReportModes` / `*-relatorio`
- **Estado v216:** só HTML
- **O que falta:**
  - schema: leituras agregadas por módulo
  - API: geração server-side com escopo
  - UI: painéis Relatório Anual
  - permissão: `print`/`export` por recurso
  - teste: sem vazamento cross-departamento
- **Critério de aceite:** relatório igual ao mock, emitido do Postgres, com emissor/período.

### BL-016 — Autosave / conflitos / LarReliableStore
- **Módulo:** Fundação / RF-010
- **Severidade:** importante
- **Onda:** fundação
- **Origem mock:** `LarReliableStore` / `LarAutoSave` / prefixos de journal em localStorage
- **Estado v216:** só HTML
- **O que falta:**
  - schema: `version` + estados draft/committed
  - API: 409 com diff
  - UI: resolução de conflito
  - teste: duas abas não sobrescrevem
- **Critério de aceite:** concorrência do mock preservada com fonte de verdade Postgres (não localStorage).

### BL-017 — Backup ZIP / restauração demo (descontinuar em prod)
- **Módulo:** Ops / RF-012
- **Severidade:** importante
- **Onda:** ops
- **Origem mock:** nav “Backup e restauração” / `CompleteBackup` / botão restaurar cenário fictício
- **Estado v216:** só HTML
- **O que falta:**
  - UI: remover restauração de fictícios em produção
  - ops: backup Postgres PITR (substitui ZIP local)
  - teste: função demo ausente em prod
- **Critério de aceite:** produção sem “restaurar dados fictícios”; backup institucional cobre metadados+BYTEA.

---

## Onda 1 — Identidade já parcial; módulos educacionais e agendas

### BL-018 — Home / Visão Geral operacional
- **Módulo:** home
- **Severidade:** importante
- **Onda:** 1
- **Origem mock:** `page-home` / `OperationalVisual` / atalhos por permissão / pendências
- **Estado v216:** placeholder
- **O que falta:**
  - API: KPIs e agenda a partir do Postgres
  - UI: welcome 215 + módulos reais (não cards “Migração”)
  - permissão: só módulos permitidos
  - teste: usuário restrito não vê atalhos indevidos
- **Critério de aceite:** home igual ao mock com dados reais do servidor.

### BL-019 — Estatuto e Regimento (documentos institucionais)
- **Módulo:** documentos
- **Severidade:** importante
- **Onda:** 1
- **Origem mock:** `page-documentos` (PDFs embutidos no HTML)
- **Estado v216:** só HTML
- **O que falta:**
  - schema/API: anexos `institutional_document` (tipo já previsto em `attachments.ts`)
  - UI: abrir/baixar com auth
  - permissão: leitura a todos ativos
  - teste: sem URL pública
- **Critério de aceite:** PDFs oficiais no Postgres; download autorizado; disponível a trabalhadores ativos.

### BL-020 — Organograma sintético e analítico
- **Módulo:** organograma
- **Severidade:** depois
- **Onda:** 1
- **Origem mock:** `page-organograma` / `data-org=org-sintetico|org-analitico`
- **Estado v216:** só HTML
- **O que falta:**
  - schema: estrutura institucional versionada (ou conteúdo estático gerenciado)
  - UI: duas vistas
  - permissão: `institucional.read`
  - teste: conteúdo coerente com Estatuto
- **Critério de aceite:** organograma consultável como no mock; fonte centralizada.

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
- **Módulo:** home + departamentos / Onda 1 PRD
- **Severidade:** importante
- **Onda:** 1
- **Origem mock:** pendências home (`Operations212`) ligadas a escalas/comprovantes/eventos
- **Estado v216:** só HTML
- **O que falta:**
  - API: feed de pendências por usuário
  - UI: lista na home
  - teste: só itens do escopo
- **Critério de aceite:** pendências operacionais iguais ao mock, calculadas no servidor.

---

## Onda 2 — Social, Patrimônio, Eventos, Divulgação, Secretaria

### BL-031 — Assistência — painel e trabalhadores
- **Módulo:** assistencia
- **Severidade:** bloqueia uso
- **Onda:** 2
- **Origem mock:** `social-painel` `social-trabalhadores` / `SocialRegistry`
- **Estado v216:** só HTML
- **O que falta:**
  - schema/API/UI base do departamento
  - permissão: `assistencia_social` + perfis `brecho`/`clube_maes`
  - teste: setor restrito
- **Critério de aceite:** painel e trabalhadores Social no Postgres com escopo setorial.

### BL-032 — Assistência — Rancho dos Evangelizandos
- **Módulo:** assistencia
- **Severidade:** bloqueia uso
- **Onda:** 2
- **Origem mock:** `social-rancho` / `ranchoFamilies` `RanchoFrequencyPolicy` `ranchoFrequencyPolicy`
- **Estado v216:** só HTML
- **O que falta:**
  - schema/API/UI frequência mínima, famílias, política
  - permissão/teste
- **Critério de aceite:** rancho interno igual ao mock; regras de frequência no Postgres.

### BL-033 — Assistência — Doação de rancho e relação de entrega
- **Módulo:** assistencia
- **Severidade:** bloqueia uso
- **Onda:** 2
- **Origem mock:** `social-doacao` `social-entrega` / `socialExternalFamilies` `socialDeliveryCorrections`
- **Estado v216:** só HTML
- **O que falta:**
  - schema/API/UI
  - permissão/teste/impressão
- **Critério de aceite:** doação externa e relação de entrega iguais ao mock no Postgres.

### BL-034 — Assistência — voluntários e mantenedores de cesta
- **Módulo:** assistencia
- **Severidade:** importante
- **Onda:** 2
- **Origem mock:** `social-voluntarios` `social-mantenedores` / `socialVolunteers` `VolunteerForms` + IndexedDB arquivos voluntariado
- **Estado v216:** só HTML
- **O que falta:**
  - schema + anexos Postgres (sair do IndexedDB)
  - API/UI
  - permissão/teste
- **Critério de aceite:** cadastros e arquivos de voluntariado no Postgres; download autorizado.

### BL-035 — Assistência — Brechó e Clube de Mães (livro caixa + comprovantes)
- **Módulo:** assistencia
- **Severidade:** bloqueia uso
- **Onda:** 2
- **Origem mock:** `social-brecho` `social-clube-maes` / `SocialSectors` `socialSectors` `SectorCashProofs`
- **Estado v216:** só HTML
- **O que falta:**
  - schema: setores, lançamentos, estoque/enxoval, proofs
  - API/UI
  - permissão: perfil fixo só no setor
  - teste: brechó não edita clube e vice-versa
- **Critério de aceite:** livro caixa setorial igual ao mock; comprovantes via `attachments`.

### BL-036 — Assistência — sopa, kits de higiene, café das crianças, atividades
- **Módulo:** assistencia
- **Severidade:** importante
- **Onda:** 2
- **Origem mock:** nav dinâmicos / `HygieneKits` `SocialCoffeeDonors` `SocialCoffeeSchedule` `SocialActivityControl` `socialSoupDeliveries` `socialHygieneDeliveries`
- **Estado v216:** só HTML
- **O que falta:**
  - schema/API/UI para cada fluxo
  - permissão/teste/impressão
- **Critério de aceite:** sopa, kits, doadores/agenda do café e controle de atividades iguais ao mock no Postgres.

### BL-037 — Assistência — planejamento e relatório anual / execução
- **Módulo:** assistencia
- **Severidade:** importante
- **Onda:** 2
- **Origem mock:** `SocialAnnualPlanning` `SocialAnnualReport` `SocialExecution` `socialAnnualPlanning` `socialActivityResults`
- **Estado v216:** só HTML
- **O que falta:**
  - schema/API/UI
  - permissão `print`/`export`
  - teste
- **Critério de aceite:** planejamento/execução/relatório anual Social no Postgres.

### BL-038 — Patrimônio — cadastro de bens
- **Módulo:** patrimonio
- **Severidade:** bloqueia uso
- **Onda:** 2
- **Origem mock:** `pat-inventario` / `PatrimonyAssets` `patrimonyAssets`
- **Estado v216:** só HTML
- **O que falta:**
  - schema: bens, tombamento, documentos anexos
  - API/UI CRUD + KPIs
  - permissão: `patrimonio`
  - teste: SHA/duplicidade de arquivo
- **Critério de aceite:** inventário igual ao mock; anexos no Postgres.

### BL-039 — Patrimônio — autorização de baixa (com Diretoria)
- **Módulo:** patrimonio / diretoria
- **Severidade:** bloqueia uso
- **Onda:** 2
- **Origem mock:** `PatrimonyDisposals` `patrimonyDisposalRequests` / `pat-baixas` `dir-baixas-patrimonio`
- **Estado v216:** só HTML
- **O que falta:**
  - schema/API workflow solicitação → decisão
  - UI nos dois módulos
  - permissão: patrimônio solicita; presidente/vice/admin decide
  - teste: baixa na ficha só após autorização
- **Critério de aceite:** fluxo de baixa idêntico ao mock; auditoria; Postgres.

### BL-040 — Patrimônio — escala de limpeza
- **Módulo:** patrimonio
- **Severidade:** importante
- **Onda:** 2
- **Origem mock:** `pat-limpeza` / `PatrimonyCleaning` `patrimonyCleaningRoster`
- **Estado v216:** só HTML
- **O que falta:**
  - schema/API/UI
  - permissão/teste
- **Critério de aceite:** escala de limpeza igual ao mock no Postgres.

### BL-041 — Eventos — agenda e itens
- **Módulo:** eventos
- **Severidade:** bloqueia uso
- **Onda:** 2
- **Origem mock:** `evt-agenda` `evt-itens` / `EventPlanning` `eventsPlanning`
- **Estado v216:** só HTML
- **O que falta:**
  - schema/API/UI agenda + itens do evento
  - permissão `eventos`
  - teste/impressão
- **Critério de aceite:** agenda e itens iguais ao mock no Postgres.

### BL-042 — Divulgação — estrutura + Livraria
- **Módulo:** divulgacao
- **Severidade:** bloqueia uso
- **Onda:** 2
- **Origem mock:** `page-divulgacao` / `div-livraria` / `Bookshop` `BookshopAnnual` `BookshopProofs` `divulgacaoBookshop` `divulgacaoDepartmentRequests`
- **Estado v216:** só HTML
- **O que falta:**
  - schema: livraria (obras, empréstimos, caixa), RP/Biblioteca/Brinquedoteca (mínimo estrutural)
  - API/UI Controle da Livraria + relatório
  - permissão `divulgacao`
  - teste: empréstimos atrasados / comprovantes
- **Critério de aceite:** livraria operacional como no mock; demais setores ao menos estruturados; dados no Postgres.

### BL-043 — Secretaria — reuniões e atas (áudio)
- **Módulo:** secretaria
- **Severidade:** bloqueia uso
- **Onda:** 2
- **Origem mock:** `sec-reunioes` / `LarMeetings` `secretariaMeetings` + chunks áudio IndexedDB/memória
- **Estado v216:** só HTML
- **O que falta:**
  - schema: reuniões/atas; áudio via `meeting_audio` attachments
  - API upload chunked + UI gravação/transcrição
  - permissão `secretaria`
  - teste: áudio não fica só no browser
- **Critério de aceite:** atas/áudio no Postgres; download autorizado; paridade de campos do mock.

### BL-044 — Secretaria — admissões e aniversariantes gerais
- **Módulo:** secretaria
- **Severidade:** importante
- **Onda:** 2
- **Origem mock:** `sec-admissoes` `sec-aniversariantes` / `sec-trabalhadores`
- **Estado v216:** só HTML
- **O que falta:**
  - API/UI acompanhamento de admissões + aniversariantes Casa
  - permissão/teste
- **Critério de aceite:** rotinas Secretaria iguais ao mock no Postgres.

### BL-045 — Presidência — painel, módulos, aprovações
- **Módulo:** diretoria
- **Severidade:** importante
- **Onda:** 2
- **Origem mock:** `dir-painel` `dir-modulos` `dir-admissoes` `dir-trabalhadores` `dir-relatorio`
- **Estado v216:** só HTML
- **O que falta:**
  - API: visão consolidada + situação dos módulos
  - UI Presidência
  - permissão `presidencia`
  - teste
- **Critério de aceite:** supervisão e aprovações da Diretoria no Postgres como no mock.

---

## Onda 3 — Tesouraria, Conselho Fiscal, Jurídico, anexos sensíveis, WhatsApp

### BL-046 — Tesouraria — contribuições e plano de contas
- **Módulo:** tesouraria
- **Severidade:** bloqueia uso
- **Onda:** 3
- **Origem mock:** `treasury-contrib` `treasury-chart` / `contrib` `accounts` / `TreasuryContributionPdf`
- **Estado v216:** só HTML
- **O que falta:**
  - schema: plano de contas, contribuições (centavos inteiros)
  - API/UI/PDF
  - permissão `tesouraria`
  - teste: valores e impressão
- **Critério de aceite:** contribuições e plano de contas iguais ao mock; money em centavos no Postgres.

### BL-047 — Tesouraria — caixa mensal e comprovantes
- **Módulo:** tesouraria
- **Severidade:** bloqueia uso
- **Onda:** 3
- **Origem mock:** `treasury-cash` `treasury-comprovantes` / `cashMoves` `cashClosings` `TreasuryProofs` `treasuryProofs`
- **Estado v216:** só HTML
- **O que falta:**
  - schema movimentos/fechamentos
  - API + anexos `treasury_proof`
  - UI
  - permissão/teste: lançamento sem comprovante aparece como pendência
- **Critério de aceite:** caixa mensal e comprovantes iguais ao mock; binários no Postgres.

### BL-048 — Tesouraria — extrato bancário e conciliação
- **Módulo:** tesouraria
- **Severidade:** bloqueia uso
- **Onda:** 3
- **Origem mock:** `treasury-extrato-bancario` / `TreasuryBankStatements` `BankInlineProofs` `treasuryBankStatements` `bankReconciliations`
- **Estado v216:** só HTML
- **O que falta:**
  - schema extratos/linhas/conciliação
  - API import PDF/OFX (limite 20MB) + `bank_statement`
  - UI conferência
  - permissão/teste
- **Critério de aceite:** importação/conciliação igual ao mock; arquivos privados no Postgres.

### BL-049 — Tesouraria — mantenedores e histórico de doações
- **Módulo:** tesouraria
- **Severidade:** importante
- **Onda:** 3
- **Origem mock:** `treasury-mantenedores` / `TreasurySupporters` `treasurySupporters` `treasurySupporterDonationHistory`
- **Estado v216:** só HTML
- **O que falta:**
  - schema/API/UI
  - permissão/teste
- **Critério de aceite:** cadastro de mantenedores e histórico iguais ao mock no Postgres.

### BL-050 — Tesouraria — WhatsApp cobrança/avisos
- **Módulo:** tesouraria / WhatsApp
- **Severidade:** importante
- **Onda:** 3
- **Origem mock:** `treasury-whatsapp` / `TreasuryWhatsApp` `TreasuryWhatsAppBatch` `treasuryWhatsAppSettings` `treasuryWhatsAppConsents` `treasuryWhatsAppBatchDraft`
- **Estado v216:** só HTML
- **O que falta:**
  - schema consentimento/opt-out/config
  - API fila backend (RF-011)
  - UI prévia de lote
  - permissão/ops/teste
- **Critério de aceite:** lotes só via backend; consentimento verificável; sem credenciais no browser.

### BL-051 — Tesouraria — integração Conselho Fiscal (envio mensal)
- **Módulo:** tesouraria / conselhofiscal
- **Severidade:** bloqueia uso
- **Onda:** 3
- **Origem mock:** `treasury-fiscal` / `fiscalReviews` `cashClosingChecks`
- **Estado v216:** só HTML
- **O que falta:**
  - schema pacotes mensais + status
  - API envio Tesouraria → CF
  - UI ambos lados
  - permissão/teste
- **Critério de aceite:** fechamento mensal enviado ao CF como no mock; trilha no Dedo-duro.

### BL-052 — Conselho Fiscal — análise, parecer, histórico, anexos
- **Módulo:** conselhofiscal
- **Severidade:** bloqueia uso
- **Onda:** 3
- **Origem mock:** `cf-analise` `cf-parecer` `cf-historico` / `CouncilFiscalProofs` `fiscalReviews`
- **Estado v216:** só HTML
- **O que falta:**
  - schema pareceres
  - API read tesouraria + write parecer
  - UI
  - permissão: CF edita parecer; não altera lançamentos
  - teste
- **Critério de aceite:** análise/parecer/histórico iguais ao mock; leitura financeira autorizada; Postgres.

### BL-053 — Jurídico — eleições e documentos
- **Módulo:** juridico
- **Severidade:** bloqueia uso
- **Onda:** 3
- **Origem mock:** `jur-eleicoes` / `JuridicoElections` `ElectionDocuments` `ElectionDocumentEngine` `juridicoElections`
- **Estado v216:** só HTML
- **O que falta:**
  - schema eleições/chapas/docs
  - API + anexos `legal_document`
  - UI
  - permissão `juridico`
  - teste
- **Critério de aceite:** eleições e documentos iguais ao mock; anexos privados no Postgres.

### BL-054 — Trabalhadores por departamento (painéis `*-trabalhadores`)
- **Módulo:** transversal departamentos
- **Severidade:** importante
- **Onda:** 1
- **Origem mock:** painéis trabalhadores em doutrina/infância/juventude/social/patrimônio/eventos/divulgação/secretaria/diretoria
- **Estado v216:** só HTML
- **O que falta:**
  - reutilizar schema BL-013 com filtro por dept
  - UI/impressão por módulo
  - permissão scoped
  - teste
- **Critério de aceite:** lista/impressão de trabalhadores por departamento igual ao mock.

---

## Fundação já entregue (rastreio — gaps residuais)

### BL-055 — Dedo-duro: fechar paridade de filtros/impressão do mock
- **Módulo:** acesso / auditoria / RF-006
- **Severidade:** importante
- **Onda:** fundação
- **Origem mock:** `access-audit` / `accessControl.audit` slice(0,3000)
- **Estado v216:** parcial
- **O que falta:**
  - UI: impressão dedicada (além de CSV)
  - API: garantir categorias/módulos de todos os fluxos de negócio quando migrarem
  - teste: imutabilidade + chain `verify_audit_chain`
- **Critério de aceite:** experiência Dedo-duro ≥ mock; fonte só `audit_events`; sem edição/exclusão app.

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
- **Módulo:** ops / RF-008 / RF-014 / RF-015
- **Severidade:** bloqueia uso
- **Onda:** ops
- **Origem mock:** fluxos críticos por módulo
- **Estado v216:** parcial (roteiro de UAT e rollback prontos; execução e manual pendentes)
- **Entregue (2026-09-16):**
  - `docs/UAT_ONDA1.md`: roteiro por módulo (fundação, trabalhadores/Diretoria, Doutrina, Infância/Juventude, importação) com assinaturas; a referência do UAT é exigida para liberar o módulo (BL-011)
  - rollback por onda: desligar o módulo em Módulos e ondas; reversão da importação
  - suporte: `docs/RUNBOOKS.md`; testes de integração por fluxo crítico (`pnpm test:integration`)
- **Pendências:** executar e assinar o UAT; manual v216 (sem localStorage) e treinamento; piloto; testes E2E de navegador
- **Critério de aceite:** ⏳ checklist §14 do PRD 100% verde antes de dados reais na onda.

### BL-064 — Despublicar hosting estático antigo
- **Módulo:** ops
- **Severidade:** importante
- **Onda:** ops
- **Origem mock:** `dist/index.html` hospedado historicamente
- **Estado v216:** furo ops
- **O que falta:**
  - ops: tirar do ar URL de teste estática quando domínio Vercel estiver ativo
- **Critério de aceite:** único endpoint oficial = app Vercel; mock não recebe dados reais.

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
- **Severidade:** depois
- **Onda:** fundação
- **Origem mock:** parâmetros embutidos no JS
- **Estado v216:** parcial
- **O que falta:**
  - schema: settings versionados (anos, biênio, integrações)
  - API/UI admin
  - permissão/teste/auditoria
- **Critério de aceite:** parâmetros editáveis sem alterar código; segredos só em cofre/env.

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
