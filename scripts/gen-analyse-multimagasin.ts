import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

const OUT = path.join(process.cwd(), 'analyse-multi-magasin.pdf');
const doc = new PDFDocument({ margin: 50, size: 'A4' });
doc.pipe(fs.createWriteStream(OUT));

// ─── Helpers ────────────────────────────────────────────────────────────────

const BLUE   = '#1D4ED8';
const DARK   = '#111827';
const GRAY   = '#6B7280';
const LIGHT  = '#F3F4F6';
const RED    = '#DC2626';
const GREEN  = '#15803D';
const ORANGE = '#D97706';

function h1(text: string) {
  doc.moveDown(0.5)
     .fontSize(18).fillColor(BLUE).font('Helvetica-Bold').text(text)
     .moveDown(0.3)
     .moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(BLUE).lineWidth(1.5).stroke()
     .moveDown(0.5);
  doc.fillColor(DARK).font('Helvetica').fontSize(10);
}

function h2(text: string) {
  doc.moveDown(0.6)
     .fontSize(13).fillColor(DARK).font('Helvetica-Bold').text(text)
     .moveDown(0.2);
  doc.font('Helvetica').fontSize(10);
}

function h3(text: string) {
  doc.moveDown(0.4)
     .fontSize(11).fillColor(BLUE).font('Helvetica-Bold').text(text)
     .moveDown(0.1);
  doc.fillColor(DARK).font('Helvetica').fontSize(10);
}

function para(text: string) {
  doc.fontSize(10).fillColor(DARK).font('Helvetica').text(text, { align: 'justify' }).moveDown(0.3);
}

function bullet(items: string[], color = DARK) {
  for (const item of items) {
    doc.fontSize(10).fillColor(color).font('Helvetica')
       .text(`• ${item}`, { indent: 15 }).moveDown(0.15);
  }
  doc.moveDown(0.2);
}

function badge(label: string, color: string) {
  const x = doc.x;
  const y = doc.y;
  const w = doc.widthOfString(label) + 12;
  doc.roundedRect(x, y, w, 14, 3).fillColor(color).fill();
  doc.fontSize(8).fillColor('white').font('Helvetica-Bold')
     .text(label, x + 6, y + 3, { lineBreak: false });
  doc.x = x + w + 6;
  doc.fillColor(DARK).font('Helvetica').fontSize(10);
}

function codeBlock(lines: string[]) {
  const blockHeight = lines.length * 13 + 12;
  doc.rect(50, doc.y, 495, blockHeight).fillColor('#1E293B').fill();
  const startY = doc.y + 6;
  lines.forEach((line, i) => {
    doc.fontSize(8).fillColor('#94A3B8').font('Courier')
       .text(line, 60, startY + i * 13, { lineBreak: false });
  });
  doc.y = startY + lines.length * 13 + 6;
  doc.x = 50;
  doc.moveDown(0.4);
  doc.fillColor(DARK).font('Helvetica').fontSize(10);
}

function tableRow(col1: string, col2: string, col3: string, isHeader = false) {
  const font   = isHeader ? 'Helvetica-Bold' : 'Helvetica';
  const fill   = isHeader ? BLUE : DARK;
  const bgFill = isHeader ? BLUE : null;
  const y = doc.y;
  if (bgFill) {
    doc.rect(50, y, 495, 18).fillColor(bgFill).fill();
    doc.fillColor('white');
  }
  doc.fontSize(9).font(font).fillColor(isHeader ? 'white' : fill)
     .text(col1, 55,  y + 4, { width: 160, lineBreak: false })
     .text(col2, 220, y + 4, { width: 120, lineBreak: false })
     .text(col3, 345, y + 4, { width: 195, lineBreak: false });
  doc.y = y + 20;
  doc.x = 50;
  if (!isHeader) {
    doc.moveTo(50, doc.y - 2).lineTo(545, doc.y - 2).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
  }
  doc.fillColor(DARK).font('Helvetica').fontSize(10);
}

function newPage() {
  doc.addPage();
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGE DE GARDE
// ══════════════════════════════════════════════════════════════════════════════

doc.rect(0, 0, 595, 200).fillColor(BLUE).fill();
doc.fontSize(28).fillColor('white').font('Helvetica-Bold')
   .text('StoreBox', 50, 60);
doc.fontSize(18).fillColor('#BFDBFE').font('Helvetica')
   .text('Analyse — Gestion Multi-Magasin', 50, 100);
doc.fontSize(10).fillColor('#93C5FD')
   .text('Document d\'analyse technique et fonctionnelle', 50, 130);
doc.fillColor('white').font('Helvetica-Bold').fontSize(10)
   .text('Avril 2026', 50, 160);

doc.y = 220;
doc.fillColor(DARK).font('Helvetica').fontSize(10);

para(
  'Ce document analyse les impacts techniques et fonctionnels de l\'ajout de la gestion ' +
  'multi-magasin dans l\'application StoreBox. Il couvre les modifications de schéma, ' +
  'les changements d\'API, les évolutions frontend et la stratégie de migration recommandée.'
);

// ── Résumé exécutif
h1('Résumé exécutif');

para(
  'La gestion multi-magasin est une extension structurelle qui touche l\'ensemble des ' +
  'couches de l\'application. Le périmètre principal est la notion de stock par magasin ' +
  '(remplacement de produits.stock par une table de liaison) et le filtrage automatique ' +
  'de toutes les données selon le magasin de l\'utilisateur connecté.'
);

h2('Effort estimé par domaine');
tableRow('Domaine', 'Complexité', 'Raison principale', true);
tableRow('Schéma DB',            '⚠ Élevée',   'Stock par magasin = réécriture table produits');
tableRow('API — routes/index.ts','⚠ Élevée',   '~40 queries à filtrer + transactions stock');
tableRow('API — routes/ventes.ts','◈ Moyenne', 'Triggers + INSERT stock à adapter');
tableRow('Auth / JWT',           '◈ Moyenne',  'magasin_id dans payload + middleware');
tableRow('Frontend',             '◇ Faible',   'Sélecteur magasin + filtres UI');
tableRow('Rapports',             '◈ Moyenne',  'Vue par magasin + vue consolidée');
tableRow('Migration données',    '⚠ Élevée',   'Backfill stock existant sur un magasin');
doc.moveDown(0.5);

// ══════════════════════════════════════════════════════════════════════════════
// PAGE 2 — SCHÉMA DB
// ══════════════════════════════════════════════════════════════════════════════
newPage();
h1('1 · Modifications du schéma PostgreSQL');

h2('1.1 Nouvelle table magasins');
codeBlock([
  'CREATE TABLE magasins (',
  '  id          SERIAL PRIMARY KEY,',
  '  code        VARCHAR(20)  UNIQUE NOT NULL,',
  '  nom         VARCHAR(100) NOT NULL,',
  '  adresse     TEXT,',
  '  telephone   VARCHAR(20),',
  '  email       VARCHAR(100),',
  '  actif       BOOLEAN DEFAULT TRUE,',
  '  created_at  TIMESTAMPTZ DEFAULT NOW()',
  ');',
]);

h2('1.2 Stock par magasin (changement majeur)');
para(
  'La colonne produits.stock actuelle devient obsolète. Elle est remplacée par une table ' +
  'de liaison qui porte le stock disponible par produit et par magasin.'
);
codeBlock([
  '-- Nouvelle table (remplace produits.stock)',
  'CREATE TABLE stocks (',
  '  produit_id    INTEGER REFERENCES produits(id) ON DELETE CASCADE,',
  '  magasin_id    INTEGER REFERENCES magasins(id) ON DELETE CASCADE,',
  '  quantite      INTEGER NOT NULL DEFAULT 0,',
  '  stock_alerte  INTEGER NOT NULL DEFAULT 5,',
  '  PRIMARY KEY (produit_id, magasin_id)',
  ');',
  '',
  '-- Backfill : créer une entrée pour le magasin principal (id=1)',
  'INSERT INTO stocks (produit_id, magasin_id, quantite, stock_alerte)',
  'SELECT id, 1, stock, stock_alerte FROM produits;',
  '',
  '-- Puis supprimer les colonnes dépréciées',
  'ALTER TABLE produits DROP COLUMN stock;',
  'ALTER TABLE produits DROP COLUMN stock_alerte;',
]);

h2('1.3 Colonnes magasin_id à ajouter');
tableRow('Table', 'Type de colonne', 'Impact', true);
tableRow('utilisateurs',    'magasin_id INTEGER (NULL = accès tous)', 'Scoping auth');
tableRow('ventes',          'magasin_id INTEGER NOT NULL',            'Filtrage des ventes');
tableRow('achats',          'magasin_id INTEGER NOT NULL',            'Filtrage des achats');
tableRow('paiements',       'magasin_id INTEGER NOT NULL',            'Rapports caisse');
tableRow('mouvements_stock','magasin_id INTEGER NOT NULL',            'Traçabilité stock');
tableRow('depenses',        'magasin_id INTEGER NOT NULL',            'Comptabilité locale');
tableRow('devis',           'magasin_id INTEGER NOT NULL',            'Devis locaux');
tableRow('notifications',   'magasin_id INTEGER',                     'Alertes ciblées');
doc.moveDown(0.5);

h2('1.4 Transferts inter-magasins');
codeBlock([
  'CREATE TABLE transferts_stock (',
  '  id              SERIAL PRIMARY KEY,',
  '  produit_id      INTEGER REFERENCES produits(id),',
  '  magasin_source  INTEGER REFERENCES magasins(id),',
  '  magasin_dest    INTEGER REFERENCES magasins(id),',
  '  quantite        INTEGER NOT NULL CHECK (quantite > 0),',
  '  notes           TEXT,',
  '  created_by      INTEGER REFERENCES utilisateurs(id),',
  '  created_at      TIMESTAMPTZ DEFAULT NOW()',
  ');',
  '-- Un transfert = 1 mouvement "sortie" + 1 mouvement "entrée" en transaction',
]);

h2('1.5 Vues à adapter');
bullet([
  'v_creances_clients → ajouter magasin_id dans le SELECT et créer une vue consolidée',
  'v_dettes_fournisseurs → idem',
  'v_echeances_30j → paramétrer par magasin ou créer une vue globale séparée',
  'Triggers trg_paiement_vente / trg_paiement_achat → inchangés (portent déjà sur la ligne)',
]);

// ══════════════════════════════════════════════════════════════════════════════
// PAGE 3 — API
// ══════════════════════════════════════════════════════════════════════════════
newPage();
h1('2 · Modifications API (Node.js / Express)');

h2('2.1 JWT — ajout de magasin_id dans le payload');
para(
  'Le token JWT embarque déjà : sub, email, nom, prenom, role, perms, jti. ' +
  'Il faut y ajouter magasin_id (null pour les admins multi-magasins).'
);
codeBlock([
  '// routes/auth.ts — construction du payload',
  'const payload = {',
  '  sub:        user.id,',
  '  email:      user.email,',
  '  nom:        user.nom,',
  '  prenom:     user.prenom,',
  '  role:       user.role_code,',
  '  perms:      user.permissions,',
  '  magasin_id: user.magasin_id,   // ← NOUVEAU (null = tous)',
  '};',
]);

h2('2.2 Middleware requirePerm — scoping automatique');
codeBlock([
  '// middleware/auth.ts',
  '// req.user.magasin_id disponible dans toutes les routes',
  '// Les admins (magasin_id = null) voient tout',
  '',
  'export function scopeMagasin(req: Request): number | null {',
  '  return req.user?.magasin_id ?? null;',
  '}',
]);

h2('2.3 Pattern de filtrage dans les routes');
para(
  'Quasi toutes les queries dans routes/index.ts et routes/ventes.ts ' +
  'doivent appliquer le filtre magasin. Voici le pattern à suivre :'
);
codeBlock([
  '// Avant (mono-magasin)',
  'const { rows } = await db.query(',
  '  `SELECT * FROM ventes WHERE client_id = $1`, [client_id]',
  ');',
  '',
  '// Après (multi-magasin)',
  'const magasin_id = req.user!.magasin_id;',
  'const params: unknown[] = [client_id];',
  'let   sql = `SELECT * FROM ventes WHERE client_id = $1`;',
  'if (magasin_id) { params.push(magasin_id); sql += ` AND magasin_id = $${params.length}`; }',
  'const { rows } = await db.query(sql, params);',
]);

h2('2.4 routes/ventes.ts — POST /api/ventes');
para(
  'La création d\'une vente doit :'
);
bullet([
  'Insérer magasin_id dans la table ventes',
  'Décrémenter le stock dans la table stocks (produit_id, magasin_id) et non plus produits.stock',
  'Vérifier l\'alerte stock dans stocks, pas dans produits',
]);
codeBlock([
  '// Avant',
  'await client.query(',
  '  `UPDATE produits SET stock=stock-$1 WHERE id=$2`,',
  '  [l.quantite, l.produit_id]',
  ');',
  '',
  '// Après',
  'await client.query(',
  '  `UPDATE stocks SET quantite=quantite-$1',
  '   WHERE produit_id=$2 AND magasin_id=$3`,',
  '  [l.quantite, l.produit_id, magasin_id]',
  ');',
]);

h2('2.5 Nouveaux endpoints nécessaires');
tableRow('Méthode + Route', 'Rôle', 'Permission requise', true);
tableRow('GET  /api/magasins',                    'Liste des magasins',           'admin');
tableRow('POST /api/magasins',                    'Créer un magasin',             'admin');
tableRow('PUT  /api/magasins/:id',                'Modifier un magasin',          'admin');
tableRow('GET  /api/stocks?magasin_id=',          'Stock par magasin',            'stock');
tableRow('POST /api/stocks/transfert',            'Transfert inter-magasins',     'stock');
tableRow('GET  /api/dashboard?magasin_id=',       'Dashboard par magasin',        'tous');
tableRow('GET  /api/rapports/consolide',          'Rapport tous magasins',        'admin');
doc.moveDown(0.5);

// ══════════════════════════════════════════════════════════════════════════════
// PAGE 4 — FRONTEND + MIGRATION
// ══════════════════════════════════════════════════════════════════════════════
newPage();
h1('3 · Modifications Frontend (React / Vite)');

h2('3.1 Sélecteur de magasin');
para(
  'Pour les utilisateurs admin (magasin_id = null dans le JWT), un sélecteur de magasin ' +
  'apparaît dans AppLayout. Le magasin actif est stocké dans un contexte React global ' +
  'et injecté dans tous les appels API.'
);
codeBlock([
  '// hooks/useMagasin.ts',
  'export function useMagasin() {',
  '  const { user } = useAuth();',
  '  const [magasinActif, setMagasinActif] = useState(user.magasin_id);',
  '  // Si user.magasin_id est non-null, le magasin est fixe (non commutable)',
  '  return { magasinActif, setMagasinActif, isAdmin: !user.magasin_id };',
  '}',
]);

h2('3.2 Pages impactées');
tableRow('Page', 'Modification', 'Priorité', true);
tableRow('DashboardPage',        'KPIs filtrés par magasin + vue consolidée',     'Haute');
tableRow('StockPage',            'Afficher stocks.quantite par magasin',           'Haute');
tableRow('ProduitsPage',         'Stock consolidé tous magasins en lecture',       'Haute');
tableRow('VentesPage',           'Filtre magasin + colonne magasin dans tableau',  'Haute');
tableRow('AchatsPage',           'Idem ventes',                                   'Haute');
tableRow('CreancesPage',         'Filtre par magasin',                             'Moyenne');
tableRow('RapportsPage',         'Onglets : par magasin / consolidé',              'Moyenne');
tableRow('AdminPage',            'CRUD magasins + affectation utilisateurs',       'Haute');
tableRow('AdminReferentielsPage','Référentiels globaux ou par magasin (à décider)','Faible');
doc.moveDown(0.5);

h2('3.3 API client — injection automatique du filtre');
codeBlock([
  '// lib/api.ts',
  'function buildParams(extra: Record<string, unknown> = {}) {',
  '  const magasin_id = getMagasinActif();   // depuis contexte React',
  '  return magasin_id ? { magasin_id, ...extra } : extra;',
  '}',
  '',
  '// Exemple d\'usage',
  'const ventes = await api.get(\'/ventes\', { params: buildParams({ statut }) });',
]);

// ─── Stratégie de migration
h1('4 · Stratégie de migration recommandée');

h2('Phase 1 — Fondations DB (sans casser l\'existant)');
bullet([
  'Créer la table magasins avec un enregistrement initial « Magasin Principal »',
  'Créer la table stocks et backfiller depuis produits.stock',
  'Ajouter les colonnes magasin_id (NULLABLE avec DEFAULT 1) sur toutes les tables',
  'NE PAS encore supprimer produits.stock — double write temporaire',
], GREEN);

h2('Phase 2 — API');
bullet([
  'Ajouter magasin_id dans le JWT (non breaking si nullable)',
  'Mettre à jour le middleware pour exposer req.user.magasin_id',
  'Adapter les routes une par une avec le pattern de filtrage',
  'Créer les nouveaux endpoints /api/magasins et /api/stocks/transfert',
], ORANGE);

h2('Phase 3 — Frontend');
bullet([
  'Ajouter le contexte MagasinProvider dans App.tsx',
  'Intégrer le sélecteur de magasin dans AppLayout',
  'Mettre à jour StockPage, DashboardPage, VentesPage en priorité',
  'Adapter RapportsPage pour la vue consolidée',
], ORANGE);

h2('Phase 4 — Finalisation');
bullet([
  'Passer magasin_id NOT NULL sur toutes les tables (après vérification données)',
  'Supprimer produits.stock et produits.stock_alerte',
  'Mettre à jour les triggers et vues',
  'Tests d\'intégration end-to-end',
], RED);

// ─── Risques
newPage();
h1('5 · Risques et points de vigilance');

h3('Risque critique — Triggers de stock');
para(
  'Les triggers trg_paiement_vente et trg_paiement_achat ne touchent pas au stock directement, ' +
  'mais toutes les routes qui font UPDATE produits SET stock=... doivent migrer vers ' +
  'UPDATE stocks SET quantite=... . Un oubli = stock global incohérent.'
);

h3('Risque élevé — Backfill des données existantes');
para(
  'Toutes les ventes, achats, paiements et mouvements_stock existants doivent recevoir ' +
  'magasin_id=1 (magasin principal). À faire en migration SQL avant de rendre la colonne NOT NULL.'
);

h3('Risque élevé — Rapports consolidés');
para(
  'Les agrégats du dashboard (chiffre d\'affaires, créances, dettes) doivent distinguer ' +
  'clairement le périmètre : un magasin seul vs. tous magasins. Un admin qui voit le CA ' +
  'd\'un seul magasin alors qu\'il croit voir le total = erreur de pilotage grave.'
);

h3('Point de vigilance — Référentiels');
para(
  'Les 13 tables référentiels (types clients, statuts, moyens paiement…) sont actuellement ' +
  'globales. Décider si elles restent globales (recommandé, plus simple) ou deviennent ' +
  'par-magasin (plus flexible mais complexe).'
);

h3('Point de vigilance — Numérotation des documents');
para(
  'Les numéros de vente (VTE-XXXX), bons de commande et devis sont séquentiels globalement. ' +
  'En multi-magasin, préférer un préfixe magasin : VTE-MG1-1001, VTE-MG2-1001. ' +
  'Modifier la logique de génération du numéro dans routes/ventes.ts.'
);

// ─── Récapitulatif
h1('6 · Récapitulatif des fichiers à modifier');
tableRow('Fichier', 'Type de changement', 'Effort', true);
tableRow('migrations/013_magasins.sql',  'Nouveau — table magasins + stocks',    '★★★');
tableRow('migrations/014_backfill.sql',  'Nouveau — backfill magasin_id=1',       '★★');
tableRow('apps/api/src/lib/db.ts',       'Inchangé',                              '—');
tableRow('apps/api/src/routes/auth.ts',  'magasin_id dans JWT payload',           '★');
tableRow('apps/api/src/routes/ventes.ts','Stock stocks + magasin_id insert',      '★★★');
tableRow('apps/api/src/routes/index.ts', 'Filtrage + nouveaux endpoints',          '★★★');
tableRow('apps/api/src/middleware/auth.ts','Exposer magasin_id',                  '★');
tableRow('apps/api/src/services/notifications.ts','alerteStock → table stocks',   '★★');
tableRow('apps/web/src/components/layout/AppLayout.tsx','Sélecteur magasin',       '★★');
tableRow('apps/web/src/pages/StockPage.tsx',    'Refonte affichage stock',          '★★★');
tableRow('apps/web/src/pages/DashboardPage.tsx','KPIs par magasin',                '★★');
tableRow('apps/web/src/pages/VentesPage.tsx',   'Colonne + filtre magasin',         '★★');
tableRow('apps/web/src/pages/AdminPage.tsx',    'CRUD magasins',                    '★★');
tableRow('apps/web/src/pages/RapportsPage.tsx', 'Vue consolidée',                   '★★');
tableRow('packages/shared/src/index.ts', 'Types Magasin, Stock, Transfert',        '★');
doc.moveDown(0.8);

// Footer
doc.fontSize(8).fillColor(GRAY).font('Helvetica')
   .text(`StoreBox — Analyse multi-magasin — ${new Date().toLocaleDateString('fr-FR')} — Confidentiel`,
         50, doc.page.height - 40, { align: 'center' });

// ─── FIN
doc.end();
console.log(`✅  PDF généré : ${OUT}`);
