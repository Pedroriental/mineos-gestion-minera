#!/usr/bin/env bash
# Ejecutar EN EL SERVIDOR (después de ssh root@24.144.116.215)
# Uso: bash scripts/deploy-server-remote.sh [rama] [ruta_opcional]
set -euo pipefail

BRANCH="${1:-release/diseno-sin-nomina}"
APP_CWD="${2:-${MINEOS_APP_CWD:-}}"

resolve_app_cwd() {
  if [[ -n "${APP_CWD}" && -f "${APP_CWD}/package.json" ]]; then
    echo "${APP_CWD}"
    return
  fi

  if [[ -f "./package.json" ]] && grep -q '"name": "mineos-app"' ./package.json 2>/dev/null; then
    pwd
    return
  fi

  if command -v pm2 >/dev/null 2>&1; then
    local parsed=""
  parsed="$(pm2 show mineos 2>/dev/null | grep -i 'exec cwd' | head -1 | sed -E 's/.*exec cwd[^/]*(\/[^|│]+).*/\1/' | tr -d '[:space:]')"
    if [[ -n "${parsed}" && -d "${parsed}" ]]; then
      echo "${parsed}"
      return
    fi
  fi

  for candidate in /var/www/mineos /var/www/mineos-gestion-minera; do
    if [[ -f "${candidate}/package.json" ]]; then
      echo "${candidate}"
      return
    fi
  done

  echo ""
}

if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 no encontrado. Instálalo o reinicia el proceso Node manualmente."
  exit 1
fi

APP_CWD="$(resolve_app_cwd)"
if [[ -z "${APP_CWD}" ]]; then
  echo "No se encontró la carpeta del proyecto."
  echo "Uso: bash scripts/deploy-server-remote.sh ${BRANCH} /var/www/mineos"
  exit 1
fi

cd "${APP_CWD}"
test -f package.json || { echo "No hay package.json en ${APP_CWD}"; exit 1; }

echo "==> Desplegando en ${APP_CWD} (rama ${BRANCH})"
git fetch origin
git checkout "${BRANCH}"
git pull origin "${BRANCH}"
npm ci
npm run build

if [[ ! -f .next/BUILD_ID ]]; then
  echo "ERROR: npm run build no generó .next/BUILD_ID. Revisa el log de build."
  exit 1
fi

# Producción: next start (NO npm run dev / turbopack)
if [[ -f ecosystem.config.cjs ]]; then
  pm2 delete mineos 2>/dev/null || true
  pm2 start ecosystem.config.cjs
else
  pm2 delete mineos 2>/dev/null || true
  pm2 start npm --name mineos -- start
fi
pm2 save 2>/dev/null || true
echo "==> OK — último commit:"
git log -1 --oneline
