#!/bin/bash
# =============================================================
# MineOS – Deploy Gastos module to production
# Run on server as root
# =============================================================
set -e

echo "=== [1/6] Locating app directory ==="
APP_DIR=$(find /root /var/www /opt /home -maxdepth 4 -name "package.json" \
          -not -path "*/node_modules/*" 2>/dev/null | \
          xargs -I{} dirname {} | \
          xargs -I{} grep -l '"name": "mineos' {}/ 2>/dev/null | \
          head -1 | xargs dirname 2>/dev/null || true)

if [ -z "$APP_DIR" ]; then
  echo "ERROR: Could not find MineOS app directory. Searching manually..."
  find / -name "next.config*" -not -path "*/node_modules/*" -maxdepth 6 2>/dev/null
  exit 1
fi

echo "App found at: $APP_DIR"
cd "$APP_DIR"

echo "=== [2/6] Fetching latest code (Gastos only) ==="
git fetch origin
git checkout release/diseno-sin-nomina
git pull origin release/diseno-sin-nomina

echo "=== [3/6] Installing dependencies (if needed) ==="
npm install --prefer-offline --ignore-scripts 2>/dev/null || npm install

echo "=== [4/6] Building production bundle ==="
npm run build

echo "=== [5/6] Restarting app server ==="
if command -v pm2 &>/dev/null; then
  pm2 restart all --update-env
  pm2 save
  echo "Restarted via PM2"
elif command -v systemctl &>/dev/null; then
  SERVICE=$(systemctl list-units --type=service --state=running | grep -i "mineos\|next\|node" | awk '{print $1}' | head -1)
  if [ -n "$SERVICE" ]; then
    systemctl restart "$SERVICE"
    echo "Restarted service: $SERVICE"
  else
    echo "No matching systemctl service found. Restart manually."
  fi
else
  echo "No process manager found. Restart the app manually."
fi

echo "=== [6/6] Done! ==="
echo "MineOS Gastos module deployed successfully from branch: release/diseno-sin-nomina"
