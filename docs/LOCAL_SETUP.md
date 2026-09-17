# Setup local (v216)

Requisitos: Node.js ≥ 20.9, pnpm 11, projeto Supabase **descartável** (não produção).

## 1. Dependências

```bash
pnpm install
cp .env.example .env.local   # se ainda não existir
```

Edite `.env.local` com URL, chaves e `DATABASE_URL` do projeto local.

## 2. Banco

No SQL Editor (role owner/migration):

1. Execute, **em ordem**, todos os arquivos de `supabase/migrations/`:
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
   - `202609171000_institucional_e_limpeza.sql`
   - `202609171100_acesso_por_pagina.sql`
   - `202609171300_ondas_2_3_patrimonio.sql`
2. Crie o login de runtime:

```sql
create role lar_runtime login password 'SEGREDO_LOCAL';
grant lar_app to lar_runtime;
alter role lar_runtime set search_path = "$user", public, extensions;
```

Use esse usuário em `DATABASE_URL` (não o owner).

3. Confira os grants: `psql "$OWNER_URL" -f supabase/verify_permissions.sql`
4. Os módulos de negócio nascem **desligados**. Depois do bootstrap, entre como administrador em **Módulos e ondas** e ligue `business_modules` e os módulos da onda 1 (em dev, use uma referência de UAT como “dev local”).

## 3. Auth (Supabase Dashboard)

- Desabilite cadastro público
- Habilite MFA TOTP
- Aplique os limites de `docs/SECURITY_AUTH.md` (seção 2)
- Site URL = `http://localhost:3000`
- Redirect URLs = `http://localhost:3000/auth/callback`

## 4. Scanner local (opcional)

Para anexos: `pnpm scanner:local` e aponte `ANTIMALWARE_API_URL` para ele (responde `{ "clean": true, "engine": "local-dev" }`).

## 5. Subir

```bash
pnpm dev
```

Bootstrap do primeiro admin (uma vez):

```bash
curl -X POST http://localhost:3000/api/bootstrap \
  -H "Content-Type: application/json" \
  -H "X-Bootstrap-Secret: $BOOTSTRAP_SECRET" \
  -d '{"email":"admin@exemplo.local","name":"Administrador Local","password":"SenhaForteTemporaria1!"}'
```

Entre em `/login`, ative MFA, depois rotacione `BOOTSTRAP_SECRET`.

## 6. Validação

```bash
pnpm typecheck && pnpm lint && pnpm test
```
