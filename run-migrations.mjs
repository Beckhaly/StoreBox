import pg from 'pg';
import { readFileSync } from 'fs';

const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgresql://telepro:TelePro2026!@localhost:5432/telepro_ci' });

async function query(sql) {
  await pool.query(sql);
}

async function run(file) {
  const sql = readFileSync(file, 'utf8');
  console.log(`\n▶ Applying ${file}...`);
  try {
    await pool.query(sql);
    console.log(`✓ Done`);
  } catch (err) {
    console.error(`✗ Error:`, err.message);
    process.exit(1);
  }
}

// Drop views that may conflict with type changes during migrations
await query('DROP VIEW IF EXISTS v_echeances_30j CASCADE');
await query('DROP VIEW IF EXISTS v_creances_clients CASCADE');
await query('DROP VIEW IF EXISTS v_dettes_fournisseurs CASCADE');
await query('DROP VIEW IF EXISTS v_mouvements_stock CASCADE');
await query('DROP VIEW IF EXISTS v_rentabilite_produits CASCADE');
await query('DROP VIEW IF EXISTS v_stocks CASCADE');
await query('DROP VIEW IF EXISTS v_stocks_consolide CASCADE');
console.log('✓ Views dropped (will be recreated by migrations)');

const migrations = [
  'apps/api/migrations/005_depenses.sql',
  'apps/api/migrations/006_depenses_enhanced.sql',
  'apps/api/migrations/007_echeances_manuelles.sql',
  'apps/api/migrations/008_paiements_trigger.sql',
  'apps/api/migrations/009_recalc_ventes.sql',
  'apps/api/migrations/010_seed_depenses.sql',
  'apps/api/migrations/011_referentiels.sql',
  'apps/api/migrations/012_societe_parametres.sql',
  'apps/api/migrations/013_magasins.sql',
  'apps/api/migrations/014_backfill_magasins.sql',
];

for (const m of migrations) {
  await run(m);
}

await pool.end();
console.log('\n✅ All migrations applied successfully');
