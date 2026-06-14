#!/bin/bash
# ───────────────────────────────────────────────────────────────────
# Entrypoint all-in-one : PostgreSQL + API StoreBox dans UN conteneur.
#   1) lance Postgres (entrypoint officiel, initdb au 1er run)
#   2) attend qu'il soit pret
#   3) applique les migrations
#   4) lance l'API (qui sert aussi le SPA)
# ───────────────────────────────────────────────────────────────────
set -e

: "${POSTGRES_USER:=storebox}"
: "${POSTGRES_PASSWORD:=storebox}"
: "${POSTGRES_DB:=storebox_ci}"
export DATABASE_URL="${DATABASE_URL:-postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}}"

echo "▶ Démarrage de PostgreSQL (interne)…"
# L'entrypoint officiel gere l'init du cluster + le demarrage.
docker-entrypoint.sh postgres &
PG_PID=$!

echo "⏳ Attente de PostgreSQL…"
until pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" -h 127.0.0.1 -q; do
  sleep 2
done
echo "✓ PostgreSQL prêt"

echo "▶ Migrations…"
node /app/scripts/run-migrations.mjs

echo "▶ Démarrage de l'API StoreBox (port ${PORT:-3001})…"
cd /app
node apps/api/dist/index.js &
APP_PID=$!

# Arret propre : on stoppe les deux process et on sort
_term() {
  echo "Arrêt du conteneur…"
  kill -TERM "$APP_PID" "$PG_PID" 2>/dev/null || true
}
trap _term TERM INT

# Si l'un des deux process s'arrete, on termine le conteneur
wait -n "$PG_PID" "$APP_PID"
EXIT=$?
_term
exit $EXIT
