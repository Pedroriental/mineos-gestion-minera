#!/usr/bin/env bash
# Deploy MineOS desde la máquina local al VPS vía SSH.
# Ejecuta scripts/deploy-server-remote.sh en el servidor.
#
# Requisitos:
#   - ssh instalado (Git Bash, WSL, macOS o Linux).
#   - Llave SSH configurada en el servidor (ssh-copy-id root@24.144.116.215).
#   - El script NO acepta password. Si tu server solo acepta password,
#     primero configura key-based auth:
#       ssh-keygen -t ed25519 -C "mineos-deploy"
#       ssh-copy-id -i ~/.ssh/id_ed25519.pub root@24.144.116.215
#       ssh root@24.144.116.215 "echo OK"   # debe entrar sin pedir password
#
# Uso:
#   bash scripts/deploy-from-local.sh                           # rama por defecto
#   bash scripts/deploy-from-local.sh release/diseno-sin-nomina # rama específica
#   REMOTE_CWD=/var/www/mineos bash scripts/deploy-from-local.sh
#   DRY_RUN=1 bash scripts/deploy-from-local.sh                # muestra comandos sin ejecutar
#
# Variables de entorno opcionales:
#   REMOTE_HOST    Host SSH (default: root@24.144.116.215)
#   REMOTE_PORT    Puerto SSH (default: 22)
#   REMOTE_CWD     Carpeta del proyecto en el server (default: auto-detect PM2)
#   SSH_KEY        Ruta a la llave privada (default: ~/.ssh/id_ed25519)
#   BRANCH         Rama a desplegar (default: release/diseno-sin-nomina)
#   DRY_RUN        Si es 1, muestra el comando sin ejecutarlo

set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-root@24.144.116.215}"
REMOTE_PORT="${REMOTE_PORT:-22}"
REMOTE_CWD="${REMOTE_CWD:-}"
SSH_KEY="${SSH_KEY:-${HOME}/.ssh/id_ed25519}"
BRANCH="${1:-${BRANCH:-release/diseno-sin-nomina}}"
DRY_RUN="${DRY_RUN:-0}"

if ! command -v ssh >/dev/null 2>&1; then
  echo "ERROR: ssh no está instalado en esta máquina."
  exit 1
fi

if [[ ! -f "${SSH_KEY}" ]]; then
  echo "AVISO: no se encontró la llave SSH en ${SSH_KEY}."
  echo "Si usas otra ruta, exporta SSH_KEY=/ruta/a/tu/llave."
  echo "Si tu server solo acepta password, configura key-based auth (ver cabecera)."
  echo
fi

SSH_OPTS=(
  -p "${REMOTE_PORT}"
  -o BatchMode=yes
  -o ConnectTimeout=15
  -o ServerAliveInterval=30
  -o StrictHostKeyChecking=accept-new
)
if [[ -f "${SSH_KEY}" ]]; then
  SSH_OPTS+=(-i "${SSH_KEY}")
fi

remote() {
  ssh "${SSH_OPTS[@]}" "${REMOTE_HOST}" "$1"
}

# Auto-detectar la carpeta del proyecto via PM2 si no se pasó REMOTE_CWD
if [[ -z "${REMOTE_CWD}" ]]; then
  echo "==> Detectando ruta del proyecto vía PM2…"
  DETECTED="$(remote 'pm2 show mineos 2>/dev/null | grep -i "exec cwd" | head -1 | sed -E "s/.*exec cwd[^/]*(\/[^|│]+).*/\1/" | tr -d "[:space:]"' || true)"
  if [[ -n "${DETECTED}" && "${DETECTED}" == /* && -d "${DETECTED}" ]]; then
    REMOTE_CWD="${DETECTED}"
  else
    for candidate in /var/www/mineos /var/www/mineos-gestion-minera; do
      if remote "test -f ${candidate}/package.json" 2>/dev/null; then
        REMOTE_CWD="${candidate}"
        break
      fi
    done
  fi
  if [[ -z "${REMOTE_CWD}" ]]; then
    echo "ERROR: No se pudo detectar la ruta del proyecto en el server."
    echo "Exporta REMOTE_CWD=/ruta/al/proyecto y vuelve a ejecutar."
    exit 1
  fi
  echo "    Detectado: ${REMOTE_CWD}"
fi

# Verificar que la ruta es válida antes de seguir
if ! remote "test -f '${REMOTE_CWD}/package.json'" 2>/dev/null; then
  echo "ERROR: ${REMOTE_CWD}/package.json no existe en el server."
  exit 1
fi
if ! remote "test -f '${REMOTE_CWD}/scripts/deploy-server-remote.sh'" 2>/dev/null; then
  echo "ERROR: ${REMOTE_CWD}/scripts/deploy-server-remote.sh no existe en el server."
  echo "Asegúrate de que el repo está clonado correctamente en ${REMOTE_CWD}."
  exit 1
fi

echo "==> Configuración del deploy"
echo "    Host remoto : ${REMOTE_HOST}:${REMOTE_PORT}"
echo "    Llave SSH   : ${SSH_KEY}"
echo "    Rama        : ${BRANCH}"
echo "    Carpeta     : ${REMOTE_CWD}"
echo

REMOTE_CMD="cd '${REMOTE_CWD}' && bash scripts/deploy-server-remote.sh '${BRANCH}' '${REMOTE_CWD}'"

if [[ "${DRY_RUN}" == "1" ]]; then
  echo "[DRY-RUN] ssh ${SSH_OPTS[*]} ${REMOTE_HOST} \"${REMOTE_CMD}\""
  exit 0
fi

echo "==> Conectando a ${REMOTE_HOST}…"
echo "    (si pide password, configura key-based auth primero)"
echo

remote "${REMOTE_CMD}"
