#!/usr/bin/env bash
# Aplica as migrações pendentes em ordem, registrando cada uma (nome + SHA-256) em
# public.lar_schema_migrations. Recusa arquivo já aplicado que tenha sido alterado.
# Uso (credencial de OWNER/migração, nunca a do runtime):
#   MIGRATION_DATABASE_URL="postgresql://postgres:...@db.<projeto>.supabase.co:5432/postgres" scripts/migrate.sh [--dry-run]
set -euo pipefail
cd "$(dirname "$0")/.."
: "${MIGRATION_DATABASE_URL:?Defina MIGRATION_DATABASE_URL com a credencial de migração (owner).}"
DRY_RUN=${1:-}
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
PSQL=(psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -q -X)

"${PSQL[@]}" -c "create table if not exists public.lar_schema_migrations (
  filename text primary key, sha256 text not null, applied_at timestamptz not null default now(), applied_by text not null default current_user)"

sha() { if command -v sha256sum >/dev/null; then sha256sum "$1"; else shasum -a 256 "$1"; fi | awk '{print $1}'; }

pending=0
for file in supabase/migrations/*.sql; do
  name=$(basename "$file")
  hash=$(sha "$file")
  recorded=$("${PSQL[@]}" -At -c "select sha256 from public.lar_schema_migrations where filename = '$name'")
  if [[ -n "$recorded" ]]; then
    if [[ "$recorded" != "$hash" ]]; then
      echo "ERRO: $name já foi aplicada com outro conteúdo (registrado $recorded, atual $hash)." >&2
      echo "      Migrações aplicadas não podem mudar; crie uma nova migração." >&2
      exit 1
    fi
    echo "✓ $name (já aplicada)"
    continue
  fi
  pending=$((pending + 1))
  if [[ "$DRY_RUN" == "--dry-run" ]]; then
    echo "• $name (pendente)"
    continue
  fi
  echo "→ aplicando $name"
  "${PSQL[@]}" -f "$file"
  "${PSQL[@]}" -c "insert into public.lar_schema_migrations (filename, sha256) values ('$name', '$hash')"
done

if [[ "$DRY_RUN" == "--dry-run" ]]; then
  echo "$pending migração(ões) pendente(s). Nada foi aplicado."
  exit 0
fi
"${PSQL[@]}" -f supabase/verify_permissions.sql
echo "Migrações em dia ($pending aplicada(s) agora) e privilégios conferidos."
