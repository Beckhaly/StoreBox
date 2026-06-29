import { describe, it, expect, beforeAll } from 'vitest';
import { pool }                           from '../../lib/db';
import { authHeader }                     from '../../test/fixtures';

let admin: { Authorization: string };

beforeAll(async () => {
  admin = await authHeader({ role: 'admin', perms: { all: true } });
});

// ── Trigger trg_paiement_vente ────────────────────────────────────────────────
// Tests séquentiels groupés dans un seul it() pour éviter les interférences
// du TRUNCATE beforeEach.

describe('trigger trg_paiement_vente', () => {
  const TOTAL_TTC = 200_000;

  it('recalcule montant_paye/solde_restant et statut à chaque paiement', async () => {
    const { rows: clients } = await pool.query(`SELECT id FROM clients LIMIT 1`);
    const { rows: users }   = await pool.query(`SELECT id FROM utilisateurs LIMIT 1`);
    const { rows: mp }      = await pool.query(`SELECT id FROM moyens_paiement LIMIT 1`);

    // Créer la vente dans ce test (le beforeEach truncate ventes entre les tests)
    const { rows } = await pool.query(
      `INSERT INTO ventes (numero, client_id, date_vente, type_vente, sous_total, tva_montant,
                           total_ttc, montant_paye, solde_restant, statut_paiement, magasin_id, created_by)
       VALUES ('TEST-TRIG-001', $1, CURRENT_DATE, 'gros', $2, 0, $2, 0, $2, 'non_paye', 1, $3)
       RETURNING id`,
      [clients[0].id, TOTAL_TTC, users[0].id]
    );
    const venteId = rows[0].id;

    // État initial
    const { rows: r0 } = await pool.query(`SELECT montant_paye, solde_restant FROM ventes WHERE id=$1`, [venteId]);
    expect(Number(r0[0].montant_paye)).toBe(0);
    expect(Number(r0[0].solde_restant)).toBe(TOTAL_TTC);

    // Paiement partiel
    await pool.query(
      `INSERT INTO paiements (type_paiement, montant, date_paiement, vente_id, moyen_paiement_id, magasin_id)
       VALUES ('encaissement', 50000, CURRENT_DATE, $1, $2, 1)`,
      [venteId, mp[0].id]
    );

    const { rows: r1 } = await pool.query(`SELECT montant_paye, solde_restant, statut_paiement FROM ventes WHERE id=$1`, [venteId]);
    expect(Number(r1[0].montant_paye)).toBe(50_000);
    expect(Number(r1[0].solde_restant)).toBe(TOTAL_TTC - 50_000);
    expect(r1[0].statut_paiement).toBe('partiel');

    // Paiement soldant
    await pool.query(
      `INSERT INTO paiements (type_paiement, montant, date_paiement, vente_id, moyen_paiement_id, magasin_id)
       VALUES ('encaissement', 150000, CURRENT_DATE, $1, $2, 1)`,
      [venteId, mp[0].id]
    );

    const { rows: r2 } = await pool.query(`SELECT statut_paiement, montant_paye, solde_restant FROM ventes WHERE id=$1`, [venteId]);
    expect(Number(r2[0].montant_paye)).toBe(TOTAL_TTC);
    expect(Number(r2[0].solde_restant)).toBe(0);
    expect(r2[0].statut_paiement).toBe('paye');
  });
});
