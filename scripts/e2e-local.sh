#!/usr/bin/env bash
# E2E completo contra o Supabase LOCAL, usando o build de produção (mais fiel e com menos disco que `next dev`).
# Pré-requisito: `npx supabase start -x studio,storage-api,imgproxy,realtime,edge-runtime,logflare,vector,postgres-meta,supavisor`
set -euo pipefail
cd "$(dirname "$0")/.."
[[ -f .env.development.local ]] || { echo "Crie .env.development.local (docs/LOCAL_SETUP.md)"; exit 1; }
set -a; source .env.development.local; set +a
export NODE_ENV=production

pkill -f "next start" 2>/dev/null || true
pkill -f "local-scanner.mjs" 2>/dev/null || true
node scripts/local-scanner.mjs > /tmp/lar-scanner.log 2>&1 &
SCANNER=$!
if [[ -z "${E2E_SKIP_BUILD:-}" ]]; then pnpm build; fi
pnpm start > /tmp/lar-next.log 2>&1 &
APP=$!
trap 'kill $APP $SCANNER 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do [[ "$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health)" != "000" ]] && break; sleep 1; done
pnpm exec playwright test "$@"
