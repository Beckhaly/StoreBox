// ═══════════════════════════════════════════════════════════════════
// Runner de migrations idempotent (suivi via table schema_migrations).
// - DATABASE_URL depuis l'environnement
// - applique chaque fichier UNE seule fois, dans l'ordre defini
// - chaque fichier dans sa propre transaction (rollback si erreur)
// - attend que Postgres soit pret (retries)
// ═══════════════════════════════════════════════════════════════════
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'apps', 'api', 'migrations');

// SEED_DEMO=true → garde les données de démonstration.
// Sinon (défaut production) → une migration finale 025 vide les données
// de démo pour livrer une base VIERGE à un nouveau client.
// (On applique TOUTES les migrations puis on nettoie : évite les ruptures
//  de dépendances FK des fichiers de seed mélangés au schéma.)
const SEED_DEMO = String(process.env.SEED_DEMO).toLowerCase() === 'true';

// Ordre explicite (gere les prefixes 004_/015_ dupliques + seeds)
const ALL_MIGRATIONS = [
  '001_schema.sql',
  '002_seed.sql',
  '003_auth.sql',
  '004_notifications.sql',
  '004_features.sql',
  '005_depenses.sql',
  '006_depenses_enhanced.sql',
  '007_echeances_manuelles.sql',
  '008_paiements_trigger.sql',
  '009_recalc_ventes.sql',
  '010_seed_depenses.sql',
  '011_referentiels.sql',
  '012_societe_parametres.sql',
  '013_magasins.sql',
  '014_backfill_magasins.sql',
  '015_seed_magasin2.sql',
  '015_stored_procedures.sql',
  '016_multi_magasins.sql',
  '017_fix_stock_logic.sql',
  '018_caisse.sql',
  '019_caisses.sql',
  '020_pos_client.sql',
  '021_produits_universels.sql',
  '022_seed_fruits_legumes.sql',
  '023_bc_reception.sql',
  '024_essential_seed.sql',
  '025_clean_demo.sql',     // nettoyage final (production uniquement)
  '026_societe_notifications.sql',
  '027_solde_initial.sql',
  '028_logo_url_text.sql',
  '029_prix_paliers.sql',
];

// En production (SEED_DEMO != true) on inclut le nettoyage 025 ;
// en mode démo on le retire pour conserver les données.
const MIGRATIONS = SEED_DEMO
  ? ALL_MIGRATIONS.filter((f) => f !== '025_clean_demo.sql')
  : ALL_MIGRATIONS;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('✗ DATABASE_URL manquant');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function waitForDb(retries = 30, delayMs = 2000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (e) {
      console.log(`⏳ Postgres indisponible (tentative ${i}/${retries})…`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('Postgres injoignable après plusieurs tentatives');
}

async function main() {
  await waitForDb();
  console.log(SEED_DEMO
    ? '▶ Mode DÉMO : données de démonstration incluses'
    : '▶ Mode PRODUCTION : base vierge (sans données de démo)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const { rows } = await pool.query('SELECT filename FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.filename));

  let count = 0;
  for (const file of MIGRATIONS) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`✓ ${file}`);
      count++;
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(`✗ ${file}: ${e.message}`);
      throw e;
    } finally {
      client.release();
    }
  }

  console.log(count === 0 ? '✓ Schéma déjà à jour' : `✓ ${count} migration(s) appliquée(s)`);
  await pool.end();
}

main().catch((e) => {
  console.error('✗ Échec migrations:', e.message);
  process.exit(1);
});
