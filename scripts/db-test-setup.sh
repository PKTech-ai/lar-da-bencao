#!/usr/bin/env bash
# Prepara um Postgres VAZIO e descartável como o Supabase: papéis/tabelas mínimas do Auth,
# todas as migrações em ordem, login de runtime (membro de lar_app) e verificação de grants.
# Uso: PSQL="psql" RUNTIME_PASSWORD=... scripts/db-test-setup.sh   (variáveis PG* apontam para o owner)
set -euo pipefail
PSQL=${PSQL:-psql}
RUNTIME_PASSWORD=${RUNTIME_PASSWORD:-runtime_test_password}
cd "$(dirname "$0")/.."

$PSQL -v ON_ERROR_STOP=1 -q <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create table if not exists auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade);
SQL

for migration in supabase/migrations/*.sql; do
  echo "→ $migration"
  $PSQL -v ON_ERROR_STOP=1 -q -f "$migration"
done

$PSQL -v ON_ERROR_STOP=1 -q -v pw="$RUNTIME_PASSWORD" <<'SQL'
select format('create role lar_runtime login password %L', :'pw') where not exists (select 1 from pg_roles where rolname = 'lar_runtime') \gexec
grant lar_app to lar_runtime;
-- Como no Supabase: extensões (citext) resolvidas também pelo schema extensions.
alter role lar_runtime set search_path = "$user", public, extensions;
SQL

$PSQL -v ON_ERROR_STOP=1 -q -f supabase/verify_permissions.sql
echo "Banco de teste pronto."
