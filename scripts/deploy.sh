#!/bin/bash
# ============================================================
# StoreBox — Script de deploiement VPS (Ubuntu 22/24 LTS)
# Usage : bash scripts/deploy.sh
# ============================================================

set -e

APP_DIR="/var/www/storebox"
BRANCH="${1:-main}"

echo ""
echo "=========================================="
echo "  StoreBox — Deploiement"
echo "=========================================="
echo ""

# --- 1. Prerequis ---
command -v node  >/dev/null || { echo "Node.js non installe. Lancez: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"; exit 1; }
command -v pm2   >/dev/null || { echo "Installation PM2..."; sudo npm install -g pm2; }
command -v psql  >/dev/null || { echo "PostgreSQL client non installe."; exit 1; }
command -v nginx >/dev/null || { echo "Nginx non installe. Lancez: sudo apt install -y nginx"; exit 1; }

# --- 2. Mise a jour du code ---
echo "[1/6] Mise a jour du code..."
cd "$APP_DIR"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

# --- 3. Installation des dependances ---
echo "[2/6] Installation des dependances..."
npm ci --production=false

# --- 4. Build ---
echo "[3/6] Build (shared + api + web)..."
npm run build

# --- 5. Migrations ---
echo "[4/6] Migrations base de donnees..."
source apps/api/.env 2>/dev/null || true

if [ -n "$DATABASE_URL" ]; then
  for f in apps/api/migrations/*.sql; do
    echo "  -> $(basename $f)"
    psql "$DATABASE_URL" -f "$f" 2>/dev/null || true
  done
else
  echo "  !! DATABASE_URL non definie, migrations ignorees"
fi

# --- 5. Nginx ---
echo "[5/6] Configuration Nginx..."
if [ ! -f /etc/nginx/sites-available/storebox ]; then
  sudo cp infra/nginx/storebox.conf /etc/nginx/sites-available/storebox
  sudo ln -sf /etc/nginx/sites-available/storebox /etc/nginx/sites-enabled/
  sudo rm -f /etc/nginx/sites-enabled/default
  sudo nginx -t && sudo systemctl reload nginx
  echo "  -> Nginx configure"
else
  echo "  -> Nginx deja configure (rechargement)"
  sudo nginx -t && sudo systemctl reload nginx
fi

# --- 6. Redemarrage API ---
echo "[6/6] Redemarrage API (PM2)..."
mkdir -p logs
pm2 startOrRestart ecosystem.config.cjs --env production
pm2 save

echo ""
echo "=========================================="
echo "  Deploiement termine !"
echo "  API    : http://localhost:3001/api/health"
echo "  Web    : http://localhost (via Nginx)"
echo "  Logs   : pm2 logs storebox-api"
echo "  Status : pm2 status"
echo "=========================================="
echo ""
