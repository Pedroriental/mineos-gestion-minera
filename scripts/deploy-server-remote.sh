#!/usr/bin/env bash
# Ejecutar EN EL SERVIDOR (después de ssh root@24.144.116.215)
set -euo pipefail

BRANCH="${1:-release/diseno-sin-nomina}"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 no encontrado. Instálalo o reinicia el proceso Node manualmente."
  exit 1
fi

APP_CWD="$(pm2 show mineos 2>/dev/null | awk -F'│' '/exec cwd/ { gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2); print $2; exit }')"
if [[ -z "${APP_CWD}" || ! -d "${APP_CWD}" ]]; then
  echo "No se pudo leer exec cwd de pm2 (mineos). Indica la ruta del proyecto:"
  read -r APP_CWD
fi

cd "${APP_CWD}"
test -f package.json || { echo "No hay package.json en ${APP_CWD}"; exit 1; }

echo "==> Desplegando en ${APP_CWD} (rama ${BRANCH})"
git fetch origin
git checkout "${BRANCH}"
git pull origin "${BRANCH}"
npm ci
npm run build
pm2 restart mineos
pm2 save 2>/dev/null || true
echo "==> OK — último commit:"
git log -1 --oneline
