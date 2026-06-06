#!/bin/bash
# ============================================================
# StoreBox — Deployment script pour O2SWITCH
# Prepare build pour upload SFTP
# ============================================================

set -e

echo ""
echo "=========================================="
echo "  StoreBox — Build pour O2SWITCH"
echo "=========================================="
echo ""

DEPLOY_DIR="deploy/o2switch"
PUBLIC_HTML="$DEPLOY_DIR/public_html"

# --- 1. Nettoyage ---
echo "[1/5] Preparation du dossier de deploiement..."
rm -rf "$DEPLOY_DIR"
mkdir -p "$PUBLIC_HTML"

# --- 2. Build ---
echo "[2/5] Build (shared + api + web)..."
npm run build

# --- 3. Copie des fichiers ---
echo "[3/5] Copie des fichiers..."

# Dependances
cp package.json "$PUBLIC_HTML/"
cp package-lock.json "$PUBLIC_HTML/"

# API compilée
cp -r apps/api/dist "$PUBLIC_HTML/"

# Frontend compilée (optionnel — si servi depuis Express)
cp -r apps/web/dist "$PUBLIC_HTML/dist-web"

# Migrations (utiles pour SSH)
mkdir -p "$PUBLIC_HTML/migrations"
cp apps/api/migrations/*.sql "$PUBLIC_HTML/migrations/"

# Config PM2 (optionnel)
cp ecosystem.config.cjs "$PUBLIC_HTML/"

# --- 4. Créer app.js wrapper ---
echo "[4/5] Creation app.js..."
cat > "$PUBLIC_HTML/app.js" << 'EOF'
/**
 * StoreBox — Entry point pour O2SWITCH + Passenger
 * Changer le chemin .env si necessaire
 */
require('dotenv').config({ path: __dirname + '/.env' });
require('./dist/index.js');
EOF

# --- 5. .env.example ---
echo "[5/5] Copie .env.example..."
cp apps/api/.env.example "$PUBLIC_HTML/.env.example"

echo ""
echo "=========================================="
echo "  ✅ Build pret pour O2SWITCH"
echo ""
echo "  📁 Dossier: $PUBLIC_HTML/"
echo ""
echo "  📤 Prochaines etapes :"
echo "  1. Creer .env depuis .env.example"
echo "  2. Uploader via SFTP ou cPanel File Manager"
echo "  3. Via cPanel → Node.js Manager → Create app"
echo "  4. SSH: psql \$DATABASE_URL -f migrations/001_schema.sql"
echo "  5. Tester: curl https://votredomaine.com/api/health"
echo ""
echo "=========================================="
echo ""
