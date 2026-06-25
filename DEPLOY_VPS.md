# Déploiement StoreBox sur un VPS (Docker)

Déploiement **sans aucune modification du code** : on utilise l'image
tout-en-un (PostgreSQL + API + SPA) derrière Caddy (HTTPS automatique).

Résultat : `https://votre-domaine` servant l'application complète.

---

## Prérequis
- Un **VPS** Linux (Ubuntu/Debian) — 1 vCPU / 2 Go RAM suffisent pour démarrer.
- Un **nom de domaine** avec un enregistrement **DNS `A`** pointant vers l'IP du VPS
  (ex. `storebox.mondomaine.com → 51.xx.xx.xx`).
- Ports **80** et **443** ouverts (pare-feu / security group).

---

## Installation (≈ 15 min)

### 1. Installer Docker sur le VPS
```bash
curl -fsSL https://get.docker.com | sh
```

### 2. Récupérer le projet
```bash
git clone <votre-repo> storebox
cd storebox
```

### 3. Configurer les secrets
```bash
cp infra/.env.example infra/.env
nano infra/.env
```
Renseigner au minimum :
```
POSTGRES_PASSWORD=<mot-de-passe-fort>
JWT_SECRET=<64+ caractères>          # générer : openssl rand -hex 64
CADDY_DOMAIN=storebox.mondomaine.com # votre domaine (DNS A déjà pointé)
```
(Optionnel : identifiants Twilio/SMS, GERANT_TEL.)

### 4. Lancer
```bash
docker compose -f infra/docker-compose.vps.yml up -d --build
```
Au premier démarrage : build de l'image, init de PostgreSQL, application des
migrations `001 → 023`, puis Caddy obtient le certificat Let's Encrypt.

### 5. Vérifier
```bash
docker compose -f infra/docker-compose.vps.yml ps        # storebox + caddy "Up"
curl -fsSL https://storebox.mondomaine.com/api/health    # {"status":"ok",...}
```
Ouvrir `https://storebox.mondomaine.com` → page de connexion StoreBox.

> Comptes de démo : `admin@storebox.app` / `Storebox@123` (à supprimer/changer en prod).

---

## Exploitation

| Action | Commande |
|---|---|
| Logs | `docker compose -f infra/docker-compose.vps.yml logs -f` |
| Redémarrer | `docker compose -f infra/docker-compose.vps.yml restart` |
| Arrêter | `docker compose -f infra/docker-compose.vps.yml down` |
| Mettre à jour | `git pull && docker compose -f infra/docker-compose.vps.yml up -d --build` |

### Sauvegarde de la base
```bash
docker exec storebox-solo pg_dump -U storebox storebox_ci > backup_$(date +%F).sql
```
### Restauration
```bash
cat backup_2026-06-14.sql | docker exec -i storebox-solo psql -U storebox -d storebox_ci
```

Les données persistent dans le volume Docker `storebox_solo_data`
(survit aux redémarrages et aux `up --build`).

---

## Sécurité (recommandé en prod)
- Changer/supprimer les **comptes de démo**.
- `JWT_SECRET` et `POSTGRES_PASSWORD` forts et **uniques**.
- Pare-feu : n'exposer que **80/443** (la base reste interne au conteneur).
- Sauvegardes `pg_dump` planifiées (cron).

> Note : architecture « tout-en-un » volontairement simple (un conteneur).
> Pour monter en charge, on pourra séparer la base (profil `prod` du
> `docker-compose.yml`) sans changer le code applicatif.
