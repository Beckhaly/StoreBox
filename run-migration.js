const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = 'postgresql://telepro:TelePro2026!@localhost:5432/telepro_ci';

const migrations = [
  '001_schema.sql',
  '003_auth.sql',
  '004_notifications.sql',
  '005_depenses.sql',
  '006_depenses_enhanced.sql',
  '010_seed_depenses.sql',
  '011_referentiels.sql',
  '012_societe_parametres.sql',
];

const client = new Client({ connectionString: DATABASE_URL });

(async () => {
  try {
    await client.connect();
    console.log('✓ Connecté à PostgreSQL');

    for (const file of migrations) {
      const filePath = path.join(__dirname, 'apps', 'api', 'migrations', file);
      if (!fs.existsSync(filePath)) {
        console.log(`⊘ ${file} n\'existe pas, ignoré`);
        continue;
      }

      const sql = fs.readFileSync(filePath, 'utf8');
      try {
        await client.query(sql);
        console.log(`✓ ${file}`);
      } catch (e) {
        console.log(`⊘ ${file}: ${e.message.split('\n')[0]}`);
      }
    }

    await client.end();
    console.log('\n✓ Migrations applicables complétées');
  } catch (e) {
    console.error('✗ Erreur:', e.message);
    process.exit(1);
  }
})();
