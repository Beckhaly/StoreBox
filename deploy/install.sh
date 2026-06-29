#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# StoreBox — Installation client clé-en-main.
#   1) charge l'image livrée (storebox-*.tar.gz) si présente
#   2) prépare .env + génère les secrets manquants
#   3) démarre l'application (HTTPS automatique via Caddy)
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")"

# 1. Charger l'image si une archive est présente à côté
archive="$(ls ../storebox-*.tar.gz storebox-*.tar.gz 2>/dev/null | head -1 || true)"
if [ -n "$archive" ]; then
  echo "▶ Chargement de l'image : $archive"
  docker load < "$archive"
fi

# 2. Préparer .env
[ -f .env ] || cp .env.example .env

gen() { command -v openssl >/dev/null && openssl rand -hex "$1" || head -c "$1" /dev/urandom | xxd -p | tr -d '\n'; }
# Générer les secrets vides
if grep -q '^JWT_SECRET=$' .env;        then sed -i.bak "s|^JWT_SECRET=$|JWT_SECRET=$(gen 64)|" .env; fi
if grep -q '^POSTGRES_PASSWORD=$' .env; then sed -i.bak "s|^POSTGRES_PASSWORD=$|POSTGRES_PASSWORD=$(gen 16)|" .env; fi
rm -f .env.bak

# 3. Vérifier le domaine
# shellcheck disable=SC1091
set -a; . ./.env; set +a
if [ -z "${DOMAIN:-}" ] || [ "$DOMAIN" = "client.mondomaine.com" ]; then
  echo "✗ Éditez DOMAIN dans .env (le domaine du client) puis relancez."
  exit 1
fi

# 4. Lancer
echo "▶ Démarrage de StoreBox pour $DOMAIN…"
docker compose up -d

echo ""
echo "✓ Installé. Dans ~1 min : https://$DOMAIN"
echo "  Connexion initiale : admin@storebox.app / Storebox@123"
echo "  → changez le mot de passe et renseignez la société (nom, logo) dans l'app."
