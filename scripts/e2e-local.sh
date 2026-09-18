#!/usr/bin/env bash
# E2E completo contra o Supabase LOCAL, usando o build de produção (mais fiel e com menos disco que `next dev`).
# Pré-requisito: `npx supabase start -x studio,storage-api,imgproxy,realtime,edge-runtime,logflare,vector,postgres-meta,supavisor`
set -euo pipefail
cd "$(dirname "$0")/.."
[[ -f .env.development.local ]] || { echo "Crie .env.development.local (docs/LOCAL_SETUP.md)"; exit 1; }
set -a; source .env.development.local; set +a
export NODE_ENV=production

# Libera a porta 3000: o `pkill next start` sozinho deixa o `next-server` vivo segurando a porta,
# e a suíte acaba rodando contra um servidor antigo (já aconteceu).
pkill -f "next start" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
for _ in $(seq 1 10); do lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1 || break; sleep 1; done
if lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "A porta 3000 continua ocupada por outro processo. Feche-o antes de rodar o E2E:"
  lsof -nP -iTCP:3000 -sTCP:LISTEN
  exit 1
fi
pkill -f "local-scanner.mjs" 2>/dev/null || true
node scripts/local-scanner.mjs > /tmp/lar-scanner.log 2>&1 &
SCANNER=$!
if [[ -z "${E2E_SKIP_BUILD:-}" ]]; then pnpm build; fi
pnpm start > /tmp/lar-next.log 2>&1 &
APP=$!
trap 'kill $APP $SCANNER 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do [[ "$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health)" != "000" ]] && break; sleep 1; done
if ! kill -0 "$APP" 2>/dev/null; then echo "O servidor não subiu. Log em /tmp/lar-next.log:"; tail -20 /tmp/lar-next.log; exit 1; fi
pnpm exec playwright test "$@"
