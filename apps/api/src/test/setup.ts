import { beforeEach } from 'vitest';
import { pool } from '../lib/db';

const TRUNCATE = `
  TRUNCATE TABLE
    ventes_lignes, ventes,
    achats_lignes, achats,
    paiements,
    devis_lignes, devis,
    retours_lignes, retours_client,
    bons_commande_lignes, bons_commande,
    audit_logs
  RESTART IDENTITY CASCADE
`;

beforeEach(async () => {
  await pool.query(TRUNCATE);
});
