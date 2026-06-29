# StoreBox — Claude Code Project

## Vue d'ensemble
Application SaaS de gestion commerciale multi-magasin.
Vente gros & detail · Creances · SMS/WhatsApp · PDF · Multi-magasin

## Stack technique
- **Monorepo** : npm workspaces
- **API** : Node.js 20 + Express + TypeScript
- **Web** : React 18 + Vite + TypeScript + Tailwind CSS
- **DB** : PostgreSQL 16 (driver `pg` — NE PAS migrer vers MySQL)
- **Auth** : JWT (jsonwebtoken + bcrypt) — sessions en DB avec JTI
- **PDF** : pdfkit
- **SMS/WA** : Twilio / Orange CI / infobip
- **Deploiement** : O2SWITCH (cPanel + Node.js Passenger)

## Architecture de deploiement (O2SWITCH)
```
O2SWITCH (cPanel + Passenger)
├── public_html/
│   ├── app.js                    ← Entry point Node.js
│   ├── package.json
│   ├── dist/                     ← API compilée (Express)
│   ├── dist-web/                 ← Frontend Vite compilé (servi par Express)
│   ├── migrations/               ← SQL migrations
│   ├── .env                      ← Variables d'environnement
│   └── node_modules/
├── PostgreSQL (fourni O2SWITCH)
│   └── DATABASE_URL (via cPanel)
├── cPanel → Node.js Manager
│   └── App Node.js (auto-restart, Passenger gère les processus)
└── SSL → Let's Encrypt (via cPanel)
```

## Structure du monorepo
```
storebox/
├── CLAUDE.md                  ← Ce fichier (instructions Claude Code)
├── package.json               ← Workspace root
├── ecosystem.config.cjs       ← PM2 config (production)
├── apps/
│   ├── api/                   ← Backend Express/TypeScript
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts        ← Login, refresh, logout, change-password
│   │   │   │   ├── ventes.ts      ← Ventes CRUD + paiements (transactions)
│   │   │   │   ├── referentiels.ts← CRUD dynamique des 13 tables referentiels
│   │   │   │   ├── societe.ts     ← Parametres societe (singleton)
│   │   │   │   └── index.ts       ← Dashboard, produits, clients, creances,
│   │   │   │                         dettes, achats, stock, depenses, devis,
│   │   │   │                         retours, bons commande, rapports, admin
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts        ← requireAuth / requirePerm (JWT + session DB)
│   │   │   ├── services/
│   │   │   │   └── notifications.ts← SMS/WA (alerteStock, confirmerVente…)
│   │   │   └── lib/
│   │   │       ├── db.ts          ← Pool pg + wrapper db.query / db.connect
│   │   │       └── helpers.ts     ← ok(), fail(), wrap()
│   │   ├── migrations/            ← SQL migrations (001 → 014+)
│   │   └── package.json
│   └── web/                   ← Frontend React/Vite
│       ├── src/
│       │   ├── components/
│       │   │   ├── layout/    ← AppLayout, PageHeader
│       │   │   └── ui/        ← Modal, Badge, SearchPalette, ReferentielSelect
│       │   ├── pages/         ← LoginPage, DashboardPage, VentesPage, etc.
│       │   ├── hooks/         ← useAuth, useApi, useCreances, useMagasin…
│       │   └── lib/           ← api client, formatters
│       └── package.json
├── packages/
│   └── shared/                ← Types TypeScript partages API↔Web
├── scripts/
│   ├── setup-vps.sh           ← Installation initiale VPS (1 seule fois)
│   └── deploy.sh              ← Deploiement (build + migrations + PM2)
└── infra/
    ├── docker-compose.yml     ← Dev local uniquement (PostgreSQL)
    └── nginx/storebox.conf    ← Config Nginx production
```

## Commandes principales
```bash
# Installation
npm install

# Developpement (API + Web en parallele)
npm run dev

# Build production
npm run build

# Base de donnees
npm run db:setup       # migrations initiales
npm run db:migrate     # schema seulement

# Deploiement O2SWITCH
npm run deploy:o2switch   # prepare build pour SFTP

# Generation de secret JWT
npm run gen-secret
```

**Voir** : [O2SWITCH_DEPLOYMENT.md](./O2SWITCH_DEPLOYMENT.md) pour guide complet.

## Variables d'environnement
Copier `apps/api/.env.example` → `apps/api/.env`

Cles importantes :
- `DATABASE_URL` — PostgreSQL connection string (`postgresql://user:pass@host:5432/db`)
- `JWT_SECRET` — generer avec `npm run gen-secret` (min 64 chars)
- `TWILIO_*` — SMS et WhatsApp
- `SMS_PROVIDER` — `twilio` | `orange_ci` | `infobip`
- `WA_PROVIDER` — `twilio` | `infobip`

## Architecture DB — points importants
- **Placeholders** : `$1, $2, …` (syntaxe pg, PAS `?`)
- **INSERT avec retour** : `INSERT INTO … VALUES (…) RETURNING *`
- **Transactions** : `db.connect()` → `client.query('BEGIN')` / `COMMIT` / `ROLLBACK` / `client.release()`
- **Triggers** : `trg_paiement_vente` et `trg_paiement_achat` recalculent automatiquement `montant_paye` et `solde_restant`
- **Vues** : `v_creances_clients`, `v_dettes_fournisseurs`, `v_echeances_30j`, `v_stocks`, `v_stocks_consolide`, `v_mouvements_stock`, `v_rentabilite_produits`
- **JSONB** : `roles.permissions` (droits par role), `audit_logs.details`
- **Monetaire** : `NUMERIC(15,0)` — jamais de decimales (FCFA)
- **Sessions** : JWT stateful — chaque token a un JTI stocke en DB, revocable

## Multi-magasin (migrations 013 + 014)
- **Table `magasins`** : chaque magasin a un `code` unique, `nom`, `actif`
- **Table `stocks(produit_id, magasin_id)`** : stock par produit par magasin
- **Table `transferts_stock`** : historique des transferts inter-magasins
- **Scoping API** : `scopeMagasin(req)` retourne `req.user.magasin_id`
- **JWT** : payload etendu avec `magasin_id: number | null`
- **Frontend** : `useMagasin()` hook — Zustand persist

## Domaine metier
- **Monnaie** : FCFA (Francs CFA) — toujours en entiers, jamais de decimales
- **TVA** : 18% par defaut (Cote d'Ivoire)
- **Ventes** : deux types — `gros` (B2B) et `detail` (B2C)
- **Creances** : ageing en 4 buckets — `non_echu` / `echu_30j` / `echu_60j` / `contentieux`
- **Dettes** : meme logique cote fournisseurs
- **Referentiels** : 13 tables dynamiques administrables via UI

## Conventions de code
- TypeScript strict (`"strict": true`)
- Noms de fonctions en camelCase francais (ex: `chargerCreances`, `envoyerRelance`)
- Noms de tables SQL en snake_case francais (ex: `ventes_lignes`, `moyens_paiement`)
- Reponses API uniformes : `{ success: boolean, data?: T, error?: string }` via `ok()` / `fail()`
- Routes wrappees dans `wrap()` pour propagation automatique des erreurs async
- Dates : toujours ISO 8601, affichage en fr-FR (DD/MM/YYYY)
- Formatage monetaire : `Intl.NumberFormat('fr-CI')` + " F"

## Comptes de demo
| Email | Mot de passe | Role |
|-------|-------------|------|
| admin@storebox.app | Storebox@123 | Administrateur |
| commercial@storebox.app | Storebox@123 | Commercial |
| caisse@storebox.app | Storebox@123 | Caissier |
| compta@storebox.app | Storebox@123 | Comptable |
| stock@storebox.app | Storebox@123 | Magasinier |
