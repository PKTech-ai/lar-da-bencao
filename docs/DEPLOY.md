# Deploy — Vercel + Supabase + domínio lardabencao.org

Stack escolhida (sem VPS): **Vercel** (Next.js) + **Supabase** (Auth + PostgreSQL). Adequada para ~20 usuários.

## Pré-requisitos

- Conta Vercel com o repositório `PKTech-ai/lar-da-bencao`
- Projeto Supabase de **produção** (região próxima às Functions, ex. `sa-east-1`)
- Domínio `lardabencao.org` (DNS sob seu controle)
- Scanner antimalware HTTP compatível **ou** política temporária documentada

## 1. Banco e Auth (Supabase)

1. SQL Editor (owner): execute em ordem todos os arquivos de `supabase/migrations/`
   - `202609150001_initial.sql`
   - `202609161200_business_wave1.sql`
   - `202609161210_auth_hardening.sql`
   - `202609161300_session_revocation.sql`
   - `202609161310_auth_attempts.sql`
   - `202609161320_module_flags.sql`
   - `202609161330_worker_admissions.sql`
   - `202609161340_doutrina.sql`
   - `202609161350_education.sql`
   - `202609161400_legacy_import.sql`
   - `202609161410_pgcrypto_search_path.sql`
   - depois: `supabase/verify_permissions.sql` (deve terminar sem erro)
2. Crie o runtime:
   ```sql
   create role lar_runtime login password 'SEGREDO_FORTE';
   grant lar_app to lar_runtime;
   ```
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

## 4. Pós-deploy

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

## 5. Checklist rápido

- [ ] Health `GET /api/health` OK
- [ ] Convite + MFA + termos
- [ ] Trabalhadores / Doutrina / Infância / Juventude (onda 1)
- [ ] Dedo-duro e anexos
- [ ] Encerrar sessões e Redefinir MFA (admin)
- [ ] Login bloqueia após 5 tentativas (docs/SECURITY_AUTH.md §4)
- [ ] Módulos da onda liberados só com UAT registrado
- [ ] Backup/PITR testado
- [ ] Domínio canônico + Auth redirects

## Observação

Onda 2 (Assistência, Patrimônio, …) e onda 3 (Tesouraria, CF, Jurídico) permanecem no `BACKLOG_OPERACIONAL.md` até migração e UAT.
