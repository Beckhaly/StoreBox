const PDFDocument = require('pdfkit');
const fs          = require('fs');
const path        = require('path');

const OUT = path.join(__dirname, 'rapport-deploiement.pdf');
const doc = new PDFDocument({ margin: 50, size: 'A4' });
doc.pipe(fs.createWriteStream(OUT));

// ── Palette ───────────────────────────────────────────────────────────────
const BLEU    = '#1E40AF';
const VERT    = '#15803D';
const ROUGE   = '#DC2626';
const VIOLET  = '#7C3AED';
const ORANGE  = '#D97706';
const GRIS    = '#6B7280';
const GRIS_CL = '#F1F5F9';
const BLANC   = '#FFFFFF';
const NOIR    = '#1E293B';
const BORD    = '#CBD5E1';
const DARK    = '#0F172A';

// ── Utilitaires ───────────────────────────────────────────────────────────
function checkPage(needed = 60) {
  if (doc.y > 760 - needed) doc.addPage();
}

function bandeau(texte, couleur = BLEU, sub = '') {
  checkPage(44);
  const y = doc.y;
  doc.rect(50, y, 495, sub ? 34 : 26).fill(couleur);
  doc.fillColor(BLANC).fontSize(12).font('Helvetica-Bold')
     .text(texte, 60, y + 7, { lineBreak: false });
  if (sub) {
    doc.fontSize(8.5).font('Helvetica').fillColor('rgba(255,255,255,0.7)')
       .text(sub, 60, y + 21, { lineBreak: false });
  }
  doc.fillColor(NOIR).font('Helvetica').moveDown(sub ? 1.4 : 1);
}

function sousTitre(texte, couleur = BLEU) {
  checkPage(30);
  doc.moveDown(0.5)
     .fillColor(couleur).fontSize(11).font('Helvetica-Bold')
     .text(texte)
     .fillColor(NOIR).font('Helvetica').fontSize(10)
     .moveDown(0.3);
}

function para(texte, indent = 0) {
  checkPage(24);
  doc.fontSize(10).font('Helvetica').fillColor(NOIR)
     .text(texte, 50 + indent, doc.y, { width: 495 - indent }).moveDown(0.35);
}

function puce(texte, couleur = NOIR, bold = false) {
  checkPage(14);
  doc.fontSize(10).font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(couleur)
     .text(`• ${texte}`, { indent: 12, width: 478 });
}

function check(texte, ok = true) {
  checkPage(14);
  const s = ok ? '✓' : '✗';
  const c = ok ? VERT : ROUGE;
  doc.fontSize(10).font('Helvetica-Bold').fillColor(c)
     .text(s, 60, doc.y, { continued: true, width: 18 });
  doc.font('Helvetica').fillColor(NOIR).text(` ${texte}`);
}

function warn(texte) {
  checkPage(14);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(ORANGE)
     .text('⚠ ', 60, doc.y, { continued: true, width: 18 });
  doc.font('Helvetica').fillColor(NOIR).text(texte);
}

function info(label, valeur, couleurVal = NOIR) {
  checkPage(14);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(GRIS)
     .text(label, 60, doc.y, { continued: true, width: 200 });
  doc.font('Helvetica').fillColor(couleurVal).text(valeur);
}

function codeBlock(lignes, titre = '') {
  const h = lignes.length * 11.8 + (titre ? 24 : 10);
  checkPage(h + 8);
  const y = doc.y;
  if (titre) {
    doc.rect(50, y, 495, 16).fill('#1E293B');
    doc.fillColor('#94A3B8').fontSize(8).font('Helvetica-Bold')
       .text(titre, 58, y + 4, { lineBreak: false });
    doc.rect(50, y + 16, 495, h - 16).fill(DARK);
    let cy = y + 22;
    lignes.forEach(l => {
      const isComment = l.trimStart().startsWith('#') || l.trimStart().startsWith('--');
      const col = isComment ? '#4ADE80' : l.includes('$') || l.trim().startsWith('-') ? '#FCD34D' : '#E2E8F0';
      doc.fontSize(7.8).font('Courier').fillColor(col)
         .text(l, 58, cy, { lineBreak: false, width: 480 });
      cy += 11.8;
    });
    doc.y = cy + 6;
  } else {
    doc.rect(50, y, 495, h).fill(DARK);
    let cy = y + 6;
    lignes.forEach(l => {
      const isComment = l.trimStart().startsWith('#') || l.trimStart().startsWith('--');
      const col = isComment ? '#4ADE80' : l.includes('$') ? '#FCD34D' : '#E2E8F0';
      doc.fontSize(7.8).font('Courier').fillColor(col)
         .text(l, 58, cy, { lineBreak: false, width: 480 });
      cy += 11.8;
    });
    doc.y = cy + 6;
  }
}

function tableau(headers, rows, colWidths) {
  const totalH = rows.length * 16 + 20;
  checkPage(totalH + 10);
  const x0 = 50;
  let y = doc.y + 2;
  doc.rect(x0, y, 495, 18).fill(BLEU);
  let cx = x0;
  headers.forEach((h, i) => {
    doc.fillColor(BLANC).fontSize(8.5).font('Helvetica-Bold')
       .text(h, cx + 4, y + 4, { width: colWidths[i] - 4, lineBreak: false });
    cx += colWidths[i];
  });
  y += 18;
  rows.forEach((r, ri) => {
    doc.rect(x0, y, 495, 15).fill(ri % 2 === 0 ? GRIS_CL : BLANC);
    cx = x0;
    r.forEach((cell, ci) => {
      const isVert  = typeof cell === 'string' && (cell.includes('✓') || cell === 'Oui' || cell.startsWith('✓'));
      const isRouge = typeof cell === 'string' && (cell.includes('✗') || cell === 'Non' || cell.startsWith('✗'));
      const isOrange = typeof cell === 'string' && cell.includes('Limité');
      const col  = isVert ? VERT : isRouge ? ROUGE : isOrange ? ORANGE : NOIR;
      const bold = isVert || isRouge;
      doc.fontSize(8.5).font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(col)
         .text(cell, cx + 4, y + 3, { width: colWidths[ci] - 4, lineBreak: false });
      cx += colWidths[ci];
    });
    y += 15;
  });
  doc.rect(x0, doc.y - (rows.length * 15 + 18), 495, rows.length * 15 + 18).stroke(BORD);
  doc.y = y + 6;
}

function encadreNote(texte, couleur = ORANGE) {
  checkPage(40);
  const y = doc.y;
  doc.rect(50, y, 4, 36).fill(couleur);
  doc.rect(54, y, 491, 36).fill(couleur === ORANGE ? '#FFFBEB' : '#EFF6FF').stroke(BORD);
  doc.fontSize(9).font('Helvetica').fillColor(NOIR)
     .text(texte, 62, y + 6, { width: 476 });
  doc.y = y + 42;
}

function separateur() {
  checkPage(10);
  doc.moveDown(0.3);
  doc.rect(50, doc.y, 495, 0.5).fill(BORD);
  doc.moveDown(0.6);
}

// ═══════════════════════════════════════════════════════════════
// PAGE 1 — COUVERTURE
// ═══════════════════════════════════════════════════════════════
doc.rect(0, 0, 595, 220).fill(DARK);
doc.rect(0, 220, 595, 6).fill(BLEU);

// Grille décorative
for (let i = 0; i < 12; i++) {
  doc.rect(50 + i * 42, 30, 1, 180).fill('rgba(255,255,255,0.03)');
}
for (let i = 0; i < 6; i++) {
  doc.rect(50, 30 + i * 32, 495, 1).fill('rgba(255,255,255,0.03)');
}

doc.fillColor(BLANC).fontSize(30).font('Helvetica-Bold')
   .text('TéléPro CI', 50, 52, { align: 'center' });
doc.fontSize(16).font('Helvetica').fillColor('#93C5FD')
   .text('Guide de déploiement en production', { align: 'center' });
doc.fontSize(10).fillColor('#475569')
   .text('VPS · PostgreSQL · Node.js · Nginx · PM2 · SSL', { align: 'center' });

doc.y = 250;

// Carte sommaire
doc.rect(50, 252, 495, 130).fill(GRIS_CL).stroke(BORD);
doc.fillColor(NOIR).fontSize(11).font('Helvetica-Bold').text('Ce document couvre', 68, 264);

const sommaire = [
  ['1', 'Comparaison hébergeurs (O2switch, VPS, Cloud)',         60],
  ['2', 'Installation complète sur VPS Ubuntu 22.04',           200],
  ['3', 'Stack cloud managé (Railway + Neon) — zéro admin',     340],
  ['4', 'Commandes de déploiement et mises à jour',             60],
  ['5', 'Sécurité, sauvegardes et surveillance',                200],
];
sommaire.forEach(([n, t, x], i) => {
  const col = i < 3 ? 68 : (i === 3 ? 68 : 68);
  const row = Math.floor(i / 2);
  const xOff = i % 2 === 0 ? 68 : 310;
  doc.fontSize(9).font('Helvetica').fillColor(GRIS)
     .text(`${n}.`, xOff, 282 + row * 16, { continued: true, width: 16 });
  doc.fillColor(NOIR).text(` ${t}`, { width: 220 });
});

doc.fillColor(GRIS).fontSize(9).font('Helvetica')
   .text('Généré le ' + new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' }),
     { align: 'right' });

// ═══════════════════════════════════════════════════════════════
// PAGE 2 — O2SWITCH ET COMPARAISON HÉBERGEURS
// ═══════════════════════════════════════════════════════════════
doc.addPage();
bandeau('1. Peut-on utiliser O2switch ?', ROUGE, 'Analyse de compatibilité');

para(
  'O2switch est un hébergement mutualisé français très populaire (offre unique ~7 €/mois). ' +
  'Malheureusement, il manque plusieurs prérequis techniques de TéléPro CI.'
);

sousTitre('Compatibilité O2switch vs besoins TéléPro CI');
tableau(
  ['Fonctionnalité', 'O2switch mutualisé', 'Besoin TéléPro CI'],
  [
    ['PostgreSQL 16',        '✗ MySQL uniquement', '✓ Obligatoire (driver pg)'],
    ['Node.js autonome',     'Limité (Passenger)', '✓ PM2 + ports libres'],
    ['Accès root SSH',       '✗',                  '✓ Pour PM2 et services'],
    ['PM2',                  '✗',                  '✓ Redémarrage auto'],
    ['Config Nginx custom',  '✗',                  '✓ Proxy API + gzip'],
    ['Docker',               '✗',                  'Optionnel'],
    ['Ports personnalisés',  '✗',                  '✓ Port 3001 (API)'],
    ['Variables env système','Limité (cPanel)',     '✓ JWT_SECRET, DATABASE_URL'],
  ],
  [190, 155, 150]
);

encadreNote(
  '⚠  Blocage principal : O2switch ne propose que MySQL/MariaDB. ' +
  'Le projet interdit explicitement la migration vers MySQL (driver pg, syntaxe $1/$2, ' +
  'RETURNING *, triggers PL/pgSQL). Migrer la DB représenterait plusieurs semaines de travail.',
  ROUGE
);

sousTitre('Cas où O2switch reste utile');
puce('Gestionnaire de nom de domaine et DNS (pointer vers votre VPS)');
puce('Héberger le frontend uniquement (upload du dossier dist/ par FTP)');
puce('Adresse email professionnelle @votre-domaine.ci');

separateur();
sousTitre('Comparaison des hébergeurs VPS recommandés');
tableau(
  ['Hébergeur', 'Offre', 'RAM/CPU', 'Prix/mois', 'Latence CI'],
  [
    ['Contabo ★',    'VPS S',         '8 Go / 4 vCPU', '~6 €',  'Bon'],
    ['Hetzner',      'CX22',          '4 Go / 2 vCPU', '~4 €',  'Bon'],
    ['OVH',          'VPS Starter',   '2 Go / 1 vCPU', '~6 €',  'Bon (Paris)'],
    ['DigitalOcean', 'Droplet Basic', '4 Go / 2 vCPU', '~24 $', 'Correct'],
    ['Scaleway',     'DEV1-S',        '2 Go / 2 vCPU', '~4 €',  'Bon (Paris)'],
  ],
  [100, 110, 120, 85, 80]
);

sousTitre('3 scénarios possibles');

doc.rect(50, doc.y, 495, 16).fill(VERT);
doc.fillColor(BLANC).fontSize(9).font('Helvetica-Bold')
   .text('Option A — VPS classique (recommandé)', 58, doc.y - 13);
doc.fillColor(NOIR).moveDown(0.3);
puce('Contrôle total : PostgreSQL, PM2, Nginx, SSL sur un seul serveur');
puce('Coût : 4–8 €/mois · Compétence requise : administration Linux basique');
puce('Idéal si vous voulez héberger plusieurs instances (multi-clients)');

doc.moveDown(0.4);
doc.rect(50, doc.y, 495, 16).fill(VIOLET);
doc.fillColor(BLANC).fontSize(9).font('Helvetica-Bold')
   .text('Option B — Cloud managé (Railway + Neon)', 58, doc.y - 13);
doc.fillColor(NOIR).moveDown(0.3);
puce('Zéro administration serveur : Railway gère Node.js, Neon gère PostgreSQL');
puce('Coût : ~10 $/mois · Déploiement en 30 min depuis GitHub');
puce('Idéal si vous ne voulez pas gérer l\'infra');

doc.moveDown(0.4);
doc.rect(50, doc.y, 495, 16).fill(ORANGE);
doc.fillColor(BLANC).fontSize(9).font('Helvetica-Bold')
   .text('Option C — O2switch (front) + VPS (API + DB)', 58, doc.y - 13);
doc.fillColor(NOIR).moveDown(0.3);
puce('Garder O2switch pour le frontend statique + domaine');
puce('Petit VPS Hetzner (~4 €) pour l\'API Express + PostgreSQL');
puce('Idéal si vous avez déjà un abonnement O2switch actif');

// ═══════════════════════════════════════════════════════════════
// PAGE 3 — OPTION A : INSTALLATION VPS
// ═══════════════════════════════════════════════════════════════
doc.addPage();
bandeau('2. Option A — Installation complète sur VPS', BLEU, 'Ubuntu 22.04 LTS · Node.js 20 · PostgreSQL 16 · Nginx · PM2');

sousTitre('Étape 1 — Sécurisation initiale du serveur');
codeBlock([
  '# Connexion SSH initiale',
  'ssh root@IP_DU_SERVEUR',
  '',
  '# Créer un utilisateur dédié',
  'adduser telepro',
  'usermod -aG sudo telepro',
  'rsync --archive --chown=telepro:telepro ~/.ssh /home/telepro',
  '',
  '# Pare-feu (ouvrir uniquement SSH, HTTP, HTTPS)',
  'ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable',
  '',
  '# Se reconnecter en tant qu\'utilisateur non-root',
  'ssh telepro@IP_DU_SERVEUR',
], 'bash — sécurisation');

sousTitre('Étape 2 — Installer les dépendances');
codeBlock([
  '# Node.js 20 LTS',
  'curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -',
  'sudo apt-get install -y nodejs',
  '',
  '# PostgreSQL 16',
  'sudo apt install -y postgresql postgresql-contrib',
  '',
  '# Nginx + Certbot (SSL)',
  'sudo apt install -y nginx certbot python3-certbot-nginx',
  '',
  '# PM2 (gestionnaire de processus Node.js)',
  'sudo npm install -g pm2',
  '',
  '# Vérifications',
  'node -v        # → v20.x',
  'psql --version # → PostgreSQL 16.x',
  'nginx -v       # → nginx/1.24.x',
  'pm2 -v         # → 5.x',
], 'bash — installation');

sousTitre('Étape 3 — Configurer PostgreSQL');
codeBlock([
  'sudo -u postgres psql',
  '',
  '-- Créer l\'utilisateur et la base',
  'CREATE USER telepro WITH PASSWORD \'VotreMotDePasseForte!\';',
  'CREATE DATABASE telepro_ci OWNER telepro;',
  'GRANT ALL PRIVILEGES ON DATABASE telepro_ci TO telepro;',
  '\\q',
  '',
  '# Tester la connexion',
  'psql postgresql://telepro:VotreMotDePasseForte!@localhost:5432/telepro_ci',
], 'psql — configuration base de données');

sousTitre('Étape 4 — Déployer le code');
codeBlock([
  '# Option Git (recommandé)',
  'cd /home/telepro',
  'git clone https://github.com/VOTRE_ORG/telepro-standard.git app',
  'cd app',
  '',
  '# OU rsync depuis votre machine locale',
  'rsync -avz --exclude node_modules --exclude .git \\',
  '  ./ telepro@IP_DU_SERVEUR:/home/telepro/app/',
], 'bash — déploiement du code');

// ═══════════════════════════════════════════════════════════════
// PAGE 4 — SUITE INSTALLATION VPS
// ═══════════════════════════════════════════════════════════════
doc.addPage();
bandeau('2. Option A — Installation VPS (suite)', BLEU);

sousTitre('Étape 5 — Fichier d\'environnement');
codeBlock([
  'cd /home/telepro/app/apps/api',
  'cp .env.example .env',
  'nano .env',
], 'bash');

codeBlock([
  'NODE_ENV=production',
  'PORT=3001',
  '',
  '# Connexion PostgreSQL',
  'DATABASE_URL=postgresql://telepro:VotreMotDePasseForte!@localhost:5432/telepro_ci',
  '',
  '# Générer avec : npm run gen-secret  (min 64 caractères)',
  'JWT_SECRET=VOTRE_SECRET_64_CHARS_GENERE_AVEC_NPM_RUN_GEN_SECRET',
  '',
  '# Twilio SMS/WhatsApp (optionnel)',
  'TWILIO_ACCOUNT_SID=',
  'TWILIO_AUTH_TOKEN=',
  'SMS_PROVIDER=twilio',
], 'apps/api/.env');

sousTitre('Étape 6 — Build et migrations');
codeBlock([
  'cd /home/telepro/app',
  '',
  '# Installer les dépendances',
  'npm install',
  '',
  '# Builder le frontend React → apps/web/dist/',
  'cd apps/web && npm run build && cd ../..',
  '',
  '# Builder l\'API TypeScript → apps/api/dist/',
  'cd apps/api && npm run build && cd ../..',
  '',
  '# Appliquer toutes les migrations',
  'export DATABASE_URL=postgresql://telepro:MotDePasse!@localhost:5432/telepro_ci',
  '',
  'for f in 001 002 003 004_notifications 004_features 005 006 007 \\',
  '         008 009 010 011 012 013 014 015 016; do',
  '  psql $DATABASE_URL -f apps/api/migrations/${f}*.sql',
  'done',
], 'bash — build et migrations');

sousTitre('Étape 7 — Lancer avec PM2');
codeBlock([
  '# Créer le répertoire de logs',
  'sudo mkdir -p /var/log/telepro && sudo chown telepro:telepro /var/log/telepro',
  '',
  '# Fichier de configuration PM2',
  'cat > /home/telepro/app/apps/api/ecosystem.config.js << \'EOF\'',
  'module.exports = {',
  '  apps: [{',
  '    name:       \'telepro-api\',',
  '    script:     \'dist/index.js\',',
  '    instances:  2,',
  '    exec_mode:  \'cluster\',',
  '    env_file:   \'.env\',',
  '    error_file: \'/var/log/telepro/error.log\',',
  '    out_file:   \'/var/log/telepro/out.log\',',
  '    restart_delay: 3000,',
  '    max_restarts:  10,',
  '  }]',
  '};',
  'EOF',
  '',
  '# Démarrer l\'API',
  'cd /home/telepro/app/apps/api && pm2 start ecosystem.config.js',
  '',
  '# Activer le démarrage automatique au reboot',
  'pm2 save && pm2 startup   # → copier-coller la commande sudo affichée',
], 'bash — PM2');

sousTitre('Étape 8 — Nginx (proxy + frontend statique)');
codeBlock([
  'sudo nano /etc/nginx/sites-available/telepro',
], 'bash');

codeBlock([
  'server {',
  '    listen 80;',
  '    server_name votre-domaine.ci www.votre-domaine.ci;',
  '',
  '    # Frontend React (fichiers statiques)',
  '    root /home/telepro/app/apps/web/dist;',
  '    index index.html;',
  '',
  '    # SPA routing — toutes les routes → index.html',
  '    location / {',
  '        try_files $uri $uri/ /index.html;',
  '    }',
  '',
  '    # API — proxy vers Node.js port 3001',
  '    location /api/ {',
  '        proxy_pass         http://localhost:3001;',
  '        proxy_set_header   Host $host;',
  '        proxy_set_header   X-Real-IP $remote_addr;',
  '        proxy_set_header   X-Forwarded-Proto $scheme;',
  '        proxy_read_timeout 60s;',
  '    }',
  '',
  '    # Cache assets frontend (1 an)',
  '    location ~* \\.(js|css|png|jpg|svg|ico|woff2)$ {',
  '        expires 1y;',
  '        add_header Cache-Control "public, immutable";',
  '    }',
  '',
  '    gzip on;',
  '    gzip_types text/plain text/css application/json application/javascript;',
  '}',
], '/etc/nginx/sites-available/telepro');

codeBlock([
  '# Activer le site',
  'sudo ln -s /etc/nginx/sites-available/telepro /etc/nginx/sites-enabled/',
  'sudo nginx -t          # vérifier la syntaxe',
  'sudo systemctl reload nginx',
  '',
  '# Certificat SSL Let\'s Encrypt (HTTPS)',
  'sudo certbot --nginx -d votre-domaine.ci -d www.votre-domaine.ci',
  '# Certbot modifie Nginx automatiquement pour forcer HTTPS',
], 'bash — activation Nginx + SSL');

// ═══════════════════════════════════════════════════════════════
// PAGE 5 — OPTION B : CLOUD MANAGÉ
// ═══════════════════════════════════════════════════════════════
doc.addPage();
bandeau('3. Option B — Cloud managé sans administration serveur', VIOLET, 'Railway (API) + Neon (PostgreSQL) + Vercel (Frontend)');

para(
  'Cette option convient si vous ne voulez pas gérer un serveur Linux. ' +
  'Tous les services sont managés : mises à jour, sauvegardes et SSL sont automatiques. ' +
  'Coût total estimé : 10–15 $/mois pour un trafic PME.'
);

sousTitre('Architecture');
tableau(
  ['Composant', 'Service', 'Plan gratuit', 'Coût estimé'],
  [
    ['Frontend React',  'Vercel',   '✓ Illimité',      'Gratuit'],
    ['API Node.js',     'Railway',  '✓ 500h/mois',     '~5 $/mois'],
    ['PostgreSQL',      'Neon',     '✓ 500 Mo / 1 DB', 'Gratuit ou ~19 $/mois'],
    ['Domaine + DNS',   'O2switch', '—',               'Existant'],
  ],
  [130, 100, 130, 135]
);

sousTitre('Étape 1 — PostgreSQL sur Neon (neon.tech)');
codeBlock([
  '# 1. Créer un compte sur https://neon.tech',
  '# 2. New Project → choisir région "Europe West" (Frankfurt)',
  '# 3. Copier la DATABASE_URL fournie, ex :',
  '#    postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require',
  '',
  '# Appliquer les migrations depuis votre machine locale',
  'export DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require"',
  '',
  'psql $DATABASE_URL -f apps/api/migrations/001_schema.sql',
  'psql $DATABASE_URL -f apps/api/migrations/002_seed.sql',
  'psql $DATABASE_URL -f apps/api/migrations/003_auth.sql',
  '# ... jusqu\'à 016_multi_magasins.sql',
], 'bash — Neon PostgreSQL');

sousTitre('Étape 2 — API sur Railway (railway.app)');
codeBlock([
  '# 1. Créer un compte sur https://railway.app',
  '# 2. New Project → Deploy from GitHub repo',
  '# 3. Choisir le dépôt telepro-standard',
  '# 4. Railway détecte Node.js automatiquement',
  '',
  '# Dans Settings → Service → Root Directory : apps/api',
  '# Build Command  : npm install && npm run build',
  '# Start Command  : npm start',
  '',
  '# Variables d\'environnement à ajouter dans Railway Dashboard :',
  'NODE_ENV=production',
  'DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require',
  'JWT_SECRET=VOTRE_SECRET_64_CHARS',
  'PORT=3001',
], 'railway.app — configuration');

sousTitre('Étape 3 — Frontend sur Vercel (vercel.com)');
codeBlock([
  '# Installer Vercel CLI',
  'npm install -g vercel',
  '',
  '# Depuis le dossier apps/web',
  'cd apps/web',
  '',
  '# Créer .env.production',
  'echo "VITE_API_URL=https://votre-api.railway.app" > .env.production',
  '',
  '# Déployer',
  'vercel deploy --prod',
  '# → Vercel détecte Vite, build et déploie en ~2 minutes',
  '# → URL fournie : https://telepro-ci.vercel.app',
  '',
  '# Ajouter votre domaine custom dans Vercel Dashboard',
  '# puis pointer le CNAME chez O2switch vers cname.vercel-dns.com',
], 'bash — Vercel');

encadreNote(
  'Avantage Vercel + Railway : déploiement automatique à chaque git push sur main. ' +
  'Aucune intervention manuelle pour les mises à jour du code.',
  BLEU
);

// ═══════════════════════════════════════════════════════════════
// PAGE 6 — OPTION C + SCRIPT DE MISE À JOUR
// ═══════════════════════════════════════════════════════════════
doc.addPage();
bandeau('4. Option C + Script de déploiement automatisé', ORANGE, 'O2switch (front statique) + VPS Hetzner (API + DB)');

sousTitre('Option C — Architecture mixte');
para(
  'Vous conservez O2switch pour le frontend et le domaine, et ajoutez un petit VPS ' +
  '(Hetzner CX11 à ~4 €/mois) uniquement pour l\'API Express + PostgreSQL.'
);

codeBlock([
  '# 1. Builder le frontend avec l\'URL de l\'API VPS',
  'cd apps/web',
  'echo "VITE_API_URL=https://api.votre-domaine.ci" > .env.production',
  'npm run build',
  '',
  '# 2. Uploader apps/web/dist/ vers O2switch via FTP ou rsync',
  'rsync -avz apps/web/dist/ user@ftp.o2switch.net:~/public_html/',
  '',
  '# 3. Pointer un sous-domaine api.votre-domaine.ci vers le VPS',
  '#    Dans le manager O2switch : DNS Zone Editor',
  '#    Ajouter un enregistrement A : api → IP_VPS',
  '',
  '# 4. Sur le VPS : installer uniquement l\'API (étapes 1-7 de l\'Option A)',
  '#    Nginx sur le VPS n\'héberge QUE /api/*',
], 'bash — Option C');

separateur();
bandeau('Script de mise à jour (toutes options VPS)', VERT);

sousTitre('deploy.sh — à exécuter à chaque nouvelle version');
codeBlock([
  '#!/bin/bash',
  '# /home/telepro/app/deploy.sh',
  'set -e   # stopper en cas d\'erreur',
  '',
  'echo "→ Déploiement TéléPro CI $(date)"',
  'cd /home/telepro/app',
  '',
  '# 1. Récupérer le code',
  'git pull origin main',
  '',
  '# 2. Installer les nouvelles dépendances',
  'npm install',
  '',
  '# 3. Builder',
  'npm run build',
  '',
  '# 4. Appliquer les nouvelles migrations (décommenter si nécessaire)',
  '# psql $DATABASE_URL -f apps/api/migrations/XXX.sql',
  '',
  '# 5. Redémarrer l\'API sans interruption (zero-downtime)',
  'cd apps/api && pm2 reload ecosystem.config.js',
  '',
  'echo "✓ Déploiement terminé"',
], 'bash — deploy.sh');

codeBlock([
  '# Rendre le script exécutable',
  'chmod +x /home/telepro/app/deploy.sh',
  '',
  '# Utilisation',
  'cd /home/telepro/app && ./deploy.sh',
], 'bash');

sousTitre('Vérifications post-déploiement');
codeBlock([
  '# Statut des processus',
  'pm2 status',
  'pm2 logs telepro-api --lines 30',
  '',
  '# API répond ?',
  'curl -s http://localhost:3001/api/auth/me | jq .   # doit retourner 401',
  '',
  '# Nginx OK ?',
  'sudo nginx -t && sudo systemctl status nginx',
  '',
  '# PostgreSQL OK ?',
  'sudo systemctl status postgresql',
  'psql $DATABASE_URL -c "SELECT COUNT(*) FROM utilisateurs;"',
  '',
  '# Certificat SSL valide ?',
  'curl -sI https://votre-domaine.ci | grep -i "HTTP\\|strict"',
], 'bash — vérifications');

// ═══════════════════════════════════════════════════════════════
// PAGE 7 — SÉCURITÉ ET SAUVEGARDES
// ═══════════════════════════════════════════════════════════════
doc.addPage();
bandeau('5. Sécurité, sauvegardes et surveillance', ROUGE);

sousTitre('Sécurité — Points essentiels');
check('JWT_SECRET généré avec npm run gen-secret (min 64 chars, jamais par défaut)');
check('PostgreSQL accessible uniquement en local (port 5432 fermé en externe)');
check('API port 3001 inaccessible directement — uniquement via Nginx');
check('HTTPS forcé par Certbot (HTTP → 301 redirect)');
check('Mot de passe PostgreSQL fort (min 20 chars, chiffres + majuscules)');
check('Utilisateur Linux non-root pour faire tourner l\'app');
warn('Ne jamais committer le fichier .env dans Git');
warn('Régénérer JWT_SECRET après toute compromission (révoque toutes les sessions)');

separateur();
sousTitre('Sauvegarde automatique PostgreSQL');
codeBlock([
  '# Créer le script de sauvegarde',
  'sudo nano /etc/cron.daily/telepro-backup',
], 'bash');

codeBlock([
  '#!/bin/bash',
  'BACKUP_DIR="/var/backups/telepro"',
  'DATE=$(date +%Y%m%d_%H%M)',
  'DB_URL="postgresql://telepro:MotDePasse!@localhost:5432/telepro_ci"',
  '',
  'mkdir -p $BACKUP_DIR',
  '',
  '# Dump compressé',
  'pg_dump -Fc $DB_URL > $BACKUP_DIR/telepro_$DATE.dump',
  '',
  '# Garder seulement les 14 derniers jours',
  'find $BACKUP_DIR -name "*.dump" -mtime +14 -delete',
  '',
  '# Optionnel : copier vers stockage externe (rclone, S3...)',
  '# rclone copy $BACKUP_DIR remote:backups-telepro',
  '',
  'echo "Backup OK : telepro_$DATE.dump"',
], '/etc/cron.daily/telepro-backup');

codeBlock([
  'sudo chmod +x /etc/cron.daily/telepro-backup',
  '',
  '# Tester manuellement',
  'sudo /etc/cron.daily/telepro-backup',
  'ls -lh /var/backups/telepro/',
  '',
  '# Restaurer une sauvegarde',
  'pg_restore -Fc -d telepro_ci /var/backups/telepro/telepro_YYYYMMDD_HHMM.dump',
], 'bash — activation et test');

separateur();
sousTitre('Surveillance avec PM2 et alertes');
codeBlock([
  '# Voir les logs en temps réel',
  'pm2 logs telepro-api',
  '',
  '# Métriques CPU / mémoire',
  'pm2 monit',
  '',
  '# Activer le monitoring PM2 Plus (gratuit jusqu\'à 4 serveurs)',
  'pm2 link CLE_SECRETE CLE_PUBLIQUE',
  '',
  '# Redémarrage automatique si l\'API plante',
  '# (déjà configuré via max_restarts: 10 dans ecosystem.config.js)',
  '',
  '# Tester la résilience',
  'pm2 kill   # simule un crash',
  'pm2 resurrect  # ou le démarrage auto au reboot relancera',
], 'bash — surveillance');

// ═══════════════════════════════════════════════════════════════
// PAGE 8 — RÉCAPITULATIF
// ═══════════════════════════════════════════════════════════════
doc.addPage();
bandeau('6. Récapitulatif et checklist de mise en production', BLEU);

sousTitre('Checklist Option A — VPS');
const checklistA = [
  'Serveur VPS Ubuntu 22.04 commandé et accessible en SSH',
  'Utilisateur non-root créé, pare-feu UFW activé',
  'Node.js 20, PostgreSQL 16, Nginx, PM2 installés',
  'Base de données telepro_ci créée avec utilisateur dédié',
  'Fichier .env configuré (DATABASE_URL, JWT_SECRET)',
  'npm install && npm run build exécutés sans erreur',
  'Toutes les migrations 001→016 appliquées',
  'PM2 démarré, pm2 startup configuré',
  'Nginx configuré et rechargé',
  'Certificat SSL Let\'s Encrypt actif',
  'DNS du domaine pointé vers l\'IP du VPS',
  'Test login sur https://votre-domaine.ci',
  'Script deploy.sh créé et testé',
  'Sauvegarde cron configurée',
];
checklistA.forEach(t => check(t, false));

separateur();
sousTitre('Tableau récapitulatif des 3 options');
tableau(
  ['Critère', 'Option A — VPS', 'Option B — Cloud', 'Option C — Mixte'],
  [
    ['Coût mensuel',          '4–8 €',       '10–15 $',      '4–8 € + O2switch'],
    ['Admin serveur',         'Requis',       'Aucune',       'Minimal'],
    ['Déploiement initial',   '~3 heures',   '~30 minutes',  '~2 heures'],
    ['Mise à jour code',      './deploy.sh',  'git push',     './deploy.sh'],
    ['Sauvegarde DB',         'Manuel/cron',  'Automatique',  'Manuel/cron'],
    ['SSL/HTTPS',             'Certbot',      'Automatique',  'Certbot (VPS)'],
    ['Scalabilité',           'Limitée VPS',  'Automatique',  'Limitée VPS'],
    ['Idéal pour',            'Contrôle max', 'Simplicité',   'Budget O2switch'],
  ],
  [130, 115, 115, 135]
);

separateur();
sousTitre('Ports et accès réseau en production');
tableau(
  ['Service', 'Port', 'Accessible depuis'],
  [
    ['Nginx HTTPS',   '443',  'Internet (public)'],
    ['Nginx HTTP',    '80',   'Internet → redirect 443'],
    ['API Node.js',   '3001', 'Localhost uniquement (Nginx proxy)'],
    ['PostgreSQL',    '5432', 'Localhost uniquement'],
    ['SSH',           '22',   'Votre IP uniquement (recommandé)'],
  ],
  [130, 80, 285]
);

doc.moveDown(0.6);
encadreNote(
  'Conseil : restreindre SSH à votre IP fixe pour éliminer les attaques par force brute.\n' +
  'sudo ufw delete allow OpenSSH && sudo ufw allow from VOTRE_IP to any port 22',
  BLEU
);

doc.moveDown(0.8);
doc.rect(50, doc.y, 495, 0.5).fill(BORD);
doc.moveDown(0.5);
doc.fontSize(9).fillColor(GRIS).font('Helvetica')
   .text(
     'TéléPro CI — Guide de déploiement · Généré automatiquement · Anthropic Claude Sonnet 4.6',
     { align: 'center' }
   );

doc.end();
doc.on('finish', () => {
  const size = fs.statSync(OUT).size;
  console.log(`PDF généré : rapport-deploiement.pdf (${Math.round(size/1024)} Ko)`);
});
