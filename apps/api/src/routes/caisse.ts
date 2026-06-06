// ============================================================
// Routes — Caisse & Point de Vente
// ============================================================
import { Router } from 'express';
import { db }     from '../lib/db';
import { ok, fail, wrap } from '../lib/helpers';
import { requirePerm, scopeMagasin } from '../middleware/auth';
import { calculerTotauxVente } from '../lib/ventes-calc';

const router = Router();

// ── GET /api/caisse/caisses ──────────────────────────────────────
// Liste des caisses du magasin, avec leur session active si elle existe
router.get('/caisses', wrap(async (req, res) => {
  const magasin_id = scopeMagasin(req) ?? 1;

  const { rows } = await db.query(
    `SELECT
       c.id, c.nom, c.actif,
       sc.id              AS session_id,
       sc.statut          AS session_statut,
       sc.caissier_id     AS session_caissier_id,
       sc.fond_ouverture  AS session_fond,
       sc.nb_ventes       AS session_nb_ventes,
       sc.total_ventes    AS session_total,
       sc.ouvert_a        AS session_ouvert_a,
       u.prenom || ' ' || u.nom AS session_caissier_nom
     FROM caisses c
     LEFT JOIN sessions_caisse sc ON sc.caisse_id = c.id AND sc.statut = 'ouverte'
     LEFT JOIN utilisateurs u     ON u.id = sc.caissier_id
     WHERE c.magasin_id = $1 AND c.actif = TRUE
     ORDER BY c.id`,
    [magasin_id]
  );

  // Formatter pour le frontend
  const result = rows.map(r => ({
    id:    r.id,
    nom:   r.nom,
    actif: r.actif,
    session_active: r.session_id ? {
      id:            r.session_id,
      statut:        r.session_statut,
      caissier_id:   r.session_caissier_id,
      caissier_nom:  r.session_caissier_nom,
      fond_ouverture: r.session_fond,
      nb_ventes:     r.session_nb_ventes,
      total_ventes:  r.session_total,
      ouvert_a:      r.session_ouvert_a,
    } : null,
  }));

  ok(res, result);
}));

// ── GET /api/caisse/session-active ───────────────────────────────
// Session ouverte du caissier connecté (sur n'importe quelle caisse)
router.get('/session-active', wrap(async (req, res) => {
  const magasin_id  = scopeMagasin(req) ?? 1;
  const caissier_id = req.user!.sub;

  const { rows: [session] } = await db.query(
    `SELECT sc.*, u.prenom || ' ' || u.nom AS caissier_nom,
            mg.nom AS magasin_nom, c.nom AS caisse_nom
     FROM sessions_caisse sc
     JOIN utilisateurs u  ON u.id  = sc.caissier_id
     JOIN magasins     mg ON mg.id = sc.magasin_id
     LEFT JOIN caisses  c ON c.id  = sc.caisse_id
     WHERE sc.statut = 'ouverte'
       AND sc.magasin_id  = $1
       AND sc.caissier_id = $2
     ORDER BY sc.ouvert_a DESC LIMIT 1`,
    [magasin_id, caissier_id]
  );
  ok(res, session ?? null);
}));

// ── GET /api/caisse/sessions ─────────────────────────────────────
router.get('/sessions', wrap(async (req, res) => {
  const magasin_id = scopeMagasin(req);
  const { limit = '30', statut, caisse_id } = req.query as Record<string, string>;
  let q = `SELECT * FROM v_sessions_caisse WHERE 1=1`;
  const p: unknown[] = [];
  if (magasin_id) { p.push(magasin_id); q += ` AND magasin_id=$${p.length}`; }
  if (statut)     { p.push(statut);     q += ` AND statut=$${p.length}`; }
  if (caisse_id)  { p.push(+caisse_id); q += ` AND caisse_id=$${p.length}`; }
  p.push(+limit); q += ` ORDER BY ouvert_a DESC LIMIT $${p.length}`;
  const { rows } = await db.query(q, p);
  ok(res, rows);
}));

// ── GET /api/caisse/sessions/:id ─────────────────────────────────
router.get('/sessions/:id', wrap(async (req, res) => {
  const { rows: [session] } = await db.query(
    `SELECT * FROM v_sessions_caisse WHERE id=$1`, [req.params.id]
  );
  if (!session) return fail(res, 'Session introuvable', 404);

  const { rows: ventes } = await db.query(
    `SELECT v.id, v.numero, v.total_ttc, v.statut_paiement, v.date_vente,
            c.raison_sociale client_nom,
            COALESCE(
              json_agg(
                json_build_object('moyen', mp.nom, 'montant', vr.montant)
                ORDER BY vr.id
              ) FILTER (WHERE vr.id IS NOT NULL),
              '[]'
            ) AS reglements
     FROM ventes v
     JOIN clients c ON c.id = v.client_id
     LEFT JOIN ventes_reglements vr ON vr.vente_id = v.id
     LEFT JOIN moyens_paiement mp ON mp.id = vr.moyen_paiement_id
     WHERE v.session_caisse_id = $1
     GROUP BY v.id, c.raison_sociale
     ORDER BY v.date_vente DESC`,
    [req.params.id]
  );

  const { rows: parMoyen } = await db.query(
    `SELECT mp.nom moyen, COALESCE(SUM(vr.montant), 0) total
     FROM ventes v
     JOIN ventes_reglements vr ON vr.vente_id = v.id
     LEFT JOIN moyens_paiement mp ON mp.id = vr.moyen_paiement_id
     WHERE v.session_caisse_id = $1 AND v.statut_paiement <> 'annulee'
     GROUP BY mp.nom ORDER BY total DESC`,
    [req.params.id]
  );

  ok(res, { ...session, ventes, par_moyen: parMoyen });
}));

// ── POST /api/caisse/ouvrir ──────────────────────────────────────
router.post('/ouvrir', requirePerm('ventes'), wrap(async (req, res) => {
  const magasin_id  = scopeMagasin(req) ?? 1;
  const caissier_id = req.user!.sub;
  const { caisse_id, fond_ouverture = 0, notes } = req.body;

  if (!caisse_id) return fail(res, 'caisse_id requis', 400);

  // Vérifier que la caisse appartient bien au magasin
  const { rows: [caisse] } = await db.query(
    `SELECT id, nom FROM caisses WHERE id=$1 AND magasin_id=$2 AND actif=TRUE`,
    [caisse_id, magasin_id]
  );
  if (!caisse) return fail(res, 'Caisse introuvable', 404);

  // Vérifier qu'il n'y a pas déjà une session ouverte sur cette caisse
  const { rows: [existingOnCaisse] } = await db.query(
    `SELECT id, caissier_id FROM sessions_caisse
     WHERE caisse_id=$1 AND statut='ouverte'`,
    [caisse_id]
  );
  if (existingOnCaisse) {
    return fail(res, `La ${caisse.nom} est déjà ouverte par un autre caissier`, 409);
  }

  // Vérifier qu'il n'y a pas déjà une session ouverte pour ce caissier sur ce magasin
  const { rows: [existingForCaissier] } = await db.query(
    `SELECT id FROM sessions_caisse
     WHERE caissier_id=$1 AND magasin_id=$2 AND statut='ouverte'`,
    [caissier_id, magasin_id]
  );
  if (existingForCaissier) {
    return fail(res, 'Vous avez déjà une session ouverte sur ce magasin', 409);
  }

  const { rows: [session] } = await db.query(
    `INSERT INTO sessions_caisse
       (magasin_id, caissier_id, caisse_id, fond_ouverture, notes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [magasin_id, caissier_id, caisse_id, fond_ouverture, notes || null]
  );

  // Renvoyer avec caisse_nom
  ok(res, { ...session, caisse_nom: caisse.nom });
}));

// ── POST /api/caisse/fermer ──────────────────────────────────────
router.post('/fermer', requirePerm('ventes'), wrap(async (req, res) => {
  const magasin_id  = scopeMagasin(req) ?? 1;
  const caissier_id = req.user!.sub;
  const { montant_especes_reel, notes } = req.body;

  const cl = await db.connect();
  try {
    await cl.query('BEGIN');

    const { rows: [session] } = await cl.query(
      `SELECT sc.*, c.nom AS caisse_nom FROM sessions_caisse sc
       LEFT JOIN caisses c ON c.id = sc.caisse_id
       WHERE sc.caissier_id=$1 AND sc.magasin_id=$2 AND sc.statut='ouverte'
       FOR UPDATE`,
      [caissier_id, magasin_id]
    );
    if (!session) {
      await cl.query('ROLLBACK');
      return fail(res, 'Aucune session ouverte', 404);
    }

    // Calculer totaux réels depuis les ventes de la session
    const { rows: [totaux] } = await cl.query(
      `SELECT
         COUNT(*)::INT                                  AS nb_ventes,
         COALESCE(SUM(v.total_ttc),0)                  AS total_ventes,
         COALESCE(SUM(CASE WHEN mp.nom ILIKE '%espèces%' OR mp.nom ILIKE '%espece%' OR mp.nom ILIKE '%cash%'
                           THEN vr.montant ELSE 0 END), 0) AS total_especes
       FROM ventes v
       LEFT JOIN ventes_reglements vr ON vr.vente_id = v.id
       LEFT JOIN moyens_paiement mp ON mp.id = vr.moyen_paiement_id
       WHERE v.session_caisse_id = $1 AND v.statut_paiement <> 'annulee'`,
      [session.id]
    );

    const especes_attendu = Number(session.fond_ouverture) + Number(totaux.total_especes);
    const especes_reel    = montant_especes_reel != null ? Number(montant_especes_reel) : null;
    const ecart           = especes_reel != null ? especes_reel - especes_attendu : null;

    const { rows: [closed] } = await cl.query(
      `UPDATE sessions_caisse SET
         statut                  = 'fermee',
         ferme_a                 = NOW(),
         nb_ventes               = $2,
         total_ventes            = $3,
         montant_especes_attendu = $4,
         montant_especes_reel    = $5,
         ecart                   = $6,
         notes                   = COALESCE($7, notes)
       WHERE id = $1 RETURNING *`,
      [session.id, totaux.nb_ventes, totaux.total_ventes,
       especes_attendu, especes_reel, ecart, notes || null]
    );

    await cl.query('COMMIT');
    ok(res, { ...closed, caisse_nom: session.caisse_nom });
  } catch (e) {
    await cl.query('ROLLBACK'); throw e;
  } finally {
    cl.release();
  }
}));

// ── POST /api/caisse/vente-rapide ────────────────────────────────
router.post('/vente-rapide', requirePerm('ventes'), wrap(async (req, res) => {
  const magasin_id  = scopeMagasin(req) ?? 1;
  const caissier_id = req.user!.sub;
  const {
    client_id,
    lignes,
    reglements,
    remise_pct  = 0,
    tva_pct     = 18,
    notes,
  } = req.body;

  if (!lignes?.length)     return fail(res, 'Lignes requises', 400);
  if (!reglements?.length) return fail(res, 'Règlements requis', 400);

  const cl = await db.connect();
  try {
    await cl.query('BEGIN');

    // Si pas de client spécifié, utiliser le client "POS Comptoir"
    let finalClientId = client_id;
    if (!finalClientId) {
      const { rows: [posClient] } = await cl.query(
        `SELECT id FROM clients WHERE code IN ('POS-COMPTOIR', 'POS-ANONYMOUS') LIMIT 1`
      );
      if (!posClient) {
        await cl.query('ROLLBACK');
        return fail(res, 'Client POS non configuré. Créer un client "Vente au comptoir"', 500);
      }
      finalClientId = posClient.id;
    }

    // Session active du caissier
    const { rows: [session] } = await cl.query(
      `SELECT sc.id, sc.caisse_id, c.nom AS caisse_nom
       FROM sessions_caisse sc
       LEFT JOIN caisses c ON c.id = sc.caisse_id
       WHERE sc.caissier_id=$1 AND sc.magasin_id=$2 AND sc.statut='ouverte'
       LIMIT 1`,
      [caissier_id, magasin_id]
    );

    // Calcul totaux — TVA extraite « en dedans » (prix de vente = TTC).
    const { remise_montant, total_ttc, sous_total, tva_montant } =
      calculerTotauxVente(lignes, { remise_pct, tva_pct });
    const total_regle    = reglements.reduce((s: number, r: any) => s + Number(r.montant), 0);
    const solde_restant  = total_ttc - total_regle;
    const statut_paiement = solde_restant <= 0 ? 'paye' : total_regle > 0 ? 'partiel' : 'non_paye';

    // Numéro de vente
    const { rows: [{ max_id }] } = await cl.query(
      `SELECT COALESCE(MAX(id), 1000) AS max_id FROM ventes`
    );
    const numero = `VTE-${Number(max_id) + 1}`;

    // Créer la vente
    const { rows: [vente] } = await cl.query(
      `INSERT INTO ventes
       (numero,client_id,type_vente,date_vente,sous_total,remise_pct,remise_montant,
        tva_pct,tva_montant,total_ttc,montant_paye,solde_restant,statut_paiement,
        notes,magasin_id,session_caisse_id)
       VALUES ($1,$2,'detail',NOW(),$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [numero, finalClientId, sous_total, remise_pct, remise_montant,
       tva_pct, tva_montant, total_ttc, total_regle, solde_restant, statut_paiement,
       notes || null, magasin_id, session?.id ?? null]
    );

    // Lignes + mouvements stock
    for (const l of lignes) {
      const total_ligne = Math.round(l.quantite * l.prix_unitaire * (1 - (l.remise_pct ?? 0) / 100));
      await cl.query(
        `INSERT INTO ventes_lignes (vente_id,produit_id,quantite,prix_unitaire,remise_pct,total_ligne)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [vente.id, l.produit_id, l.quantite, l.prix_unitaire, l.remise_pct ?? 0, total_ligne]
      );

      const { rows: [stk] } = await cl.query(
        `SELECT s.quantite, p.designation FROM stocks s JOIN produits p ON p.id=s.produit_id
         WHERE s.produit_id=$1 AND s.magasin_id=$2 FOR UPDATE`,
        [l.produit_id, magasin_id]
      );
      if (!stk) throw Object.assign(new Error(`Produit #${l.produit_id} absent du stock`), { statusCode: 400 });
      const stockDispo = Number(stk.quantite);          // pg renvoie NUMERIC en string
      const qteVendue  = Number(l.quantite);
      if (stockDispo < qteVendue) throw Object.assign(
        new Error(`Stock insuffisant pour "${stk.designation}" (dispo: ${stockDispo})`),
        { statusCode: 400 }
      );

      await cl.query(
        `UPDATE stocks SET quantite=quantite-$1 WHERE produit_id=$2 AND magasin_id=$3`,
        [qteVendue, l.produit_id, magasin_id]
      );
      await cl.query(
        `INSERT INTO mouvements_stock (produit_id,type,quantite,stock_avant,stock_apres,motif,ref_doc,magasin_id)
         VALUES ($1,'sortie',$2,$3,$4,'Vente POS',$5,$6)`,
        [l.produit_id, qteVendue, stockDispo, stockDispo - qteVendue, numero, magasin_id]
      );
    }

    // Règlements
    const mpIds = reglements
      .filter((r: any) => r.moyen_paiement_id)
      .map((r: any) => Number(r.moyen_paiement_id));

    let especeIds = new Set<number>();
    if (mpIds.length > 0) {
      const { rows: mpRows } = await cl.query(
        `SELECT id FROM moyens_paiement WHERE id = ANY($1) AND nom ILIKE ANY(ARRAY['%espèces%','%espece%','%cash%'])`,
        [mpIds]
      );
      especeIds = new Set(mpRows.map((m: any) => m.id));
    }

    let especesVente = 0;
    for (const r of reglements) {
      if (!r.montant || r.montant <= 0) continue;
      await cl.query(
        `INSERT INTO ventes_reglements (vente_id, moyen_paiement_id, montant, reference)
         VALUES ($1, $2, $3, $4)`,
        [vente.id, r.moyen_paiement_id || null, r.montant, r.reference || null]
      );
      await cl.query(
        `INSERT INTO paiements (type_paiement,vente_id,client_id,montant,date_paiement,moyen_paiement_id,magasin_id)
         VALUES ('encaissement',$1,$2,$3,NOW(),$4,$5)`,
        [vente.id, finalClientId, r.montant, r.moyen_paiement_id || null, magasin_id]
      );
      if (especeIds.has(r.moyen_paiement_id)) {
        especesVente += Number(r.montant);
      }
    }

    // Mettre à jour les compteurs de la session
    if (session) {
      await cl.query(
        `UPDATE sessions_caisse SET
           nb_ventes               = nb_ventes + 1,
           total_ventes            = total_ventes + $2,
           montant_especes_attendu = montant_especes_attendu + $3
         WHERE id = $1`,
        [session.id, total_ttc, especesVente]
      );
    }

    await cl.query('COMMIT');
    ok(res, vente);
  } catch (e) {
    await cl.query('ROLLBACK'); throw e;
  } finally {
    cl.release();
  }
}));

// ── POST /api/caisse/caisses ─────────────────────────────────────
// Créer une nouvelle caisse pour le magasin
router.post('/caisses', requirePerm('admin'), wrap(async (req, res) => {
  const magasin_id = scopeMagasin(req) ?? 1;
  const { nom } = req.body;
  if (!nom?.trim()) return fail(res, 'Nom requis', 400);

  const { rows: [caisse] } = await db.query(
    `INSERT INTO caisses (magasin_id, nom) VALUES ($1, $2) RETURNING *`,
    [magasin_id, nom.trim()]
  );
  ok(res, caisse, 201);
}));

// ── PUT /api/caisse/caisses/:id ──────────────────────────────────
// Renommer / désactiver une caisse
router.put('/caisses/:id', requirePerm('admin'), wrap(async (req, res) => {
  const magasin_id = scopeMagasin(req) ?? 1;
  const { nom, actif } = req.body;

  const sets: string[] = [];
  const params: unknown[] = [req.params.id, magasin_id];
  if (nom  !== undefined) { params.push(nom.trim());  sets.push(`nom=$${params.length}`); }
  if (actif !== undefined){ params.push(actif);       sets.push(`actif=$${params.length}`); }
  if (!sets.length) return fail(res, 'Rien à modifier', 400);

  const { rows: [caisse] } = await db.query(
    `UPDATE caisses SET ${sets.join(',')} WHERE id=$1 AND magasin_id=$2 RETURNING *`,
    params
  );
  if (!caisse) return fail(res, 'Caisse introuvable', 404);
  ok(res, caisse);
}));

export default router;
