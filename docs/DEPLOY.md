# Deploy — Vercel + Supabase + domínio lardabencao.org

Stack escolhida (sem VPS): **Vercel** (Next.js) + **Supabase** (Auth + PostgreSQL). Adequada para ~20 usuários.

## Plano do Supabase: grátis no piloto, Pro antes dos dados reais

| | Free | Pro |
|---|---|---|
| Banco | 500 MB | 8 GB inclusos |
| Backup | **sem PITR**; projeto **pausa após 7 dias sem uso** | PITR e backups diários |
| Uso indicado aqui | UAT e piloto com **dados sintéticos** | operação com dados reais |

Os anexos ficam no próprio PostgreSQL (fatiados em `app.attachment_chunks`), então o espaço acaba mais rápido do que
parece: uns 400 MB de documentos já encostam no limite do Free. E sem PITR não há como voltar atrás de um erro de
operação. Por isso:

1. **Piloto/UAT**: projeto Free, dados sintéticos, sem nenhum dado pessoal real.
2. **Antes do go-live**: subir para Pro, ligar PITR, testar uma restauração (`docs/BACKUP_RESTORE.md`) e só então
   importar dados reais. As portas estão em `docs/GO_LIVE.md`.

Se a Casa quiser adiar o Pro, o sistema continua funcionando — mas o go-live com dados reais fica bloqueado pela porta
de backup, que é decisão da Diretoria, não do código.

## Pré-requisitos

- Conta Vercel com o repositório `PKTech-ai/lar-da-bencao`
- Projeto Supabase de **produção** (região próxima às Functions, ex. `sa-east-1`)
- Domínio `lardabencao.org` (DNS sob seu controle)
- Scanner antimalware HTTP compatível **ou** política temporária documentada

## 1. Banco e Auth (Supabase)

1. Migrações, com a credencial de migração (owner), de uma máquina com `psql`:
   ```bash
   export MIGRATION_DATABASE_URL="postgresql://postgres:SENHA@db.<projeto>.supabase.co:5432/postgres"
   scripts/migrate.sh --dry-run   # lista as pendentes (todas as de supabase/migrations/)
   scripts/migrate.sh             # aplica em ordem, registra em public.lar_schema_migrations e roda verify_permissions.sql
   ```
   O script recusa migração já aplicada que tenha mudado de conteúdo. Não cole arquivos à mão no SQL Editor.
2. Crie o runtime:
   ```sql
   create role lar_runtime login password 'SEGREDO_FORTE';
   grant lar_app to lar_runtime;
   alter role lar_runtime set search_path = "$user", public, extensions;
   ```
   Depois, teste “Encerrar sessões” com um usuário de teste. Se a função não conseguir apagar `auth.sessions` (permissão negada), registre a limitação no BL-002 e peça o grant ao suporte do Supabase.
3. Auth (checklist completo em `docs/SECURITY_AUTH.md`):
   - Desabilite signup público
   - MFA TOTP obrigatório
   - Rate limits, política de senha e duração de sessão
   - Site URL = `https://sistema.lardabencao.org`
   - Redirect = `https://sistema.lardabencao.org/auth/callback`
4. Backup: habilite PITR (plano Pro recomendado para go-live com dados reais)

## 2. Projeto Vercel

1. Importar o repo; Framework = Next.js
2. Production Branch = `main` (previews já desabilitados em `vercel.json`)
3. Variáveis **somente Production** (ver `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DATABASE_URL` (usuário `lar_runtime`)
   - `CRON_SECRET` (≥32 chars)
   - `BOOTSTRAP_SECRET` (≥40 chars; rotacionar após uso)
   - `ANTIMALWARE_API_URL` / `ANTIMALWARE_API_TOKEN`
   - `APP_URL=https://sistema.lardabencao.org`
4. Deploy

## 3. Domínio

1. Na Vercel: Domains → `sistema.lardabencao.org` (ou apex `lardabencao.org` se preferir)
2. No registrador: CNAME/A conforme instruções da Vercel
3. Confirme HTTPS e que `APP_URL` bate com o host canônico (`proxy.ts` redireciona hosts extras)

## 4. Primeiro acesso e configuração institucional

Depois do bootstrap, ainda como Administrador:

1. **Dados da instituição** (`/sistema/instituicao`): nome, fundação, CNPJ, endereço e contatos — a Visão Geral e as impressões leem daqui.
2. **Biênio** (`/sistema/acesso` → Biênios): cadastre o biênio vigente **antes** de criar as contas da Diretoria. Presidente, vice, secretaria, tesouraria e conselho fiscal só acessam dentro do biênio (15 dias de tolerância após o fim).
3. **Usuários**: ao criar cada conta, vincule o biênio (cargos da Diretoria) e a ficha de trabalhador, quando houver.
4. **Matriz de acesso** (`/sistema/acesso` → Matriz): confira o padrão por perfil e registre exceções apenas onde a Casa decidir diferente do mock. Cada exceção fica no Dedo-duro.

## 5. Pós-deploy

```bash
curl -X POST https://sistema.lardabencao.org/api/bootstrap \
  -H "Content-Type: application/json" \
  -H "X-Bootstrap-Secret: $BOOTSTRAP_SECRET" \
  -d '{"email":"admin@lardabencao.org","name":"Administrador","password":"SenhaTemporariaForte1!"}'
```

1. Login → MFA → termos → Usuários
2. Rotacione `BOOTSTRAP_SECRET`
3. **Módulos e ondas**: mantenha os módulos desligados até o UAT de cada onda; ao liberar, registre a referência do UAT
3. Cron `/api/maintenance/integrity` já está em `vercel.json` (07:15 UTC)
4. UAT com dados **sintéticos**
5. Despublique o site estático de teste antigo do HTML v215
6. Só então dados reais

## 6. Checklist rápido

- [ ] Health `GET /api/health` OK
- [ ] Convite + MFA + termos
- [ ] Trabalhadores / Doutrina / Infância / Juventude (onda 1)
- [ ] Biênio cadastrado e vinculado aos cargos da Diretoria
- [ ] Matriz de acesso conferida (exceções registradas)
- [ ] Dados da instituição preenchidos
- [ ] Dedo-duro e anexos
- [ ] Encerrar sessões e Redefinir MFA (admin)
- [ ] Login bloqueia após 5 tentativas (docs/SECURITY_AUTH.md §4)
- [ ] Módulos da onda liberados só com UAT registrado
- [ ] Backup/PITR testado
- [ ] Domínio canônico + Auth redirects

## Observação

As flags dos módulos das ondas 2 e 3 nascem **desligadas** (migração `202609171300`). Ligue cada uma somente com a referência do UAT daquele módulo, em `/sistema/modulos`.
