# Sistema Lar da Bênção v216

Aplicação institucional em Next.js para produção na Vercel. A v216 implementa a fundação P0 do [PRD analítico](./PRD_ANALITICO_OPERACIONAL.md): identidade individual com MFA TOTP, autorização no servidor, PostgreSQL compartilhado, anexos privados no próprio banco e evolução protegida do Dedo-duro.

O HTML v215 foi preservado em `dist/` somente como referência funcional. Ele não é a aplicação de produção e não deve receber dados reais.

## Estado da entrega

Já implementado:

- login, recuperação de senha, convite e MFA obrigatório via Supabase Auth;
- códigos de recuperação MFA, revogação de sessões (admin), logout global e aceite de termos;
- perfis e departamentos consultados em cada requisição protegida;
- permissões RBAC aplicadas no backend;
- PostgreSQL central com usuário de runtime sem privilégios de owner;
- anexos `BYTEA` privados em partes de 3 MiB, hash, assinatura real, inspeção antimalware e download autorizado em streaming;
- Dedo-duro append-only, com encadeamento SHA-256, verificação diária de integridade, filtros e exportação protegida;
- gestão de usuários, proteção CSRF, cabeçalhos de segurança e health check;
- login no servidor com limite progressivo de tentativas; revogação real de sessões; redefinição de MFA pelo administrador;
- liberação de módulos por onda com registro de UAT (**Módulos e ondas**); módulos de negócio nascem desligados;
- **onda 1:** fichas de trabalhadores com aprovação da Diretoria; Doutrina (painel, trabalhadores, palestrantes, biblioteca de estudos, escala mensal com conferência/aprovação/publicação/impressão, frequência); Infância e Juventude (matrícula anual, turmas e evangelizadores, chamada, cronograma, planejamento, relatório anual, aniversariantes); documentos e KPIs da home;
- importação assistida do backup completo v215 (simulação, idempotência, reversão);
- painel de anexos (volume, quarentena) e limpeza diária de órfãos;
- deploy de branch somente para `main` na Vercel; previews desabilitados;
- build, tipos, lint e testes automatizados.

Ainda não liberado para dados reais de todas as áreas:

- ondas 2 e 3 (Assistência, Patrimônio, Eventos, Divulgação, Secretaria, Presidência, Tesouraria, CF, Jurídico, WhatsApp) — ver `BACKLOG_OPERACIONAL.md`;
- itens restantes da onda 1 marcados como “importante” (Culto no Lar, treinamentos, relatórios e organograma, entre outros);
- a importação/reconciliação da base local ainda precisa da fonte oficial escolhida pela Diretoria;
- backup/PITR, alertas, WAF, domínio, scanner e retenção precisam ser configurados nos provedores (`docs/BACKUP_RESTORE.md`, `docs/OBSERVABILIDADE.md`, `docs/SECURITY_AUTH.md`);
- UAT (`docs/UAT_ONDA1.md`), teste de restauração, pentest e decisões de privacidade (`docs/PRIVACIDADE.md`) continuam sendo portas de go-live.

## Desenvolvimento local

Requisitos: Node.js 20.9 ou superior, pnpm 11 e PostgreSQL/Supabase local descartável com dados sintéticos.

Guia completo: [docs/LOCAL_SETUP.md](./docs/LOCAL_SETUP.md). Deploy: [docs/DEPLOY.md](./docs/DEPLOY.md). Backlog: [BACKLOG_OPERACIONAL.md](./BACKLOG_OPERACIONAL.md).

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Nunca use a credencial ou a base de produção localmente. As variáveis necessárias estão documentadas em `.env.example`.

## Banco de dados

Execute **todos** os arquivos de `supabase/migrations/`, em ordem, com uma credencial de migração/owner (lista em `docs/LOCAL_SETUP.md`) e depois `supabase/verify_permissions.sql`. A `DATABASE_URL` da aplicação deve usar outro login, membro apenas do papel `lar_app` criado pela migração. Exemplo administrativo, adaptando usuário, senha e política do provedor:

```sql
create role lar_runtime login password 'SEGREDO_GERADO_FORA_DO_GIT';
grant lar_app to lar_runtime;
alter role lar_runtime set search_path = "$user", public, extensions;
```

O login de runtime pode operar os dados necessários, mas não é owner e não recebe `UPDATE` ou `DELETE` em `app.audit_events`.

No Supabase Auth:

1. desabilite cadastro público;
2. habilite TOTP em MFA;
3. configure `APP_URL` como Site URL;
4. autorize apenas `APP_URL/auth/callback` como redirect URL;
5. defina limites de tentativas e política de senha institucional.

Depois da migração e das variáveis, crie o primeiro administrador uma única vez por `POST /api/bootstrap`, enviando `X-Bootstrap-Secret`. Em seguida, rotacione `BOOTSTRAP_SECRET`, entre no sistema e ative o MFA.

## Produção única na Vercel

- Production Branch: `main`.
- Variáveis somente no escopo Production.
- Nenhum Preview Deployment ou banco remoto de homologação.
- `APP_URL` deve ser o domínio canônico.
- O banco deve estar na região mais próxima disponível das Functions.
- Configure o cron diário de integridade com `CRON_SECRET`.
- O scanner deve aceitar o binário via `POST` e responder JSON no formato `{ "clean": true, "engine": "..." }`.

O antigo arquivo de hospedagem estática foi removido. O endereço de teste anterior ainda deve ser despublicado no provedor em que foi criado quando o domínio Vercel entrar em operação.

## Validação antes de merge

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
# Integração com Postgres real (banco descartável):
scripts/db-test-setup.sh   # com PG* apontando para o owner do banco de teste
TEST_DATABASE_URL=postgresql://lar_runtime:...@host/db TEST_OWNER_URL=postgresql://postgres:...@host/db pnpm test:integration
```

O checklist completo de go-live permanece no PRD. Enquanto houver qualquer porta P0 pendente, o sistema não deve armazenar dados pessoais reais.
