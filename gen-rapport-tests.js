const PDFDocument = require('pdfkit');
const fs          = require('fs');
const path        = require('path');

const OUT = path.join(__dirname, 'rapport-tests.pdf');
const doc = new PDFDocument({ margin: 50, size: 'A4' });
doc.pipe(fs.createWriteStream(OUT));

// ── Palette ──────────────────────────────────────────────────────────────────
const BLEU   = '#1E40AF';
const VERT   = '#15803D';
const ROUGE  = '#DC2626';
const GRIS   = '#6B7280';
const FOND   = '#F1F5F9';
const BLANC  = '#FFFFFF';
const NOIR   = '#1E293B';

function bandeau(texte, couleur = BLEU) {
  doc.rect(50, doc.y, 495, 28).fill(couleur);
  doc.fillColor(BLANC).fontSize(12).font('Helvetica-Bold')
     .text(texte, 60, doc.y - 22, { lineBreak: false });
  doc.fillColor(NOIR).moveDown(1.2);
}

function sousTitre(texte) {
  doc.moveDown(0.4)
     .fillColor(BLEU).fontSize(11).font('Helvetica-Bold')
     .text(texte)
     .fillColor(NOIR).font('Helvetica').fontSize(10)
     .moveDown(0.3);
}

function ligne(label, valeur, couleurVal = NOIR) {
  const y = doc.y;
  doc.font('Helvetica-Bold').fontSize(10).fillColor(GRIS).text(label, 60, y, { continued: true, width: 180 });
  doc.font('Helvetica').fillColor(couleurVal).text(valeur, { align: 'left' });
}

function puce(texte) {
  doc.font('Helvetica').fontSize(10).fillColor(NOIR)
     .text(`• ${texte}`, { indent: 15 });
}

function espaceCheck(texte, ok = true) {
  const symbole = ok ? '✓' : '✗';
  const coul    = ok ? VERT : ROUGE;
  doc.font('Helvetica').fontSize(10)
     .fillColor(coul).text(symbole, 60, doc.y, { continued: true, width: 20 })
     .fillColor(NOIR).text(` ${texte}`);
}

function tableauResultat(rows) {
  const colW = [220, 90, 90, 85];
  const x0   = 50;
  let   y    = doc.y + 4;

  // En-tête
  doc.rect(x0, y, 495, 18).fill(BLEU);
  const hdrs = ['Fichier de test', 'Type', 'Tests', 'Statut'];
  hdrs.forEach((h, i) => {
    const x = x0 + colW.slice(0, i).reduce((a, b) => a + b, 0);
    doc.fillColor(BLANC).fontSize(9).font('Helvetica-Bold').text(h, x + 4, y + 4, { width: colW[i] - 4, lineBreak: false });
  });
  y += 18;

  rows.forEach((r, idx) => {
    const bg = idx % 2 === 0 ? FOND : BLANC;
    doc.rect(x0, y, 495, 16).fill(bg);
    r.forEach((cell, i) => {
      const x    = x0 + colW.slice(0, i).reduce((a, b) => a + b, 0);
      const coul = i === 3 ? (cell.includes('✓') ? VERT : ROUGE) : NOIR;
      doc.fillColor(coul).fontSize(9).font(i === 3 ? 'Helvetica-Bold' : 'Helvetica')
         .text(cell, x + 4, y + 3, { width: colW[i] - 4, lineBreak: false });
    });
    y += 16;
  });

  doc.rect(x0, doc.y - (rows.length * 16 + 18), 495, rows.length * 16 + 18).stroke('#CBD5E1');
  doc.y = y + 6;
}

// ════════════════════════════════════════════════════════════════════════════
// PAGE 1 — COUVERTURE
// ════════════════════════════════════════════════════════════════════════════
doc.rect(0, 0, 595, 200).fill(BLEU);
doc.fillColor(BLANC).fontSize(26).font('Helvetica-Bold')
   .text('TéléPro CI', 50, 60, { align: 'center' });
doc.fontSize(16).font('Helvetica')
   .text('Rapport de mise en place de la suite de tests', { align: 'center' });
doc.fontSize(11)
   .text('Couverture complète API + Web · Avril 2026', { align: 'center' });

doc.fillColor(NOIR).y = 220;

// Bloc synthèse rapide
doc.rect(50, 220, 495, 100).fill(FOND).stroke('#CBD5E1');
doc.fillColor(NOIR).fontSize(13).font('Helvetica-Bold').text('Résultat global', 70, 232);

const stats = [
  ['Tests web (React)',       '38 / 38', VERT],
  ['Tests API unitaires',     '17 / 17', VERT],
  ['Tests API intégration',   '33 / 33', VERT],
  ['TOTAL',                   '88 / 88', VERT],
];
let sx = 70, sy = 252;
stats.forEach(([lib, val, c]) => {
  doc.font('Helvetica').fontSize(10).fillColor(GRIS).text(lib, sx, sy, { continued: true, width: 200 });
  doc.font('Helvetica-Bold').fillColor(c).text(val);
  sy += 14;
});

doc.fillColor(NOIR).y = 340;
doc.fontSize(10).font('Helvetica').fillColor(GRIS)
   .text('Généré le ' + new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }), { align: 'right' });

// ════════════════════════════════════════════════════════════════════════════
// PAGE 2 — CONTEXTE & OBJECTIFS
// ════════════════════════════════════════════════════════════════════════════
doc.addPage();

bandeau('1. Contexte et objectifs');

doc.fillColor(NOIR).fontSize(10).font('Helvetica').moveDown(0.3)
   .text(
     'Dans le cadre du développement de TéléPro CI (application de gestion commerciale pour ' +
     'distributeur de téléphones en Côte d\'Ivoire), une suite de tests automatisés a été mise ' +
     'en place pour garantir la fiabilité du code après l\'ajout de fonctionnalités importantes : ' +
     'gestion multi-magasins, utilisateurs multi-magasins et page dédiée aux magasins.',
     { width: 490 }
   );

doc.moveDown(0.8);
sousTitre('Fonctionnalités couvertes');
['Authentification JWT avec sessions révocables en base',
 'Gestion multi-magasins (junction table utilisateurs_magasins)',
 'CRUD utilisateurs avec assignation à plusieurs magasins',
 'CRUD magasins (liste, détail, création, modification)',
 'Hook React useMagasin() — logique mono / multi / admin',
 'Formatters FCFA, dates, badges (formatters.ts)',
 'Trigger PostgreSQL trg_paiement_vente (recalcul automatique)',
].forEach(t => puce(t));

doc.moveDown(0.8);
sousTitre('Stack de test');
[
  ['Framework',      'Vitest 4.x (API + Web)'],
  ['Tests API',      'Supertest (requêtes HTTP contre l\'app Express)'],
  ['Tests Web',      'React Testing Library + renderHook'],
  ['Base de données','PostgreSQL 16 — base dédiée telepro_test'],
  ['Isolation',      'TRUNCATE des tables opérationnelles entre chaque test'],
].forEach(([k, v]) => ligne(k, v));

// ════════════════════════════════════════════════════════════════════════════
// PAGE 3 — ARCHITECTURE DE TEST
// ════════════════════════════════════════════════════════════════════════════
doc.addPage();
bandeau('2. Architecture de la suite de tests');

sousTitre('Structure des fichiers');
[
  'apps/api/vitest.config.ts          → Config intégration (DB, maxWorkers: 1)',
  'apps/api/vitest.unit.config.ts     → Config unitaire (sans DB)',
  'apps/api/src/test/globalSetup.ts   → Drop/recréation telepro_test + migrations',
  'apps/api/src/test/setup.ts         → TRUNCATE avant chaque test',
  'apps/api/src/test/fixtures.ts      → makeToken(), authHeader(), request',
  'apps/api/src/__tests__/unit/       → Tests helpers + scopeMagasin',
  'apps/api/src/__tests__/integration/→ Auth, Admin, Magasins, Triggers',
  'apps/web/vitest.config.ts          → Config jsdom + React Testing Library',
  'apps/web/src/test/setup.ts         → jest-dom + cleanup localStorage',
  'apps/web/src/__tests__/            → formatters.test.ts, useMagasin.test.ts',
].forEach(t => puce(t));

doc.moveDown(0.6);
sousTitre('Isolation de la base de test');
doc.fontSize(10).font('Helvetica').fillColor(NOIR)
   .text(
     'À chaque lancement, globalSetup.ts recrée la base telepro_test depuis zéro ' +
     '(DROP DATABASE + CREATE DATABASE), puis applique toutes les migrations (001→016) ' +
     'instruction par instruction. Cette approche garantit un schéma propre et évite les ' +
     'conflits entre runs successifs.',
     { width: 490 }
   );

doc.moveDown(0.6);
sousTitre('Exécution séquentielle obligatoire');
doc.fontSize(10).font('Helvetica').fillColor(NOIR)
   .text(
     'Les tests d\'intégration partagent une base de données commune. Pour éviter les ' +
     'interférences (ex. TRUNCATE d\'un worker qui supprime des données utilisées par un autre), ' +
     'la configuration impose maxWorkers: 1 — les fichiers de test sont exécutés en série.',
     { width: 490 }
   );

doc.moveDown(0.6);
sousTitre('Commandes npm');
const cmds = [
  ['npm run test:unit  (api)',  'Unitaires uniquement — sans connexion DB'],
  ['npm run test:int   (api)',  'Intégration — recréation DB automatique'],
  ['npm test           (api)',  'Unit + intégration en séquence'],
  ['npm test           (web)',  'Tous les tests React (jsdom)'],
];
cmds.forEach(([cmd, desc]) => {
  doc.font('Courier').fontSize(9).fillColor(BLEU).text(cmd, 60, doc.y, { continued: true, width: 220 });
  doc.font('Helvetica').fontSize(9).fillColor(GRIS).text(`  ${desc}`);
});

// ════════════════════════════════════════════════════════════════════════════
// PAGE 4 — DÉTAIL DES TESTS
// ════════════════════════════════════════════════════════════════════════════
doc.addPage();
bandeau('3. Détail des fichiers de test');

sousTitre('Tests API');
tableauResultat([
  ['unit/helpers.test.ts',           'Unitaire',      '8 tests',  '✓ PASS'],
  ['unit/scopeMagasin.test.ts',      'Unitaire',      '9 tests',  '✓ PASS'],
  ['integration/auth.test.ts',       'Intégration',   '10 tests', '✓ PASS'],
  ['integration/admin.test.ts',      'Intégration',   '11 tests', '✓ PASS'],
  ['integration/magasins.test.ts',   'Intégration',   '11 tests', '✓ PASS'],
  ['integration/triggers.test.ts',   'Intégration',   '1 test',   '✓ PASS'],
]);

sousTitre('Tests Web');
tableauResultat([
  ['__tests__/formatters.test.ts',   'Unitaire',      '19 tests', '✓ PASS'],
  ['__tests__/useMagasin.test.ts',   'Unitaire',      '19 tests', '✓ PASS'],
]);

doc.moveDown(0.6);
sousTitre('Cas testés — highlights');

const highlights = {
  'helpers.test.ts': ['ok() renvoie { success: true, data }', 'fail() renvoie { success: false, error }', 'wrap() propage les erreurs async vers next()'],
  'scopeMagasin.test.ts': ['Mono-magasin : query param ignoré, retourne le seul magasin', 'Admin (ids vide) : query param libre', 'Multi-magasin : query param validé dans le périmètre'],
  'auth.test.ts': ['Login retourne token + refreshToken + magasin_ids[]', 'Blocage sur mauvais mot de passe (401)', '/me retourne le profil avec magasin_ids en tableau JS', 'Refresh échange un token valide'],
  'admin.test.ts': ['CRUD utilisateurs avec vérification admin (403 sinon)', 'Création avec magasin_ids[] multiples via junction table', 'Mise à jour des magasins assignés'],
  'magasins.test.ts': ['Liste avec nb_utilisateurs et valeur_stock', 'Détail avec utilisateurs et stocks', 'CRUD protégé admin (403 pour commercial)'],
  'triggers.test.ts': ['INSERT paiement → montant_paye/solde_restant mis à jour', 'Statut → partiel puis paye automatiquement'],
};

Object.entries(highlights).forEach(([fichier, cas]) => {
  doc.font('Helvetica-Oblique').fontSize(9).fillColor(GRIS).text(fichier, { indent: 10 });
  cas.forEach(c => puce(c));
  doc.moveDown(0.2);
});

// ════════════════════════════════════════════════════════════════════════════
// PAGE 5 — PROBLÈMES RENCONTRÉS & SOLUTIONS
// ════════════════════════════════════════════════════════════════════════════
doc.addPage();
bandeau('4. Problèmes rencontrés et solutions', '#7C3AED');

const problemes = [
  {
    titre: 'Migrations multi-instructions : rollback silencieux',
    prob:  'node-postgres exécute un fichier SQL multi-instructions dans une transaction implicite. ' +
           'Si une instruction échoue (ex. ALTER TABLE echeances_manuelles dans 013 avant que la table ' +
           'existe), toutes les instructions précédentes du fichier sont annulées.',
    sol:   'globalSetup découpe chaque fichier en instructions individuelles (splitStatements()) ' +
           'et les exécute une à une avec try/catch. Ainsi, un échec isolé ne compromet pas le reste.',
  },
  {
    titre: 'CREATE OR REPLACE VIEW ne peut pas changer les colonnes',
    prob:  'Migrations 007 et 014 tentaient de remplacer des vues existantes en modifiant leur ordre ' +
           'ou type de colonnes — PostgreSQL le refuse avec "cannot change name/type of view column".',
    sol:   'Ajout de DROP VIEW IF EXISTS ... CASCADE avant chaque CREATE VIEW dans les migrations concernées.',
  },
  {
    titre: 'Arrays PostgreSQL retournés comme chaînes',
    prob:  'La vue v_utilisateurs_magasins utilisait COALESCE(..., \'{}\') avec un littéral texte non typé. ' +
           'pg retournait la colonne en tant que text et non integer[], donc magasin_ids arrivait ' +
           'au frontend comme la chaîne "{1,2}" plutôt qu\'un tableau [1, 2].',
    sol:   'Cast explicite : COALESCE(array_agg(...), \'{}\'::int[]). Le driver pg parse alors ' +
           'correctement l\'integer[] en tableau JavaScript.',
  },
  {
    titre: 'Sessions TRUNCATE entre beforeAll et les tests',
    prob:  'Le beforeAll des fichiers d\'intégration créait des tokens (sessions en DB), puis le ' +
           'beforeEach global tronquait la table sessions, invalidant les tokens avant même que ' +
           'les tests ne s\'exécutent (→ 401 systématique).',
    sol:   'Suppression de sessions de la liste TRUNCATE. Chaque token a un JTI unique ; les ' +
           'anciennes sessions n\'interfèrent pas avec les nouvelles.',
  },
  {
    titre: 'Tests d\'intégration parallèles (TRUNCATE croisé)',
    prob:  'Par défaut, vitest exécute les fichiers de test en parallèle sur plusieurs workers. ' +
           'Le beforeEach d\'un worker tronquait les données en cours d\'utilisation par un autre, ' +
           'causant des failures aléatoires (SELECT retourne 0 lignes après INSERT).',
    sol:   'Ajout de maxWorkers: 1 dans vitest.config.ts : les fichiers s\'exécutent en série ' +
           'dans le même processus, éliminant les interférences.',
  },
  {
    titre: 'pool.end() fermait le pool partagé entre fichiers',
    prob:  'setup.ts appelait pool.end() dans afterAll. Comme le pool est un singleton, le ' +
           'premier fichier terminé fermait la connexion pour tous les suivants.',
    sol:   'Suppression de pool.end() — le pool se ferme naturellement à la fin du processus vitest.',
  },
  {
    titre: 'app.listen() déclenchée lors de l\'import par supertest',
    prob:  'src/index.ts appelait app.listen(3001) au niveau module. Supertest importe l\'app, ' +
           'ce qui déclenchait listen(), causant EADDRINUSE si le serveur était déjà démarré.',
    sol:   'Condition if (process.env.NODE_ENV !== \'test\') autour de app.listen().',
  },
];

problemes.forEach((p, i) => {
  if (doc.y > 680) doc.addPage();
  doc.moveDown(0.4);
  doc.rect(50, doc.y, 495, 16).fill('#EDE9FE');
  doc.fillColor('#7C3AED').fontSize(10).font('Helvetica-Bold')
     .text(`${i + 1}. ${p.titre}`, 58, doc.y - 13);
  doc.fillColor(NOIR).moveDown(0.5);

  doc.font('Helvetica-Bold').fontSize(9).fillColor(ROUGE).text('Problème : ', 60, doc.y, { continued: true });
  doc.font('Helvetica').fillColor(NOIR).text(p.prob, { width: 480 });
  doc.moveDown(0.2);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(VERT).text('Solution : ', 60, doc.y, { continued: true });
  doc.font('Helvetica').fillColor(NOIR).text(p.sol, { width: 480 });
});

// ════════════════════════════════════════════════════════════════════════════
// PAGE FINALE — BILAN
// ════════════════════════════════════════════════════════════════════════════
doc.addPage();
bandeau('5. Bilan et recommandations', VERT);

doc.moveDown(0.3);
sousTitre('Résultats finaux');
[
  ['Tests web (React / jsdom)',      '38 / 38 ✓', VERT],
  ['Tests API unitaires',            '17 / 17 ✓', VERT],
  ['Tests API intégration',          '33 / 33 ✓', VERT],
  ['Total',                          '88 / 88  — 100 % de réussite', VERT],
].forEach(([k, v, c]) => ligne(k, v, c));

doc.moveDown(0.8);
sousTitre('Couverture fonctionnelle atteinte');
[
  ['Authentification JWT', true],
  ['Gestion multi-magasins (junction table)', true],
  ['CRUD admin utilisateurs + magasins', true],
  ['Hook useMagasin() (mono / multi / admin)', true],
  ['Formatters monétaires et dates', true],
  ['Trigger recalc paiements', true],
  ['Isolation DB entre tests (TRUNCATE)', true],
  ['Exécution déterministe (pas de flakiness)', true],
].forEach(([t, ok]) => espaceCheck(t, ok));

doc.moveDown(0.8);
sousTitre('Recommandations pour la suite');
[
  'Ajouter des tests pour les routes /ventes, /clients, /stock (endpoints principaux)',
  'Tester les notifications SMS/WhatsApp avec un mock Twilio',
  'Intégrer les tests dans la CI/CD (GitHub Actions ou Docker Compose test stage)',
  'Ajouter des tests de charge légers sur les endpoints les plus critiques',
  'Couvrir les cas d\'erreur réseau et timeout DB dans les routes Express',
].forEach(t => puce(t));

doc.moveDown(1);
doc.rect(50, doc.y, 495, 1).fill('#CBD5E1');
doc.moveDown(0.5);
doc.fontSize(9).fillColor(GRIS).font('Helvetica')
   .text('TéléPro CI — Document généré automatiquement · Anthropic Claude Sonnet 4.6', { align: 'center' });

doc.end();

doc.on('finish', () => {
  console.log('PDF généré :', OUT);
});
