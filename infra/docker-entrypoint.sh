#!/bin/sh
# Entrypoint de l'image applicative StoreBox.
# 1) applique les migrations (attend Postgres, idempotent)
# 2) lance l'API compilee (qui sert aussi le SPA)
set -e

echo "▶ Migrations…"
node scripts/run-migrations.mjs

echo "▶ Démarrage API StoreBox (port ${PORT:-3001})…"
exec node apps/api/dist/index.js
