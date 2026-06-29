import { Router } from 'express';
import { db }      from '../lib/db';
import { ok, fail, wrap } from '../lib/helpers';
import { requirePerm }    from '../middleware/auth';
import { scopeMagasin }   from '../middleware/auth';
import { NotificationService } from '../services/notifications';

const router = Router();
const notif  = new NotificationService();

// GET /api/ventes
router.get('/', wrap(async (req, res) => {
  const { type_vente, statut, client_id, date_debut, date_fin, limit = '80' } = req.query as Record<string, string>;
  const magasin_id = scopeMagasin(req);
  let q = `SELECT v.*, c.raison_sociale AS client_nom, c.type_client,
                  mp.nom AS moyen_paiement, mg.nom AS magasin_nom
           FROM ventes v
           JOIN clients c ON c.id = v.client_id
           LEFT JOIN moyens_paiement mp ON mp.id = v.moyen_paiement_id
           LEFT JOIN magasins mg ON mg.id = v.magasin_id
           WHERE 1=1`;
  const p: unknown[] = [];
  if (magasin_id) { p.push(magasin_id); q += ` AND v.magasin_id=$${p.length}`; }
  if (type_vente) { p.push(type_vente); q += ` AND v.type_vente=$${p.length}`; }
  if (statut)     { p.push(statut);     q += ` AND v.statut_paiement=$${p.length}`; }
  if (client_id)  { p.push(+client_id); q += ` AND v.client_id=$${p.length}`; }
  if (date_debut) { p.push(date_debut); q += ` AND v.date_vente>=$${p.length}`; }
  if (date_fin)   { p.push(date_fin);   q += ` AND v.date_vente<=$${p.length}`; }
  p.push(+limit);
  q += ` ORDER BY v.date_vente DESC, v.id DESC LIMIT $${p.length}`;
  const { rows } = await db.query(q, p);
  ok(res, rows);
}));

// GET /api/ventes/:id
router.get('/:id', wrap(async (req, res) => {
  const [vente, lignes, paiements] = await Promise.all([
    db.query(`SELECT v.*, c.raison_sociale, c.telephone AS client_tel,
                     mp.nom AS moyen_paiement, mg.nom AS magasin_nom
              FROM ventes v JOIN clients c ON c.id=v.client_id
              LEFT JOIN moyens_paiement mp ON mp.id=v.moyen_paiement_id
              LEFT JOIN magasins mg ON mg.id=v.magasin_id
              WHERE v.id=$1`, [req.params.id]),
    db.query(`SELECT vl.*, p.designation, p.reference
              FROM ventes_lignes vl JOIN produits p ON p.id=vl.produit_id
              WHERE vl.vente_id=$1`, [req.params.id]),
    db.query(`SELECT p.*, mp.nom AS moyen_paiement FROM paiements p
              LEFT JOIN moyens_paiement mp ON mp.id=p.moyen_paiement_id
              WHERE p.vente_id=$1 ORDER BY p.date_paiement`, [req.params.id]),
  ]);
  if (!vente.rows.length) return fail(res, 'Vente non trouvée', 404);
  ok(res, { ...vente.rows[0], lignes: lignes.rows, paiements: paiements.rows });
}));

// POST /api/ventes
router.post('/', requirePerm('ventes'), wrap(async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const {
      client_id, type_vente, date_vente, date_echeance, lignes,
      remise_pct = 0, tva_pct = 18, moyen_paiement_id, notes,
      montant_paye_immediat = 0, envoyer_confirmation = true,
    } = req.body;

    const magasin_id = scopeMagasin(req) ?? 1;

    const { rows: [{ max_id }] } = await client.query(
      `SELECT COALESCE(MAX(id), 1000) AS max_id FROM ventes`
    );
    const numero = `VTE-${Number(max_id) + 1}`;

    const brut            = lignes.reduce((s: number, l: any) => s + Math.round(l.quantite * l.prix_unitaire * (1 - (l.remise_pct ?? 0) / 100)), 0);
    const remise_montant  = Math.round(brut * remise_pct / 100);
    const sous_total      = brut - remise_montant;
    const tva_montant     = Math.round(sous_total * tva_pct / 100);
    const total_ttc       = sous_total + tva_montant;
    const solde_restant   = total_ttc - montant_paye_immediat;
    const statut_paiement = solde_restant <= 0 ? 'paye' : montant_paye_immediat > 0 ? 'partiel' : 'non_paye';

    const { rows: [vente] } = await client.query(
      `INSERT INTO ventes
       (numero,client_id,type_vente,date_vente,date_echeance,sous_total,remise_pct,remise_montant,
        tva_pct,tva_montant,total_ttc,montant_paye,solde_restant,statut_paiement,moyen_paiement_id,notes,magasin_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [numero, client_id, type_vente, date_vente ?? new Date(), date_echeance,
       sous_total, remise_pct, remise_montant, tva_pct, tva_montant, total_ttc,
       montant_paye_immediat, solde_restant, statut_paiement,
       moyen_paiement_id, notes, magasin_id]
    );

    if (montant_paye_immediat > 0) {
      await client.query(
        `INSERT INTO paiements (type_paiement, vente_id, client_id, montant, date_paiement, moyen_paiement_id, notes, magasin_id)
         VALUES ('encaissement', $1, $2, $3, $4, $5, 'Paiement initial', $6)`,
        [vente.id, client_id, montant_paye_immediat, date_vente ?? new Date(), moyen_paiement_id, magasin_id]
      );
    }

    for (const l of lignes) {
      const total_ligne = Math.round(l.quantite * l.prix_unitaire * (1 - (l.remise_pct ?? 0) / 100));
      await client.query(
        `INSERT INTO ventes_lignes (vente_id,produit_id,quantite,prix_unitaire,remise_pct,total_ligne)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [vente.id, l.produit_id, l.quantite, l.prix_unitaire, l.remise_pct ?? 0, total_ligne]
      );

      // Vérifier stock disponible (FOR UPDATE évite les race conditions)
      const { rows: [stk] } = await client.query(
        `SELECT s.quantite, s.stock_alerte, p.designation, p.reference
         FROM stocks s JOIN produits p ON p.id = s.produit_id
         WHERE s.produit_id = $1 AND s.magasin_id = $2
         FOR UPDATE`,
        [l.produit_id, magasin_id]
      );
      if (!stk) throw Object.assign(new Error(`Produit #${l.produit_id} absent du stock de ce magasin`), { statusCode: 400 });
      if (stk.quantite < l.quantite) throw Object.assign(
        new Error(`Stock insuffisant pour "${stk.designation}" (dispo: ${stk.quantite}, demandé: ${l.quantite})`),
        { statusCode: 400 }
      );

      // Décrémenter le stock
      await client.query(
        `UPDATE stocks SET quantite = quantite - $1
         WHERE produit_id = $2 AND magasin_id = $3`,
        [l.quantite, l.produit_id, magasin_id]
      );

      await client.query(
        `INSERT INTO mouvements_stock (produit_id, type, quantite, stock_avant, stock_apres, motif, ref_doc, magasin_id)
         VALUES ($1, 'sortie', $2, $3, $4, 'Vente', $5, $6)`,
        [l.produit_id, l.quantite, stk.quantite, stk.quantite - l.quantite, numero, magasin_id]
      );

      // Alerte stock bas
      const nouv = stk.quantite - l.quantite;
      if (nouv < stk.stock_alerte) notif.alerteStock(db, { ...stk, id: l.produit_id, stock: nouv }).catch(() => {});
    }

    await client.query('COMMIT');

    if (envoyer_confirmation) {
      const { rows: [cli] } = await db.query(`SELECT * FROM clients WHERE id=$1`, [client_id]);
      if (cli) notif.confirmerVente(db, vente, cli).catch(() => {});
    }

    ok(res, vente);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

// POST /api/ventes/:id/paiement — Enregistrer un paiement supplémentaire
router.post('/:id/paiement', requirePerm('paiements'), wrap(async (req, res) => {
  const { id } = req.params;
  const { montant, date_paiement, moyen_paiement_id, reference, notes } = req.body;

  if (!montant || montant <= 0) return fail(res, 'Montant invalide', 400);

  const { rows: [vente] } = await db.query(`SELECT * FROM ventes WHERE id=$1`, [id]);
  if (!vente) return fail(res, 'Vente non trouvée', 404);

  const { rows: [paiement] } = await db.query(
    `INSERT INTO paiements (type_paiement, vente_id, client_id, montant, date_paiement, moyen_paiement_id, reference, notes, magasin_id)
     VALUES ('encaissement', $1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [id, vente.client_id, montant, date_paiement || new Date(), moyen_paiement_id || null,
     reference || null, notes || null, vente.magasin_id]
  );

  ok(res, paiement);
}));

// POST /api/ventes/:id/annuler — Annuler une vente et restaurer le stock
router.post('/:id/annuler', requirePerm('ventes'), wrap(async (req, res) => {
  const { id } = req.params;
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: [vente] } = await client.query(
      `SELECT * FROM ventes WHERE id=$1 FOR UPDATE`, [id]
    );
    if (!vente) return fail(res, 'Vente non trouvée', 404);
    if (vente.statut_paiement === 'annulee') return fail(res, 'Vente déjà annulée', 400);

    // Récupérer les lignes de la vente
    const { rows: lignes } = await client.query(
      `SELECT * FROM ventes_lignes WHERE vente_id=$1`, [id]
    );

    // Restaurer le stock pour chaque ligne
    for (const l of lignes) {
      const { rows: [stk] } = await client.query(
        `SELECT COALESCE(quantite,0) AS quantite FROM stocks WHERE produit_id=$1 AND magasin_id=$2 FOR UPDATE`,
        [l.produit_id, vente.magasin_id]
      );
      const stock_avant = stk?.quantite ?? 0;

      // Incrémenter le stock (upsert au cas où le produit n'existe plus en stock)
      await client.query(
        `INSERT INTO stocks (produit_id,magasin_id,quantite,stock_alerte)
         VALUES ($1,$2,$3,5)
         ON CONFLICT (produit_id,magasin_id) DO UPDATE SET quantite=stocks.quantite+$3`,
        [l.produit_id, vente.magasin_id, l.quantite]
      );

      await client.query(
        `INSERT INTO mouvements_stock (produit_id,type,quantite,stock_avant,stock_apres,motif,ref_doc,magasin_id)
         VALUES ($1,'retour',$2,$3,$4,'Annulation vente',$5,$6)`,
        [l.produit_id, l.quantite, stock_avant, stock_avant + l.quantite, vente.numero, vente.magasin_id]
      );
    }

    // Marquer la vente comme annulée
    const { rows: [updated] } = await client.query(
      `UPDATE ventes SET statut_paiement='annulee', updated_at=NOW() WHERE id=$1 RETURNING *`, [id]
    );

    await client.query('COMMIT');
    ok(res, updated);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

export default router;
