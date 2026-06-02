#!/usr/bin/env bash
# Recuperar MineOS en el VPS si el deploy dejó la app caída.
# Uso en el servidor:
#   cd /var/www/mineos   # o tu exec cwd de pm2
#   bash scripts/recover-server-production.sh
#   bash scripts/recover-server-production.sh --rollback
set -euo pipefail

ROLLBACK=false
if [[ "${1:-}" == "--rollback" ]]; then
  ROLLBACK=true
fi

APP_CWD="${MINEOS_APP_CWD:-}"
if [[ -z "${APP_CWD}" ]]; then
  if [[ -f ./package.json ]] && grep -q '"name": "mineos-app"' ./package.json 2>/dev/null; then
    APP_CWD="$(pwd)"
  elif command -v pm2 >/dev/null 2>&1; then
    APP_CWD="$(pm2 show mineos 2>/dev/null | grep -i 'exec cwd' | head -1 | sed -E 's/.*exec cwd[^/]*(\/[^|│]+).*/\1/' | tr -d '[:space:]')"
  fi
fi
[[ -n "${APP_CWD}" && -d "${APP_CWD}" ]] || APP_CWD="/var/www/mineos"
cd "${APP_CWD}"

echo "==> Carpeta: $(pwd)"
echo "==> PM2:"
pm2 describe mineos 2>/dev/null | grep -E "status|script path|exec cwd|node env" || echo "(sin proceso mineos)"

echo "==> Build:"
if [[ -f .next/BUILD_ID ]]; then
  echo "OK .next/BUILD_ID = $(cat .next/BUILD_ID)"
else
  echo "FALTA .next/BUILD_ID — hace falta npm run build"
fi

echo "==> Últimos commits:"
git log -3 --oneline 2>/dev/null || echo "(no es repo git)"

if $ROLLBACK; then
  echo "==> ROLLBACK al commit anterior (HEAD~1)..."
  git fetch origin 2>/dev/null || true
  git checkout release/diseno-sin-nomina 2>/dev/null || true
  git reset --hard HEAD~1
else
  echo "==> Actualizar rama release/diseno-sin-nomina..."
  git fetch origin
  git checkout release/diseno-sin-nomina
  git pull origin release/diseno-sin-nomina
fi

echo "==> npm ci + build..."
npm ci
npm run build

if [[ ! -f .next/BUILD_ID ]]; then
  echo "ERROR: el build falló. Revisa el log de arriba."
  exit 1
fi

echo "==> Reiniciar PM2 (producción next start)..."
pm2 delete mineos 2>/dev/null || true
if [[ -f ecosystem.config.cjs ]]; then
  pm2 start ecosystem.config.cjs
else
  pm2 start npm --name mineos -- start
fi
pm2 save 2>/dev/null || true

echo "==> Listo. Commit actual:"
git log -1 --oneline
pm2 status mineos
