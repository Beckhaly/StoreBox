# ═══════════════════════════════════════════════════════════════════
# StoreBox — Image applicative unique (Express sert l'API + le SPA React)
# Multi-stage : deps → build → runtime prod
# Base Debian slim (glibc) pour les binaires natifs (bcrypt) sans compilation.
# ═══════════════════════════════════════════════════════════════════

# ── 1. Dépendances (cache npm) ────────────────────────────────────
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json      apps/api/package.json
COPY apps/web/package.json      apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

# ── 2. Build (API via tsc, Web via Vite) ──────────────────────────
FROM deps AS build
COPY . .
# @storebox/shared est type-only (résolu par tsc/Vite) → pas de build dédié.
RUN npm run build -w apps/api \
 && npm run build -w apps/web \
 # pdf-impl.js est un .js non émis par tsc → on le copie dans dist
 && cp apps/api/src/services/pdf-impl.js apps/api/dist/services/pdf-impl.js

# ── 3. Runtime production ─────────────────────────────────────────
FROM node:20-slim AS prod
WORKDIR /app
ENV NODE_ENV=production
# Dépendances de production uniquement
COPY package.json package-lock.json ./
COPY apps/api/package.json      apps/api/package.json
COPY apps/web/package.json      apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --omit=dev && npm cache clean --force
# Artefacts compilés + ressources runtime
COPY --from=build /app/apps/api/dist   ./apps/api/dist
COPY --from=build /app/apps/web/dist   ./apps/web/dist
COPY apps/api/migrations               ./apps/api/migrations
COPY packages/shared/src               ./packages/shared/src
COPY scripts/run-migrations.mjs        ./scripts/run-migrations.mjs
COPY infra/docker-entrypoint.sh        ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
