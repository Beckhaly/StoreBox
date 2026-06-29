# StoreBox — Gestion commerciale multi-magasin

Application SaaS de gestion commerciale pour les commerces (Côte d'Ivoire) :
ventes gros & détail, point de vente (caisse), stock multi-magasin, créances
& dettes, et un module **produits universel** (téléphones, fruits au kilo,
liquides au litre, tissus au mètre…).

> Monnaie **FCFA** · TVA 18% · SMS/WhatsApp (Twilio / Orange CI / Infobip)

---

## ✨ Fonctionnalités

- **Point de vente / Caisse** : sessions par caissier, multi-caisses, ticket, encaissement multi-moyens.
- **Produits universels** : unités de mesure, **vente au poids/volume** (quantités décimales), prix variable à la pesée.
- **Périssables** : lots + dates de péremption, **rotation FIFO** à la vente, démarque lot-aware, **alertes d'expiration** (SMS/WhatsApp), page dédiée *Lots & Péremption*.
- **Stock multi-magasin** : stock par magasin, transferts inter-magasins, mouvements tracés.
- **Achats & Bons de commande** : réception (partielle) d'un BC → achat fournisseur, création de lots à la réception.
- **Créances / Dettes** : suivi par âge (ageing), relances SMS/WhatsApp.
- **Ventes gros & détail**, devis, retours, dépenses, rapports & rentabilité.

## 🧱 Stack technique

| Couche | Techno |
|---|---|
| API | Node 20 · Express · TypeScript |
| Web | React 18 · Vite · Tailwind |
| Base | PostgreSQL 16 (vues, triggers, procédures stockées) |
| Auth | JWT (sessions en DB, révocables) · bcrypt |
| Tests | Vitest (28 unitaires + 33 d'intégration) |
| Mono-repo | npm workspaces (`apps/*`, `packages/*`) |

## 🚀 Démarrage rapide (Docker — recommandé)

Tout-en-un : **PostgreSQL + API + SPA** dans un seul conteneur.

```bash
cp infra/.env.example infra/.env        # renseigner JWT_SECRET, POSTGRES_PASSWORD
docker compose -f infra/docker-compose.yml --profile solo up -d --build
#   → http://localhost:8080
```
Migrations appliquées automatiquement au démarrage. Base **vierge** par défaut
(pour charger les données de démo : `SEED_DEMO=true`).

### Développement local (sans Docker)

```bash
npm install
# PostgreSQL local + apps/api/.env (DATABASE_URL, JWT_SECRET)
npm run dev      # API (5000) + Web (3000) en parallèle
```

## 📦 Déploiement

| Cible | Guide |
|---|---|
| **VPS Linux + Docker** (Caddy, HTTPS auto) | [`DEPLOY_VPS.md`](DEPLOY_VPS.md) |
| **Image livrable par client** (clé-en-main) | [`deploy/README.md`](deploy/README.md) · `scripts/release-image.sh` |
| **Multi-clients** (1 conteneur par client) | `scripts/storebox-tenant.sh` |
| **Windows Server sans Docker** | [`DEPLOY_WINDOWS.md`](DEPLOY_WINDOWS.md) |
| **cPanel / O2SWITCH** | [`O2SWITCH_DEPLOYMENT.md`](O2SWITCH_DEPLOYMENT.md) |

### Produire une image livrable
```bash
./scripts/release-image.sh 1.0.2        # → storebox-1.0.2.tar.gz (≈200 Mo)
```

## 🗂️ Structure

```
apps/
  api/        Express + TypeScript + migrations SQL (001 → 025)
  web/        React + Vite + Tailwind
packages/
  shared/     Types TypeScript partagés API ↔ Web
infra/        docker-compose (solo / prod / vps), Caddy, nginx
deploy/       Bundle d'installation client (image pré-construite)
scripts/      release-image, storebox-tenant, run-migrations, deploy-*
```

## 🔑 Comptes de démonstration

> Disponibles uniquement avec `SEED_DEMO=true`. **À changer/supprimer en production.**

| Email | Mot de passe | Rôle |
|---|---|---|
| admin@storebox.app | `Storebox@123` | Administrateur |
| commercial@storebox.app | `Storebox@123` | Commercial |
| caisse@storebox.app | `Storebox@123` | Caissier |

## 🧪 Tests

```bash
npm test -w apps/api          # unitaires + intégration
```

## 🔒 Sécurité (production)

- Générer un `JWT_SECRET` fort (`openssl rand -hex 64`) et un mot de passe Postgres unique.
- Changer/supprimer les comptes de démo.
- N'exposer que 80/443 (HTTPS via Caddy) ; sauvegardes `pg_dump` planifiées.

---

_Développé avec [Claude Code](https://claude.com/claude-code)._
