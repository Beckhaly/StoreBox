#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# StoreBox — Gestion multi-clients : UN conteneur Docker par client.
# Chaque client a son propre conteneur (Postgres + API + SPA), son
# volume de données et son sous-domaine, route par un Caddy frontal
# (HTTPS Let's Encrypt automatique).
#
#   ./storebox-tenant.sh init
#   ./storebox-tenant.sh add    <client> <domaine>
#   ./storebox-tenant.sh list
#   ./storebox-tenant.sh logs   <client>
#   ./storebox-tenant.sh backup <client>
#   ./storebox-tenant.sh remove <client> [--purge]
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

IMAGE="${STOREBOX_IMAGE:-storebox-allinone:latest}"
NET="${STOREBOX_NET:-storebox-network}"
CADDY="${STOREBOX_CADDY:-storebox-caddy}"
DIR="${STOREBOX_DIR:-/opt/storebox}"
REGISTRY="$DIR/clients.tsv"
CADDYFILE="$DIR/Caddyfile"

c_name() { echo "storebox-$1"; }
v_name() { echo "storebox_${1}_data"; }

die() { echo "✗ $*" >&2; exit 1; }
need_image() { docker image inspect "$IMAGE" >/dev/null 2>&1 || die "Image $IMAGE absente. Construire : docker compose -f infra/docker-compose.vps.yml build"; }
valid_name() { echo "$1" | grep -qE '^[a-z0-9][a-z0-9-]{1,30}$' || die "Nom client invalide (a-z 0-9 -, 2-31 car.)"; }

ensure_dir() { mkdir -p "$DIR"; touch "$REGISTRY"; }
ensure_net() { docker network inspect "$NET" >/dev/null 2>&1 || docker network create "$NET" >/dev/null; }

# Régénère le Caddyfile depuis le registre + recharge Caddy s'il tourne
regen_caddy() {
  local client domain   # variables locales : ne pas écraser celles de l'appelant
  : > "$CADDYFILE"
  while IFS=$'\t' read -r client domain; do
    [ -z "${client:-}" ] && continue
    cat >> "$CADDYFILE" <<EOF
${domain} {
	encode gzip
	reverse_proxy $(c_name "$client"):3001
}
EOF
  done < "$REGISTRY"
  if docker inspect "$CADDY" >/dev/null 2>&1; then
    docker exec "$CADDY" caddy reload --config /etc/caddy/Caddyfile 2>/dev/null \
      || docker restart "$CADDY" >/dev/null
    echo "✓ Caddy rechargé"
  else
    echo "ℹ Caddy non démarré (lancer : $0 init)"
  fi
}

cmd_init() {
  ensure_dir; ensure_net
  if docker inspect "$CADDY" >/dev/null 2>&1; then
    echo "✓ Caddy déjà présent"
  else
    [ -s "$CADDYFILE" ] || echo "# géré par storebox-tenant.sh" > "$CADDYFILE"
    docker run -d --name "$CADDY" --restart unless-stopped --network "$NET" \
      -p 80:80 -p 443:443 \
      -v "$CADDYFILE":/etc/caddy/Caddyfile:ro \
      -v storebox_caddy_data:/data -v storebox_caddy_config:/config \
      caddy:2-alpine >/dev/null
    echo "✓ Caddy démarré (80/443)"
  fi
}

cmd_add() {
  local client="${1:?usage: add <client> <domaine>}" domain="${2:?usage: add <client> <domaine>}"
  valid_name "$client"; need_image; ensure_dir; ensure_net
  grep -qP "^${client}\t" "$REGISTRY" 2>/dev/null && die "Client '$client' existe déjà"
  docker inspect "$(c_name "$client")" >/dev/null 2>&1 && die "Conteneur $(c_name "$client") existe déjà"

  local pass jwt
  pass="$(openssl rand -hex 16)"; jwt="$(openssl rand -hex 64)"
  docker run -d --name "$(c_name "$client")" --restart unless-stopped --network "$NET" \
    -e POSTGRES_USER=storebox -e POSTGRES_PASSWORD="$pass" -e POSTGRES_DB=storebox_ci \
    -e PGDATA=/var/lib/postgresql/data/pgdata \
    -e JWT_SECRET="$jwt" -e PORT=3001 -e FRONTEND_URL="https://$domain" \
    -v "$(v_name "$client")":/var/lib/postgresql/data \
    --label storebox.client="$client" --label storebox.domain="$domain" \
    "$IMAGE" >/dev/null

  printf "%s\t%s\n" "$client" "$domain" >> "$REGISTRY"
  regen_caddy
  echo "✓ Client '$client' déployé → https://$domain"
}

cmd_remove() {
  local client="${1:?usage: remove <client> [--purge]}" purge="${2:-}"
  docker rm -f "$(c_name "$client")" >/dev/null 2>&1 || true
  if [ "$purge" = "--purge" ]; then
    docker volume rm "$(v_name "$client")" >/dev/null 2>&1 || true
    echo "✓ Conteneur + données de '$client' supprimés"
  else
    echo "✓ Conteneur '$client' supprimé (données conservées dans $(v_name "$client"))"
  fi
  grep -vP "^${client}\t" "$REGISTRY" > "$REGISTRY.tmp" 2>/dev/null || true
  mv -f "$REGISTRY.tmp" "$REGISTRY" 2>/dev/null || true
  regen_caddy
}

cmd_list() {
  printf "%-20s %-30s %-12s %s\n" "CLIENT" "DOMAINE" "ÉTAT" "RAM"
  while IFS=$'\t' read -r client domain; do
    [ -z "${client:-}" ] && continue
    local cn st mem
    cn="$(c_name "$client")"
    st="$(docker inspect -f '{{.State.Status}}' "$cn" 2>/dev/null || echo absent)"
    mem="$(docker stats --no-stream --format '{{.MemUsage}}' "$cn" 2>/dev/null | awk '{print $1}' || echo '-')"
    printf "%-20s %-30s %-12s %s\n" "$client" "$domain" "$st" "$mem"
  done < "$REGISTRY"
}

cmd_logs()   { docker logs -f --tail 100 "$(c_name "${1:?usage: logs <client>}")"; }
cmd_backup() {
  local client="${1:?usage: backup <client>}" f
  f="backup_${client}_$(date +%F_%H%M).sql"
  docker exec "$(c_name "$client")" pg_dump -U storebox storebox_ci > "$f"
  echo "✓ Sauvegarde → $f"
}

case "${1:-}" in
  init)   cmd_init ;;
  add)    shift; cmd_add "$@" ;;
  remove) shift; cmd_remove "$@" ;;
  list)   cmd_list ;;
  logs)   shift; cmd_logs "$@" ;;
  backup) shift; cmd_backup "$@" ;;
  *) cat >&2 <<EOF
StoreBox — un conteneur Docker par client

Usage:
  $0 init                       démarre Caddy (proxy HTTPS) + réseau
  $0 add    <client> <domaine>  déploie un client (conteneur dédié + sous-domaine)
  $0 list                       liste les clients (état + RAM)
  $0 logs   <client>            logs en direct
  $0 backup <client>            dump SQL de la base du client
  $0 remove <client> [--purge]  supprime (--purge efface aussi les données)
EOF
     exit 1 ;;
esac
