const PDFDocument = require('pdfkit');
const fs          = require('fs');
const path        = require('path');

const OUT = path.join(__dirname, 'rapport-saas.pdf');
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

// ── Helpers ───────────────────────────────────────────────────────────────
function checkPage(needed = 60) {
  if (doc.y > 750 - needed) doc.addPage();
}

function bandeau(texte, couleur = BLEU) {
  checkPage(40);
  const y = doc.y;
  doc.rect(50, y, 495, 26).fill(couleur);
  doc.fillColor(BLANC).fontSize(12).font('Helvetica-Bold')
     .text(texte, 60, y + 7, { lineBreak: false });
  doc.fillColor(NOIR).font('Helvetica').moveDown(1);
}

function sousTitre(texte, couleur = BLEU) {
  checkPage(30);
  doc.moveDown(0.4)
     .fillColor(couleur).fontSize(11).font('Helvetica-Bold')
     .text(texte)
     .fillColor(NOIR).font('Helvetica').fontSize(10)
     .moveDown(0.3);
}

function para(texte) {
  checkPage(30);
  doc.fontSize(10).font('Helvetica').fillColor(NOIR)
     .text(texte, { width: 490 }).moveDown(0.4);
}

function puce(texte, couleur = NOIR, bold = false) {
  checkPage(15);
  doc.fontSize(10)
     .font(bold ? 'Helvetica-Bold' : 'Helvetica')
     .fillColor(couleur)
     .text(`• ${texte}`, { indent: 12, width: 478 });
}

function info(label, valeur, couleurVal = NOIR) {
  checkPage(14);
  const y = doc.y;
  doc.font('Helvetica-Bold').fontSize(10).fillColor(GRIS)
     .text(label, 60, y, { continued: true, width: 190 });
  doc.font('Helvetica').fillColor(couleurVal).text(valeur);
}

function check(texte, ok = true) {
  checkPage(14);
  const s = ok ? '✓' : '✗';
  const c = ok ? VERT : ROUGE;
  doc.fontSize(10).fillColor(c).font('Helvetica-Bold')
     .text(s, 60, doc.y, { continued: true, width: 18 });
  doc.fillColor(NOIR).font('Helvetica').text(` ${texte}`);
}

function code(texte) {
  checkPage(14);
  doc.fontSize(8.5).font('Courier').fillColor('#1D4ED8')
     .text(texte, { indent: 12, width: 478 });
}

function codeBlock(lignes) {
  const h = lignes.length * 12 + 12;
  checkPage(h + 10);
  const y = doc.y;
  doc.rect(50, y, 495, h).fill('#0F172A');
  let cy = y + 6;
  lignes.forEach(l => {
    // colorisation basique
    const isComment = l.trimStart().startsWith('--') || l.trimStart().startsWith('#');
    const isKeyword = /^(CREATE|ALTER|INSERT|DROP|SELECT|UPDATE|DELETE|SET|EXECUTE|RETURNS|BEGIN|END|IF|THEN|DECLARE|INTO|FROM|WHERE|VALUES|UNIQUE|NOT NULL|DEFAULT|PRIMARY KEY|REFERENCES|LANGUAGE|GENERATED|ALWAYS|AS|RETURN|FUNCTION|FORMAT|PERFORM|TRIGGER|BEFORE|AFTER|ON|FOR|EACH|ROW)/i.test(l.trim());
    const col = isComment ? '#6EE7B7' : isKeyword ? '#93C5FD' : '#E2E8F0';
    doc.fontSize(7.8).font('Courier').fillColor(col)
       .text(l, 58, cy, { lineBreak: false, width: 480 });
    cy += 11.5;
  });
  doc.y = cy + 6;
}

function tableau(headers, rows, colWidths) {
  checkPage(rows.length * 16 + 22);
  const x0 = 50;
  let y = doc.y + 2;

  // header
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
      const vert  = typeof cell === 'string' && (cell.includes('✓') || cell.toLowerCase().includes('oui') || cell.toLowerCase().includes('fort') || cell.toLowerCase().includes('parfaite'));
      const rouge = typeof cell === 'string' && (cell.includes('✗') || cell.toLowerCase().includes('risque') || cell.toLowerCase().includes('faible'));
      const bleu  = typeof cell === 'string' && cell.includes('★');
      const col   = vert ? VERT : rouge ? ROUGE : bleu ? BLEU : NOIR;
      const bold  = vert || rouge || bleu;
      doc.fontSize(8.5).font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(col)
         .text(cell, cx + 4, y + 3, { width: colWidths[ci] - 4, lineBreak: false });
      cx += colWidths[ci];
    });
    y += 15;
  });

  doc.rect(x0, doc.y - (rows.length * 15 + 18), 495, rows.length * 15 + 18).stroke(BORD);
  doc.y = y + 6;
}

function encadre(titre, contenu, couleur = BLEU) {
  checkPage(50);
  const y = doc.y;
  doc.rect(50, y, 495, 14).fill(couleur);
  doc.fillColor(BLANC).fontSize(9).font('Helvetica-Bold')
     .text(titre, 56, y + 3, { lineBreak: false });
  const lignes = contenu.split('\n');
  const h = lignes.length * 12 + 10;
  doc.rect(50, y + 14, 495, h).fill('#F8FAFC').stroke(BORD);
  let cy = y + 18;
  lignes.forEach(l => {
    doc.fontSize(9).font('Courier').fillColor(NOIR)
       .text(l, 58, cy, { lineBreak: false, width: 480 });
    cy += 12;
  });
  doc.y = cy + 6;
}

// ═══════════════════════════════════════════════════════════════
// PAGE 1 — COUVERTURE
// ═══════════════════════════════════════════════════════════════
doc.rect(0, 0, 595, 210).fill(BLEU);
doc.rect(0, 210, 595, 8).fill(VIOLET);

doc.fillColor(BLANC).fontSize(28).font('Helvetica-Bold')
   .text('TéléPro CI', 50, 55, { align: 'center' });
doc.fontSize(17).font('Helvetica')
   .text('Déploiement SaaS — Plan de migration', { align: 'center' });
doc.fontSize(11).fillColor('#BFDBFE')
   .text('Architecture multi-tenant · PostgreSQL Schema-per-tenant · Avril 2026', { align: 'center' });

doc.y = 240;

// Bloc résumé
doc.rect(50, 240, 495, 110).fill(GRIS_CL).stroke(BORD);
doc.fillColor(NOIR).fontSize(12).font('Helvetica-Bold').text('En bref', 68, 254);
doc.fontSize(10).font('Helvetica').fillColor(GRIS)
   .text(
     'Cette note détaille les migrations PostgreSQL et les adaptations API nécessaires\n' +
     'pour transformer TéléPro CI en application SaaS multi-tenant. L\'approche retenue\n' +
     'est le schema-per-tenant : chaque client possède son propre schéma PostgreSQL isolé.\n' +
     'Le code métier existant reste inchangé — seul un middleware de routage est ajouté.',
     68, 272, { width: 460 }
   );

doc.y = 370;
doc.fillColor(GRIS).fontSize(9).font('Helvetica')
   .text('Généré le ' + new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }), { align: 'right' });

// ═══════════════════════════════════════════════════════════════
// PAGE 2 — COMPARAISON DES APPROCHES
// ═══════════════════════════════════════════════════════════════
doc.addPage();
bandeau('1. Comparaison des approches multi-tenant');

para(
  'Trois architectures sont possibles pour un SaaS PostgreSQL. Le tableau suivant ' +
  'les compare selon les critères clés pour TéléPro CI (marché Afrique de l\'Ouest, ' +
  'PME, volumes modérés, exigences RGPD strictes).'
);

tableau(
  ['Critère', 'tenant_id partout', '★ Schema/tenant', 'Base/tenant'],
  [
    ['Isolation des données',      'Faible — risque oubli',  '★ Forte — garantie DB',  'Maximale'],
    ['Modifications du code',      '+ 30 colonnes + RLS',    '★ Middleware seul',      'Aucune'],
    ['Migrations par client',      'Une fois globale',       'Runner par tenant',       'Séquence complète'],
    ['Backup par client',          'Difficile',              '★ pg_dump -n schema',    'pg_dump complet'],
    ['Nb tenants supporté',        'Illimité',               '★ < 5 000',              '< 200'],
    ['Risque de fuite de données', 'Élevé (oubli WHERE)',    '★ Quasi nul',            'Nul'],
    ['Coût infrastructure',        'Minimal',                '★ Minimal',              'Élevé'],
    ['Complexité opérationnelle',  'Faible',                 'Modérée',                'Forte'],
  ],
  [160, 110, 115, 110]
);

doc.moveDown(0.4);
para(
  '★ Approche retenue : Schema-per-tenant. Chaque client obtient un schéma nommé ' +
  't_{slug} (ex. t_acme, t_boutique_koua). Les tables métier existantes y sont ' +
  'recopiées ; le code API ne change pas — un middleware fixe SET search_path = t_{slug}, public ' +
  'avant chaque requête.'
);

sousTitre('Pourquoi pas tenant_id partout ?');
puce('30+ ALTER TABLE + 30+ politiques Row Level Security à maintenir');
puce('Un oubli de WHERE tenant_id=X expose les données de tous les clients');
puce('Les référentiels (types_clients, statuts_paiements…) se mélangent entre tenants');
puce('Impossible de faire un pg_dump propre par client pour la conformité RGPD');

// ═══════════════════════════════════════════════════════════════
// PAGE 3 — FICHIERS DE MIGRATION
// ═══════════════════════════════════════════════════════════════
doc.addPage();
bandeau('2. Fichiers de migration à créer', VIOLET);

sousTitre('Vue d\'ensemble');
tableau(
  ['Fichier', 'Appliqué', 'Contenu'],
  [
    ['100_saas_tenants.sql',          '1 fois (serveur)',    'Tables tenants, plans, invitations'],
    ['101_saas_provision.sql',        '1 fois (serveur)',    'Fonction provision_tenant()'],
    ['102_tenant_schema_template.sql','Par nouveau client',  'Toutes les tables métier dans t_{slug}'],
    ['103_saas_super_admin.sql',      '1 fois (serveur)',    'Compte super-admin global'],
  ],
  [200, 130, 165]
);

sousTitre('Migration 100 — Tables globales (schéma public)');
codeBlock([
  '-- 100_saas_tenants.sql',
  '',
  'CREATE TABLE public.tenants (',
  '  id            SERIAL PRIMARY KEY,',
  '  slug          VARCHAR(50) UNIQUE NOT NULL,  -- ex: acme → acme.telepro.ci',
  '  nom           VARCHAR(255) NOT NULL,',
  '  email_admin   VARCHAR(255) NOT NULL,',
  '  plan          VARCHAR(20)  NOT NULL DEFAULT \'starter\'',
  '                CHECK (plan IN (\'starter\',\'pro\',\'enterprise\')),',
  '  statut        VARCHAR(20)  NOT NULL DEFAULT \'trial\'',
  '                CHECK (statut IN (\'trial\',\'actif\',\'suspendu\',\'resilié\')),',
  '  trial_ends_at TIMESTAMPTZ  DEFAULT NOW() + INTERVAL \'14 days\',',
  '  schema_name   VARCHAR(63)  GENERATED ALWAYS AS (\'t_\' || slug) STORED,',
  '  created_at    TIMESTAMPTZ  DEFAULT NOW()',
  ');',
  '',
  'CREATE TABLE public.plans (',
  '  code              VARCHAR(20) PRIMARY KEY,',
  '  label             VARCHAR(100),',
  '  max_magasins      INT DEFAULT 1,',
  '  max_utilisateurs  INT DEFAULT 5,',
  '  max_produits      INT DEFAULT 500,',
  '  prix_mensuel      NUMERIC(10,0),   -- FCFA',
  '  fonctionnalites   JSONB DEFAULT \'{}\'',
  ');',
  '',
  'INSERT INTO public.plans VALUES',
  '  (\'starter\',    \'Starter\',     1,  5,   500, 15000, \'{"sms":false}\'),',
  '  (\'pro\',        \'Pro\',         3,  20,  5000, 45000, \'{"sms":true,"rapports":true}\'),',
  '  (\'enterprise\', \'Enterprise\', 99, 999, 99999, null,  \'{"sms":true,"api":true}\');',
  '',
  'CREATE TABLE public.invitations (',
  '  id         SERIAL PRIMARY KEY,',
  '  tenant_id  INT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,',
  '  email      VARCHAR(255) NOT NULL,',
  '  token      VARCHAR(100) UNIQUE NOT NULL',
  '             DEFAULT encode(gen_random_bytes(32),\'hex\'),',
  '  role_code  VARCHAR(50) NOT NULL DEFAULT \'commercial\',',
  '  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL \'72 hours\',',
  '  used_at    TIMESTAMPTZ,',
  '  created_at TIMESTAMPTZ DEFAULT NOW()',
  ');',
]);

// ═══════════════════════════════════════════════════════════════
// PAGE 4 — MIGRATION 101
// ═══════════════════════════════════════════════════════════════
doc.addPage();
bandeau('2. Fichiers de migration (suite)', VIOLET);

sousTitre('Migration 101 — Fonction de provisioning');
codeBlock([
  '-- 101_saas_provision.sql',
  '',
  'CREATE OR REPLACE FUNCTION public.provision_tenant(',
  '  p_slug         TEXT,',
  '  p_nom          TEXT,',
  '  p_email_admin  TEXT,',
  '  p_plan         TEXT DEFAULT \'starter\'',
  ') RETURNS INT AS $$',
  'DECLARE',
  '  v_tenant_id INT;',
  '  v_schema    TEXT;',
  'BEGIN',
  '  -- 1. Valider le slug (alphanumérique + tirets)',
  '  IF p_slug !~ \'^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$\' THEN',
  '    RAISE EXCEPTION \'Slug invalide : %\', p_slug;',
  '  END IF;',
  '',
  '  -- 2. Créer la ligne tenant',
  '  INSERT INTO public.tenants (slug, nom, email_admin, plan)',
  '  VALUES (p_slug, p_nom, p_email_admin, p_plan)',
  '  RETURNING id INTO v_tenant_id;',
  '',
  '  v_schema := \'t_\' || p_slug;',
  '',
  '  -- 3. Créer le schéma PostgreSQL isolé',
  '  EXECUTE format(\'CREATE SCHEMA %I\', v_schema);',
  '',
  '  -- 4. Le runner Node.js applique 102_tenant_schema_template.sql',
  '  --    avec SET search_path = {schema}, public',
  '',
  '  RETURN v_tenant_id;',
  'END;',
  '$$ LANGUAGE plpgsql;',
  '',
  '-- Fonction inverse : supprimer un tenant et toutes ses données',
  'CREATE OR REPLACE FUNCTION public.deprovision_tenant(p_slug TEXT)',
  'RETURNS VOID AS $$',
  'DECLARE v_schema TEXT := \'t_\' || p_slug;',
  'BEGIN',
  '  EXECUTE format(\'DROP SCHEMA %I CASCADE\', v_schema);',
  '  DELETE FROM public.tenants WHERE slug = p_slug;',
  'END;',
  '$$ LANGUAGE plpgsql;',
]);

sousTitre('Migration 102 — Template schéma tenant (extrait)');
codeBlock([
  '-- 102_tenant_schema_template.sql',
  '-- Exécuté avec : SET search_path = t_{slug}, public',
  '',
  '-- Toutes les tables de 001→016 sans les données seed de demo',
  'CREATE TABLE magasins ( id SERIAL PRIMARY KEY, code VARCHAR(20) UNIQUE, ... );',
  'CREATE TABLE roles    ( id SERIAL PRIMARY KEY, code VARCHAR(50), permissions JSONB, ... );',
  'CREATE TABLE utilisateurs ( id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE, ... );',
  'CREATE TABLE sessions ( id SERIAL PRIMARY KEY, user_id INT REFERENCES utilisateurs(id), ... );',
  'CREATE TABLE produits ( ... );',
  'CREATE TABLE stocks   ( produit_id INT, magasin_id INT, PRIMARY KEY(produit_id, magasin_id), ... );',
  '-- ... toutes les tables existantes ...',
  '',
  '-- Données initiales par défaut (pas de données de démo)',
  'INSERT INTO roles (code, libelle, permissions) VALUES',
  '  (\'admin\',      \'Administrateur\', \'{"all":true}\'),',
  '  (\'commercial\', \'Commercial\',     \'{"ventes":true,"clients":true}\'),',
  '  (\'caissier\',   \'Caissier\',       \'{"paiements":true}\'),',
  '  (\'comptable\',  \'Comptable\',      \'{"rapports":true}\'),',
  '  (\'magasinier\', \'Magasinier\',     \'{"stock":true}\');',
  '',
  'INSERT INTO magasins (code, nom, actif) VALUES (\'MG-001\', \'Magasin Principal\', TRUE);',
  '',
  'INSERT INTO moyens_paiement (code, libelle, actif) VALUES',
  '  (\'ESPECES\',     \'Espèces\',       TRUE),',
  '  (\'WAVE\',        \'Wave\',          TRUE),',
  '  (\'MTNMOMO\',     \'MTN MoMo\',      TRUE),',
  '  (\'ORANGEMONEY\', \'Orange Money\',  TRUE),',
  '  (\'VIREMENT\',    \'Virement\',      TRUE);',
  '',
  'INSERT INTO societe_parametres (nom, email, pays, devise, tva_defaut)',
  'VALUES (:tenant_nom, :tenant_email, \'Côte d\'\'Ivoire\', \'XOF\', 18.00);',
  '',
  '-- Triggers identiques à 008_paiements_trigger.sql',
  'CREATE TRIGGER trg_paiements_sync_ventes AFTER INSERT OR UPDATE OR DELETE ON paiements ...',
]);

// ═══════════════════════════════════════════════════════════════
// PAGE 5 — MODIFICATIONS API
// ═══════════════════════════════════════════════════════════════
doc.addPage();
bandeau('3. Modifications côté API', VERT);

sousTitre('Middleware tenant.ts — résolution par sous-domaine');
codeBlock([
  '// src/middleware/tenant.ts',
  '',
  'export async function resolveTenant(req, res, next) {',
  '  // acme.telepro.ci  →  slug = "acme"',
  '  const slug   = req.hostname.split(\'.\')[0];',
  '  const schema = `t_${slug}`;',
  '',
  '  const { rows } = await pool.query(',
  '    `SELECT id, statut, plan FROM public.tenants WHERE slug=$1`, [slug]',
  '  );',
  '  if (!rows.length)             return fail(res, \'Entreprise inconnue\', 404);',
  '  if (rows[0].statut===\'suspendu\') return fail(res, \'Compte suspendu\', 402);',
  '  if (rows[0].statut===\'resilié\') return fail(res, \'Abonnement résilié\', 402);',
  '',
  '  // Fixer le search_path pour toute la durée de la requête',
  '  await pool.query(`SET LOCAL search_path = ${schema}, public`);',
  '',
  '  req.tenant = { id: rows[0].id, slug, schema, plan: rows[0].plan };',
  '  next();',
  '}',
]);

sousTitre('Position dans la chaîne Express');
codeBlock([
  '// src/index.ts',
  '',
  'app.use(cors());',
  'app.use(express.json());',
  'app.use(resolveTenant);   // ← insérer ICI, avant toutes les routes',
  'app.use(\'/api/auth\',    authRouter);',
  'app.use(\'/api\',         requireAuth, mainRouter);',
]);

sousTitre('JWT étendu avec tenant_id');
codeBlock([
  '// src/routes/auth.ts — login',
  '',
  'const payload = {',
  '  sub,',
  '  email, nom, prenom,',
  '  role:        user.role_code,',
  '  perms:       user.permissions,',
  '  magasin_ids: user.magasin_ids,',
  '  tenant_id:   req.tenant.id,     // ← nouveau',
  '  tenant_slug: req.tenant.slug,   // ← nouveau',
  '};',
]);

sousTitre('Nouvelles routes à créer');
tableau(
  ['Méthode + Route', 'Auth', 'Description'],
  [
    ['POST /api/tenants/register',      'Public',       'Inscription client → provision_tenant()'],
    ['GET  /api/tenants/me',            'JWT tenant',   'Infos abonnement du client courant'],
    ['PUT  /api/tenants/me',            'Admin tenant', 'Modifier nom / email société'],
    ['POST /api/tenants/invite',        'Admin tenant', 'Envoyer une invitation par email'],
    ['POST /api/auth/accept-invite',    'Token email',  'Créer son compte via invitation'],
    ['GET  /api/super/tenants',         'Super-admin',  'Liste tous les tenants'],
    ['PUT  /api/super/tenants/:id',     'Super-admin',  'Changer plan, suspendre'],
    ['DELETE /api/super/tenants/:id',   'Super-admin',  'deprovision_tenant() + suppression'],
  ],
  [195, 90, 210]
);

sousTitre('Runner de provisioning Node.js');
codeBlock([
  '// src/services/provisionTenant.ts',
  '',
  'export async function provisionTenant({ slug, nom, email, plan, passwordHash }) {',
  '  const client = await pool.connect();',
  '  try {',
  '    await client.query(\'BEGIN\');',
  '',
  '    // 1. Appeler la fonction SQL (crée le schéma)',
  '    const { rows } = await client.query(',
  '      `SELECT public.provision_tenant($1,$2,$3,$4) AS tenant_id`,',
  '      [slug, nom, email, plan]',
  '    );',
  '    const tenantId = rows[0].tenant_id;',
  '',
  '    // 2. SET search_path sur le nouveau schéma',
  '    await client.query(`SET search_path = t_${slug}, public`);',
  '',
  '    // 3. Appliquer le template de schéma',
  '    const sql = fs.readFileSync(\'migrations/102_tenant_schema_template.sql\', \'utf8\');',
  '    await client.query(sql);',
  '',
  '    // 4. Créer le compte admin du tenant',
  '    await client.query(',
  '      `INSERT INTO utilisateurs (code, nom, prenom, email, password_hash, role_id, actif)',
  '       VALUES (\'ADM-001\', $1, \'\', $2, $3,',
  '               (SELECT id FROM roles WHERE code=\'admin\'), TRUE)`,',
  '      [nom, email, passwordHash]',
  '    );',
  '',
  '    await client.query(\'COMMIT\');',
  '    return tenantId;',
  '  } catch (e) {',
  '    await client.query(\'ROLLBACK\');',
  '    throw e;',
  '  } finally {',
  '    client.release();',
  '  }',
  '}',
]);

// ═══════════════════════════════════════════════════════════════
// PAGE 6 — INFRASTRUCTURE
// ═══════════════════════════════════════════════════════════════
doc.addPage();
bandeau('4. Infrastructure & déploiement', ORANGE);

sousTitre('Nginx — routing wildcard sous-domaine');
codeBlock([
  '# /etc/nginx/sites-enabled/telepro-saas.conf',
  '',
  'server {',
  '    listen 443 ssl;',
  '    server_name *.telepro.ci;',
  '',
  '    ssl_certificate     /etc/letsencrypt/live/telepro.ci/fullchain.pem;',
  '    ssl_certificate_key /etc/letsencrypt/live/telepro.ci/privkey.pem;',
  '',
  '    location /api/ {',
  '        proxy_pass         http://localhost:3001;',
  '        proxy_set_header   Host $host;          # transmet acme.telepro.ci',
  '        proxy_set_header   X-Real-IP $remote_addr;',
  '    }',
  '',
  '    location / {',
  '        proxy_pass         http://localhost:3000;',
  '        proxy_set_header   Host $host;',
  '    }',
  '}',
  '',
  '# Certificat wildcard Let\'s Encrypt',
  '# certbot certonly --dns-infomaniak -d telepro.ci -d *.telepro.ci',
]);

sousTitre('Tableau des composants infrastructure');
tableau(
  ['Composant', 'Outil', 'Rôle'],
  [
    ['Reverse proxy',     'Nginx',                     'Routing *.telepro.ci → API/Web'],
    ['TLS wildcard',      'Let\'s Encrypt + DNS plugin','Certificat *.telepro.ci automatique'],
    ['Pool connexions',   'pg-pool (existant)',         'search_path par requête (SET LOCAL)'],
    ['Email transac.',    'Resend ou Mailgun',          'Invitations, bienvenue, factures'],
    ['Billing',           'Stripe ou paiement mobile',  'Abonnements, renouvellements FCFA'],
    ['Backup tenants',    'pg_dump -n t_{slug} + cron', 'Isolation RGPD par client'],
    ['Monitoring',        'Grafana + Loki',             'Métriques par tenant (slug en label)'],
    ['CI/CD migration',   'Script Node provisionTenant','Onboarding automatisé sans downtime'],
  ],
  [130, 155, 210]
);

sousTitre('Docker Compose (ajouts)');
codeBlock([
  '# docker-compose.yml — services supplémentaires',
  '',
  'services:',
  '  postgres:',
  '    image: postgres:16',
  '    environment:',
  '      POSTGRES_DB: telepro_saas    # base unique, schémas multiples',
  '',
  '  api:',
  '    environment:',
  '      DATABASE_URL: postgresql://user:pass@postgres:5432/telepro_saas',
  '      SUPER_ADMIN_KEY: ${SUPER_ADMIN_KEY}   # clé pour les routes /super/*',
  '',
  '  # Nouveau : service d\'onboarding (optionnel, peut être dans l\'API)',
  '  onboarding:',
  '    build: ./apps/onboarding',
  '    ports: [\'3002:3002\']',
  '    environment:',
  '      DATABASE_URL: ${DATABASE_URL}',
  '      MAIL_FROM: noreply@telepro.ci',
]);

// ═══════════════════════════════════════════════════════════════
// PAGE 7 — GESTION DES PLANS & QUOTAS
// ═══════════════════════════════════════════════════════════════
doc.addPage();
bandeau('5. Plans d\'abonnement et quotas', VIOLET);

sousTitre('Tableau des plans');
tableau(
  ['', 'Starter', 'Pro', 'Enterprise'],
  [
    ['Prix/mois (FCFA)',         '15 000',  '45 000',  'Sur devis'],
    ['Magasins',                 '1',       '3',       'Illimité'],
    ['Utilisateurs',             '5',       '20',      'Illimité'],
    ['Produits catalogue',       '500',     '5 000',   'Illimité'],
    ['SMS / WhatsApp',           '✗',       '✓',       '✓'],
    ['Rapports avancés',         '✗',       '✓',       '✓'],
    ['Export PDF',               '✓',       '✓',       '✓'],
    ['API REST accès direct',    '✗',       '✗',       '✓'],
    ['SLA support',              'Email',   '24h',     '4h'],
    ['Backup quotidien',         '✓',       '✓',       '✓ + restore'],
  ],
  [160, 100, 100, 135]
);

sousTitre('Middleware de vérification des quotas');
codeBlock([
  '// src/middleware/quotas.ts',
  '',
  'export function checkQuota(ressource: string) {',
  '  return async (req, res, next) => {',
  '    const plan = await getPlanLimits(req.tenant.plan);',
  '',
  '    if (ressource === \'magasins\') {',
  '      const { rows } = await pool.query(`SELECT COUNT(*) n FROM magasins WHERE actif`);',
  '      if (Number(rows[0].n) >= plan.max_magasins)',
  '        return fail(res, `Limite atteinte (${plan.max_magasins} magasins sur plan ${req.tenant.plan})`, 402);',
  '    }',
  '',
  '    if (ressource === \'utilisateurs\') {',
  '      const { rows } = await pool.query(`SELECT COUNT(*) n FROM utilisateurs WHERE actif`);',
  '      if (Number(rows[0].n) >= plan.max_utilisateurs)',
  '        return fail(res, `Limite utilisateurs atteinte`, 402);',
  '    }',
  '',
  '    next();',
  '  };',
  '}',
  '',
  '// Usage dans les routes :',
  'router.post(\'/magasins\', requireAdmin, checkQuota(\'magasins\'), wrap(creerMagasin));',
  'router.post(\'/admin/utilisateurs\', requireAdmin, checkQuota(\'utilisateurs\'), wrap(creerUtilisateur));',
]);

// ═══════════════════════════════════════════════════════════════
// PAGE 8 — PLAN DE MIGRATION PROGRESSIF
// ═══════════════════════════════════════════════════════════════
doc.addPage();
bandeau('6. Plan de migration progressif', VERT);

para(
  'La migration peut se faire sans interruption de service pour le client existant. ' +
  'Le client actuel (instance mono-tenant) devient le premier tenant du SaaS.'
);

sousTitre('Phase 1 — Préparation (semaine 1)');
puce('Créer les migrations 100 et 101 (tables globales + fonction provision)');
puce('Écrire le template 102 à partir des migrations existantes 001→016');
puce('Mettre en place le runner provisionTenant() dans les services API');
puce('Configurer le certificat wildcard Let\'s Encrypt (*.telepro.ci)');
puce('Tester en local avec deux sous-domaines : demo.localhost et client1.localhost');

sousTitre('Phase 2 — Migration du client existant (semaine 2)');
puce('Provisionner le schéma t_telepro pour le client actuel');
puce('Migrer les données existantes : INSERT INTO t_telepro.ventes SELECT * FROM public.ventes');
puce('Vérifier les vues, triggers et séquences dans le nouveau schéma');
puce('Basculer le sous-domaine principal : telepro.telepro.ci (ou main.telepro.ci)');
puce('Conserver public.* en read-only pendant 2 semaines (rollback possible)');

sousTitre('Phase 3 — Ouverture SaaS (semaine 3-4)');
puce('Activer la route POST /api/tenants/register avec le formulaire d\'inscription');
puce('Mettre en place l\'envoi d\'emails de bienvenue (Resend / Mailgun)');
puce('Intégrer la page de pricing sur le site marketing');
puce('Tester le flow complet : inscription → onboarding → premier login');
puce('Mettre en place les alertes de monitoring (Grafana par tenant)');

sousTitre('Phase 4 — Billing (semaine 5-6)');
puce('Intégrer Stripe ou paiement Wave/MTN MoMo pour les abonnements');
puce('Automatiser la suspension après échec de paiement (statut = suspendu)');
puce('Mettre en place les rappels email J-7, J-3, J-0 avant expiration');
puce('Activer les quotas par plan (checkQuota middleware)');

sousTitre('Tableau de suivi de migration');
tableau(
  ['Tâche', 'Complexité', 'Impact code existant', 'Semaine'],
  [
    ['Tables globales (100, 101)',      'Faible',   'Aucun',          'S1'],
    ['Template schéma (102)',           'Moyenne',  'Aucun',          'S1'],
    ['Middleware resolveTenant',        'Faible',   'src/index.ts',   'S1'],
    ['JWT étendu tenant_id',           'Faible',   'src/routes/auth','S2'],
    ['Cert wildcard + Nginx',           'Faible',   'Infra seule',    'S1'],
    ['Migration données existantes',   'Moyenne',  'Script one-shot', 'S2'],
    ['Routes /tenants/* + /super/*',   'Moyenne',  'Nouvelles routes','S3'],
    ['Quotas par plan',                'Faible',   '+1 middleware',   'S3'],
    ['Billing Stripe/mobile',          'Forte',    'Nouveau service', 'S5'],
  ],
  [190, 80, 130, 95]
);

// ═══════════════════════════════════════════════════════════════
// PAGE 9 — SÉCURITÉ & RGPD
// ═══════════════════════════════════════════════════════════════
doc.addPage();
bandeau('7. Sécurité et conformité RGPD', ROUGE);

sousTitre('Isolation garantie par PostgreSQL');
para(
  'L\'isolation search_path est une garantie au niveau du moteur de base de données. ' +
  'Une requête exécutée dans le contexte t_acme ne peut physiquement pas lire les ' +
  'tables du schéma t_autre_client sans permission explicite. ' +
  'Le super-user PostgreSQL conserve un accès global pour la maintenance.'
);

puce('SET LOCAL search_path : l\'isolation est annulée automatiquement en fin de transaction');
puce('Aucune FK cross-schéma : impossible de joindre accidentellement deux tenants');
puce('Séquences indépendantes : les IDs recommencent à 1 par tenant (pas de fuite d\'info)');

sousTitre('Droit à l\'effacement (Art. 17 RGPD)');
codeBlock([
  '-- Suppression complète d\'un tenant et de toutes ses données',
  'SELECT public.deprovision_tenant(\'acme\');',
  '-- → DROP SCHEMA t_acme CASCADE (toutes les tables + données)',
  '-- → DELETE FROM public.tenants WHERE slug=\'acme\'',
  '-- → DELETE FROM public.invitations WHERE tenant_id=...',
  '-- Durée estimée : < 5 secondes pour 500 000 lignes',
]);

sousTitre('Portabilité des données (Art. 20 RGPD)');
codeBlock([
  '# Export des données d\'un tenant en SQL',
  'pg_dump -n t_acme -Fc telepro_saas > acme_backup_2026.dump',
  '',
  '# Restauration chez un autre hébergeur',
  'pg_restore -n t_acme -d nouvelle_base acme_backup_2026.dump',
]);

sousTitre('Sécurité supplémentaire recommandée');
[
  ['Chiffrement at-rest',    'PostgreSQL pgcrypto pour colonnes sensibles (RCCM, IBAN)'],
  ['Audit cross-tenant',     'Table public.audit_global (slug, action, ip, timestamp)'],
  ['Rate limiting',          'nginx limit_req_zone $http_host (par sous-domaine)'],
  ['Monitoring anomalies',   'Alerte si un token accède à un schema_name ≠ tenant JWT'],
  ['Rotation JWT secrets',   'Secret JWT par tenant (permet révocation ciblée)'],
].forEach(([k, v]) => info(k, v, NOIR));

// ═══════════════════════════════════════════════════════════════
// PAGE 10 — BILAN
// ═══════════════════════════════════════════════════════════════
doc.addPage();
bandeau('8. Bilan et récapitulatif', BLEU);

sousTitre('Ce qui change dans le code actuel');
check('src/index.ts : ajout de app.use(resolveTenant)', true);
check('src/routes/auth.ts : tenant_id dans le JWT', true);
check('src/middleware/auth.ts : vérification tenant_id dans requireAuth', true);
check('Toutes les routes métier (ventes, stock…) : AUCUN changement', true);
check('Migrations 001→016 : AUCUN changement (réutilisées dans le template)', true);
check('Frontend React : ajout du sous-domaine dans axios baseURL', true);

doc.moveDown(0.5);
sousTitre('Ce qui est entièrement nouveau');
puce('3 fichiers SQL de migration (100, 101, 102)');
puce('Middleware resolveTenant (environ 25 lignes)');
puce('Service provisionTenant (environ 50 lignes)');
puce('Routes /api/tenants/* et /api/super/* (environ 100 lignes)');
puce('Middleware checkQuota (environ 40 lignes)');
puce('Configuration Nginx wildcard + certificat Let\'s Encrypt');

doc.moveDown(0.5);
sousTitre('Estimation effort');
tableau(
  ['Tâche', 'Jours développeur'],
  [
    ['Migrations SQL (100, 101, 102)',             '2 j'],
    ['Middleware + routes API',                     '3 j'],
    ['Runner provisionTenant + tests',              '2 j'],
    ['Infra Nginx + TLS wildcard',                  '1 j'],
    ['Migration données client existant',           '1 j'],
    ['Billing (Stripe ou Wave/MTN)',                '4 j'],
    ['Tests end-to-end onboarding',                 '2 j'],
    ['Total estimé (hors billing)',                 '9 j'],
    ['Total estimé (avec billing)',                 '13 j'],
  ],
  [370, 125]
);

doc.moveDown(0.5);
para(
  'L\'architecture schema-per-tenant est la solution la plus adaptée à TéléPro CI : ' +
  'elle offre une isolation parfaite, ne demande pas de modifier le code métier existant, ' +
  'et reste économique (une seule instance PostgreSQL pour tous les tenants). ' +
  'Le chemin critique est la mise en place du wildcard TLS et du runner de provisioning ' +
  '— le reste est incrémental et peut être livré en plusieurs sprints.'
);

doc.moveDown(0.8);
doc.rect(50, doc.y, 495, 1).fill(BORD);
doc.moveDown(0.5);
doc.fontSize(9).fillColor(GRIS).font('Helvetica')
   .text('TéléPro CI SaaS — Document généré automatiquement · Anthropic Claude Sonnet 4.6', { align: 'center' });

doc.end();
doc.on('finish', () => console.log('PDF généré : rapport-saas.pdf'));
