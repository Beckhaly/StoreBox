import { Pool } from 'pg';
import fs      from 'fs';
import path    from 'path';

const MIGRATIONS = [
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
  '023_bc_reception.sql',
  '024_essential_seed.sql',
  '026_societe_notifications.sql',
  '027_solde_initial.sql',
  '028_logo_url_text.sql',
  '029_prix_paliers.sql',
  '030_referentiels_normalize.sql',
  '031_droits.sql',
  '032_codes_auto.sql',
];

const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

// Base de test StoreBox (conteneur Docker storebox-pg-5433).
// On se connecte à la base de maintenance storebox_ci pour créer storebox_test.
const ADMIN_URL = 'postgresql://storebox:TelePro2026!@localhost:5433/storebox_ci';
const TEST_URL  = 'postgresql://storebox:TelePro2026!@localhost:5433/storebox_test';

export async function setup() {
  // 1. Drop + recreate storebox_test pour un schéma propre
  const admin = new Pool({ connectionString: ADMIN_URL });
  await admin.query(`DROP DATABASE IF EXISTS storebox_test`);
  await admin.query(`CREATE DATABASE storebox_test`);
  await admin.end();

  // 2. Appliquer toutes les migrations sur storebox_test (statement par statement)
  const test = new Pool({ connectionString: TEST_URL });

  function splitStatements(sql: string): string[] {
    // Découper par ';' en ignorant les ';' dans les chaînes, dollar-quotes
    // ET les commentaires de ligne `--` (qui peuvent contenir ; ou ').
    const stmts: string[] = [];
    let current = '';
    let inString = false;
    let inDollar = false;
    let dollarTag = '';
    for (let i = 0; i < sql.length; i++) {
      const ch = sql[i];
      // Commentaire de ligne `--` hors chaîne/dollar-quote → sauter jusqu'au saut de ligne
      if (!inString && !inDollar && ch === '-' && sql[i + 1] === '-') {
        const nl = sql.indexOf('\n', i);
        if (nl === -1) { i = sql.length; break; }
        current += ' ';      // préserver la séparation entre tokens
        i = nl;              // la boucle ajoutera le '\n'
        continue;
      }
      if (!inString && !inDollar && ch === "'") { inString = true; current += ch; continue; }
      if (inString && ch === "'" && sql[i+1] !== "'") { inString = false; current += ch; continue; }
      if (!inString && !inDollar && ch === '$') {
        const m = sql.slice(i).match(/^\$([A-Za-z_]*)\$/);
        if (m) { inDollar = true; dollarTag = m[0]; current += dollarTag; i += dollarTag.length - 1; continue; }
      }
      if (inDollar && sql.slice(i).startsWith(dollarTag)) {
        current += dollarTag; i += dollarTag.length - 1; inDollar = false; dollarTag = ''; continue;
      }
      if (!inString && !inDollar && ch === ';') {
        const stmt = current.trim();
        if (stmt) stmts.push(stmt);
        current = '';
        continue;
      }
      current += ch;
    }
    const last = current.trim();
    if (last) stmts.push(last);
    return stmts;
  }

  for (const file of MIGRATIONS) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    if (!fs.existsSync(filePath)) continue;
    const sql = fs.readFileSync(filePath, 'utf-8');
    const stmts = splitStatements(sql);
    for (const stmt of stmts) {
      try {
        await test.query(stmt);
      } catch (e: any) {
        // Ignorer les erreurs bénignes mais loguer les autres
        const msg = e.message;
        if (!msg.includes('already exists') && !msg.includes('does not exist') && !msg.includes('duplicate')) {
          console.warn(`[migration ${file}] ${msg.slice(0, 120)}`);
        }
      }
    }
  }
  await test.end();
}

export async function teardown() {
  // On garde la DB de test entre les runs pour la rapidité
}
