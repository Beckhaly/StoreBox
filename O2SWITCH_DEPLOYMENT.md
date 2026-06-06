# StoreBox — Déploiement O2SWITCH (cPanel + Node.js + PostgreSQL)

## Architecture

```
O2SWITCH (cPanel)
├── public_html/
│   ├── app.js                    ← Point d'entrée Node.js (Passenger)
│   ├── package.json              ← dépendances
│   ├── ecosystem.config.cjs       ← PM2 (optionnel)
│   ├── dist/                      ← API compilée (TypeScript)
│   ├── dist-web/                 ← Frontend Vite compilé (servi par Express)
│   ├── .env                       ← Variables d'environnement
│   └── node_modules/
├── PostgreSQL (fourni par O2SWITCH)
│   └── storebox_db (DATABASE_URL via cPanel)
└── Phpmyadmin / pgAdmin (accès via cPanel)
```

## Processus de déploiement

### 1. Préparation locale

```bash
# Build tout
npm run build

# Créer la structure pour O2SWITCH
mkdir -p deploy/public_html
cp package.json deploy/public_html/
cp package-lock.json deploy/public_html/
cp ecosystem.config.cjs deploy/public_html/

# Copier API compilée
cp -r apps/api/dist deploy/public_html/dist

# Copier Frontend compilée
cp -r apps/web/dist deploy/public_html/dist-web

# Créer app.js wrapper
cat > deploy/public_html/app.js << 'EOF'
require('dotenv').config();
require('./dist/index.js');
EOF
```

### 2. Upload via cPanel / SFTP

```bash
# Via SFTP
sftp nom_compte@o2switch-ftp.com
cd public_html
put -r deploy/public_html/*
```

### 3. Configuration cPanel

**Via cPanel → Node.js Manager :**

1. Créer application Node.js
   - **Domaine** : votredomaine.com (ou sous-domaine)
   - **Port** : 3001
   - **Node version** : 20 (ou 22)
   - **Application startup file** : `app.js`
   - **Application URL** : votredomaine.com

2. Passenger va :
   - Installer les dépendances (`npm ci`)
   - Lancer `node app.js`
   - Auto-restart si crash
   - Proxy port 3001 → domaine public

### 4. Variables d'environnement

**Via cPanel ou fichier `.env`** :

```bash
DATABASE_URL=postgresql://utilisateur:motdepasse@localhost:5432/storebox_db
PORT=3001
FRONTEND_URL=https://votredomaine.com
NODE_ENV=production
JWT_SECRET=<generer avec: npm run gen-secret>
```

Pour obtenir les identifiants PostgreSQL O2SWITCH :
- cPanel → **Bases de donnees PostgreSQL**
- Créer user + base
- Copier `DATABASE_URL`

### 5. Migrations base de données

```bash
# Depuis votre machine, via SSH O2SWITCH
ssh nom_compte@votredomaine.com

# Dans le répertoire public_html
psql $DATABASE_URL -f dist/migrations/001_schema.sql
psql $DATABASE_URL -f dist/migrations/002_seed.sql
psql $DATABASE_URL -f dist/migrations/003_auth.sql
# ... etc pour 004, 005, etc.
```

### 6. Frontend (SPA)

L'API Express sert aussi les fichiers statiques Vite :

```typescript
// apps/api/src/index.ts
app.use(express.static(path.join(__dirname, '../../../apps/web/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../apps/web/dist/index.html'));
});
```

Cela permet au SPA React de fonctionner avec le router côté client.

---

## Déploiement continu (CI/CD simple)

**Via GitHub Actions** :

```yaml
# .github/workflows/deploy-o2switch.yml
name: Deploy to O2SWITCH

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build
        run: npm ci && npm run build
      
      - name: Deploy SFTP
        uses: wangyucode/sftp-upload-action@v2.0.2
        with:
          host: o2switch-ftp.com
          username: ${{ secrets.SFTP_USER }}
          password: ${{ secrets.SFTP_PASS }}
          localDir: ./deploy/public_html
          remoteDir: /public_html
          skipCreateDir: true
          deleteRemote: false
          ignoreFile: |
            node_modules/
            .git/
```

---

## Points importants

### ✅ Avantages O2SWITCH + Node.js

- **Tout sur un serveur** (API + Frontend + BDD)
- **Pas de CORS** (même origine)
- **PostgreSQL fourni** (inclus)
- **cPanel** facile à utiliser
- **Prix** : ~60-80€/an

### ⚠️ Limitations

- **RAM limitée** (dépend de l'offre O2SWITCH)
- **Pas PM2 natif** (Passenger gère les processus)
- **Redémarrage** via cPanel, pas CLI
- **Logs** : voir via cPanel

### 📊 Monitoring

- cPanel → **Metrics** (CPU, RAM, connexions)
- cPanel → **Error logs** (Apache/Node)
- Frontend : ajouter monitoring (Sentry, LogRocket)

---

## Rollback en cas d'erreur

Si le déploiement casse tout :

1. cPanel → **Node.js Manager** → Stop app
2. SSH : `cd public_html && git checkout HEAD -- dist/`
3. Redémarrer l'app

Ou via SFTP : restaurer les fichiers depuis backup.

---

## Scripts npm à ajouter

```json
{
  "scripts": {
    "deploy:o2switch": "npm run build && bash scripts/deploy-o2switch.sh"
  }
}
```

```bash
# scripts/deploy-o2switch.sh
#!/bin/bash
set -e

mkdir -p deploy/public_html
cp package.json deploy/public_html/
cp package-lock.json deploy/public_html/
cp ecosystem.config.cjs deploy/public_html/
cp -r apps/api/dist deploy/public_html/
cp -r apps/web/dist deploy/public_html/dist-web

cat > deploy/public_html/app.js << 'EOF'
require('dotenv').config();
require('./dist/index.js');
EOF

echo "✅ Build prêt pour O2SWITCH : deploy/public_html/"
echo "📤 Uploader via SFTP ou cPanel File Manager"
```

---

## Checklist déploiement

- [ ] Node.js 20 configuré dans cPanel
- [ ] PostgreSQL créé, identifiants en `.env`
- [ ] Migrations appliquées (`001_schema`, `002_seed`, `003_auth`, etc.)
- [ ] `JWT_SECRET` généré et configuré
- [ ] Tests : curl `https://votredomaine.com/api/health`
- [ ] Frontend : vérifier accès et login
- [ ] DNS pointé vers O2SWITCH
- [ ] SSL Let's Encrypt activé dans cPanel
