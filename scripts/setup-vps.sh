#!/bin/bash
# ============================================================
# StoreBox — Installation initiale VPS (Ubuntu 22/24 LTS)
# A lancer UNE SEULE FOIS sur un nouveau VPS
# Usage : sudo bash scripts/setup-vps.sh
# ============================================================

set -e

echo ""
echo "=========================================="
echo "  StoreBox — Installation initiale VPS"
echo "=========================================="
echo ""

# --- 1. Mise a jour systeme ---
echo "[1/6] Mise a jour systeme..."
apt update && apt upgrade -y

# --- 2. Node.js 20 ---
echo "[2/6] Installation Node.js 20..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi
echo "  Node $(node -v) installe"

# --- 3. PostgreSQL ---
echo "[3/6] Installation PostgreSQL..."
if ! command -v psql &>/dev/null; then
  apt install -y postgresql postgresql-contrib
fi
systemctl enable postgresql
systemctl start postgresql

# Creer la base et l'utilisateur
echo "  Creation de la base storebox_db..."
sudo -u postgres psql -c "CREATE USER storebox WITH PASSWORD 'CHANGER_CE_MOT_DE_PASSE';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE storebox_db OWNER storebox;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE storebox_db TO storebox;" 2>/dev/null || true
echo "  -> Base storebox_db creee (user: storebox)"

# --- 4. Nginx ---
echo "[4/6] Installation Nginx..."
if ! command -v nginx &>/dev/null; then
  apt install -y nginx
fi
systemctl enable nginx

# --- 5. PM2 ---
echo "[5/6] Installation PM2..."
npm install -g pm2
pm2 startup systemd -u $SUDO_USER --hp /home/$SUDO_USER 2>/dev/null || true

# --- 6. Firewall ---
echo "[6/6] Configuration firewall..."
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable

echo ""
echo "=========================================="
echo "  Installation terminee !"
echo ""
echo "  Etapes suivantes :"
echo "  1. Cloner le projet :"
echo "     git clone <repo> /var/www/storebox"
echo ""
echo "  2. Configurer l'environnement :"
echo "     cd /var/www/storebox/apps/api"
echo "     cp .env.example .env"
echo "     nano .env"
echo "     -> DATABASE_URL=postgresql://storebox:VOTRE_MDP@localhost:5432/storebox_db"
echo "     -> JWT_SECRET=<generer avec: npm run gen-secret>"
echo ""
echo "  3. Deployer :"
echo "     cd /var/www/storebox"
echo "     bash scripts/deploy.sh"
echo ""
echo "  4. (Optionnel) SSL avec Let's Encrypt :"
echo "     apt install certbot python3-certbot-nginx"
echo "     certbot --nginx -d votre-domaine.com"
echo "=========================================="
echo ""
