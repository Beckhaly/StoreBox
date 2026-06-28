#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# StoreBox — Produit l'image livrable (clé-en-main) pour les clients.
#   - construit l'image tout-en-un (Postgres + API + SPA)
#   - l'exporte en archive .tar.gz transférable  (par défaut)
#   - ou la pousse sur un registre si REGISTRY est défini
#
#   ./release-image.sh [version]
#   REGISTRY=ghcr.io/moncompte ./release-image.sh 1.0.0
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

cd "$(dirname "$0")/.."
IMAGE="storebox-allinone"
VERSION="${1:-$(date +%Y.%m.%d)}"
REGISTRY="${REGISTRY:-}"

echo "▶ Construction de $IMAGE:$VERSION"
docker build -f Dockerfile.allinone -t "$IMAGE:$VERSION" -t "$IMAGE:latest" .

if [ -n "$REGISTRY" ]; then
  echo "▶ Push vers $REGISTRY"
  docker tag "$IMAGE:$VERSION" "$REGISTRY/$IMAGE:$VERSION"
  docker tag "$IMAGE:$VERSION" "$REGISTRY/$IMAGE:latest"
  docker push "$REGISTRY/$IMAGE:$VERSION"
  docker push "$REGISTRY/$IMAGE:latest"
  echo "✓ Disponible : $REGISTRY/$IMAGE:$VERSION"
  echo "  Sur le serveur client :  docker pull $REGISTRY/$IMAGE:$VERSION"
else
  OUT="storebox-$VERSION.tar.gz"
  echo "▶ Export de l'image → $OUT"
  docker save "$IMAGE:$VERSION" | gzip > "$OUT"
  echo "✓ Archive prête : $OUT  ($(du -h "$OUT" | cut -f1))"
  echo "  1) copier $OUT + le dossier deploy/ sur le serveur client"
  echo "  2) là-bas :  cd deploy && ./install.sh"
fi
