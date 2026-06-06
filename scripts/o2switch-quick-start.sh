#!/bin/bash
# ============================================================
# O2SWITCH — Quick Start (à lancer sur le VPS O2SWITCH)
# ============================================================

set -e

echo ""
echo "=========================================="
echo "  StoreBox — O2SWITCH Quick Start"
echo "=========================================="
echo ""

# Aller au répertoire public_html
cd ~/public_html

echo "[1/3] Installation des dépendances..."
npm ci --production

echo "[2/3] Répertoires pour logs..."
mkdir -p logs

echo "[3/3] Vérifier .env..."
if [ ! -f .env ]; then
  echo "⚠️  Fichier .env manquant!"
  echo "   → Copier .env.example en .env"
  echo "   → Configurer DATABASE_URL et JWT_SECRET"
  exit 1
fi

echo ""
echo "=========================================="
echo "  ✅ Initialisation terminée"
echo ""
echo "  Prochaines étapes via SSH :"
echo "  1. psql \$DATABASE_URL < migrations/001_schema.sql"
echo "  2. psql \$DATABASE_URL < migrations/002_seed.sql"
echo "  3. psql \$DATABASE_URL < migrations/003_auth.sql"
echo "  4. (optionnel) migrations 004-014"
echo ""
echo "  Redémarrer l'app via cPanel → Node.js Manager"
echo "  Tester : curl https://votre-domaine.com/api/health"
echo ""
echo "=========================================="
echo ""
