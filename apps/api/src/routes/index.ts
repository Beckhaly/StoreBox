// ============================================================
// Barrel — routes Express (toutes entités sauf auth + ventes)
// ============================================================
import { Router } from 'express';
import { db }     from '../lib/db';
import { ok, fail, wrap } from '../lib/helpers';
import { requirePerm, requireRole, scopeMagasin } from '../middleware/auth';
import { NotificationService }      from '../services/notifications';
import { genererFacture, genererDevis, genererReleveClient } from '../services/pdf';
import referentielsGeneriqueRouter from './referentiels';
import societeRouterImport from './societe';

const notif = new NotificationService();

// ─── RÉFÉRENTIELS GÉNÉRIQUES (via router séparé) ──
export const referentielsRouter = referentielsGeneriqueRouter;

// ─── PARAMÈTRES SOCIÉTÉ ───────────────────────────────────
export const societeRouter = societeRouterImport;

// ─── DASHBOARD ───────────────────────────────────────────────
export const dashboardRouter = Router();
dashboardRouter.get('/', wrap(async (req, res) => {
  const magasin_id = scopeMagasin(req);
  const mf = magasin_id ? `AND magasin_id=${magasin_id}` : '';
  const [ca, creances, dettes, treso, stock, top, chart] = await Promise.all([
    db.query(`SELECT COALESCE(SUM(total_ttc),0) ca_mois, COUNT(*) nb_ventes FROM ventes WHERE date_vente>=date_trunc('month',CURRENT_DATE) ${mf}`),
    db.query(`SELECT COALESCE(SUM(solde_restant),0) total, COALESCE(SUM(CASE WHEN categorie_echeance IN('echu_30j','echu_60j','contentieux') THEN solde_restant END),0) en_retard FROM v_creances_clients ${magasin_id ? `WHERE magasin_id=${magasin_id}` : ''}`),
    db.query(`SELECT COALESCE(SUM(solde_restant),0) total, COALESCE(SUM(CASE WHEN date_echeance<=CURRENT_DATE+5 THEN solde_restant END),0) urgent FROM v_dettes_fournisseurs ${magasin_id ? `WHERE magasin_id=${magasin_id}` : ''}`),
    db.query(`SELECT COALESCE(SUM(CASE WHEN type_paiement='encaissement' THEN montant END),0) entrees, COALESCE(SUM(CASE WHEN type_paiement='decaissement' THEN montant END),0) sorties FROM paiements WHERE date_paiement>=date_trunc('month',CURRENT_DATE) ${mf}`),
    magasin_id
      ? db.query(`SELECT COUNT(CASE WHEN quantite=0 THEN 1 END) ruptures, COUNT(CASE WHEN alerte_stock AND quantite>0 THEN 1 END) alertes FROM v_stocks WHERE actif=TRUE AND magasin_id=${magasin_id}`)
      : db.query(`SELECT COUNT(CASE WHEN quantite_totale=0 THEN 1 END) ruptures, COUNT(CASE WHEN alerte_stock AND quantite_totale>0 THEN 1 END) alertes FROM v_stocks_consolide WHERE actif=TRUE`),
    db.query(`SELECT p.designation,p.reference,SUM(vl.quantite) qte_vendue,SUM(vl.total_ligne) ca_genere FROM ventes_lignes vl JOIN ventes v ON v.id=vl.vente_id JOIN produits p ON p.id=vl.produit_id WHERE v.date_vente>=date_trunc('month',CURRENT_DATE) ${mf} GROUP BY p.id ORDER BY ca_genere DESC LIMIT 5`),
    db.query(`SELECT to_char(date_trunc('month',date_vente),'Mon YY') mois, SUM(CASE WHEN type_vente='gros' THEN total_ttc ELSE 0 END) gros, SUM(CASE WHEN type_vente='detail' THEN total_ttc ELSE 0 END) detail FROM ventes WHERE date_vente>=CURRENT_DATE-INTERVAL '6 months' ${mf} GROUP BY 1 ORDER BY MIN(date_vente)`),
  ]);
  const t = treso.rows[0] as { entrees: string; sorties: string };
  ok(res, { ca: ca.rows[0], creances: creances.rows[0], dettes: dettes.rows[0],
            tresorerie: { ...t, net: +t.entrees - +t.sorties },
            stock: stock.rows[0], topProduits: top.rows, caChart: chart.rows,
            magasin_id });
}));

// ─── PRODUITS ────────────────────────────────────────────────
export const produitsRouter = Router();
produitsRouter.get('/', wrap(async (req, res) => {
  const { search = '', marque, stock_alerte } = req.query as Record<string, string>;
  const magasin_id = scopeMagasin(req);
  // Jointure avec stocks pour retourner le stock réel (pas produits.stock qui est figé)
  const stockJoin = magasin_id
    ? `LEFT JOIN stocks s ON s.produit_id=p.id AND s.magasin_id=${magasin_id}`
    : `LEFT JOIN (SELECT produit_id, SUM(quantite) quantite, MIN(stock_alerte) stock_alerte FROM stocks GROUP BY produit_id) s ON s.produit_id=p.id`;
  let q = `SELECT p.*,COALESCE(s.quantite,0) AS stock,m.nom marque,m.id marque_id_sel,c.libelle categorie,c.id categorie_id_sel,
      u.code AS unite_code, u.libelle AS unite_libelle, u.decimales AS unite_decimales,
      (SELECT COALESCE(JSON_AGG(
         JSON_BUILD_OBJECT('id',pp.id,'categorie_prix_id',pp.categorie_prix_id,
           'code',cp.code,'libelle',cp.libelle,'ordre',cp.ordre,'prix',pp.prix,
           'paliers',(SELECT COALESCE(JSON_AGG(pl ORDER BY pl.qte_min),'[]'::json)
                      FROM prix_paliers pl WHERE pl.produit_prix_id=pp.id))
         ORDER BY cp.ordre),'[]'::json)
       FROM produits_prix pp JOIN categories_prix cp ON cp.id=pp.categorie_prix_id
       WHERE pp.produit_id=p.id AND pp.actif=TRUE) AS categories_prix
    FROM produits p
    ${stockJoin}
    LEFT JOIN marques m ON m.id=p.marque_id
    LEFT JOIN categories c ON c.id=p.categorie_id
    LEFT JOIN unites_mesure u ON u.id=p.unite_id
    WHERE p.actif=TRUE`;
  const p: unknown[] = [];
  if (search) { p.push(`%${search}%`); q += ` AND (p.designation ILIKE $${p.length} OR p.reference ILIKE $${p.length})`; }
  if (marque) { p.push(marque); q += ` AND m.nom=$${p.length}`; }
  if (stock_alerte === '1') q += ` AND COALESCE(s.quantite,0)<p.stock_alerte`;
  q += ' ORDER BY p.designation';
  const { rows } = await db.query(q, p);
  ok(res, rows);
}));
produitsRouter.post('/', requirePerm('produits'), wrap(async (req, res) => {
  const { reference, designation, marque_id, categorie_id, prix_achat, prix_gros, prix_detail,
    qte_min_gros = 5, stock = 0, stock_alerte = 10, stock_max = 500,
    unite_id = null, vendu_au_poids = false, prix_modifiable = false,
    gere_peremption = false, gere_lot = false, facteur_gros = 1 } = req.body;
  const { rows } = await db.query(
    `INSERT INTO produits (reference,designation,marque_id,categorie_id,prix_achat,prix_gros,prix_detail,qte_min_gros,stock,stock_alerte,stock_max,
       unite_id,vendu_au_poids,prix_modifiable,gere_peremption,gere_lot,facteur_gros)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
    [reference, designation, marque_id || null, categorie_id || null, prix_achat, prix_gros, prix_detail, qte_min_gros, stock, stock_alerte, stock_max,
     unite_id || null, vendu_au_poids, prix_modifiable, gere_peremption, gere_lot, facteur_gros]);
  ok(res, rows[0]);
}));
produitsRouter.put('/:id', requirePerm('produits'), wrap(async (req, res) => {
  const { designation, reference, marque_id, categorie_id, prix_achat, prix_gros, prix_detail, qte_min_gros, stock_alerte, stock_max,
    unite_id = null, vendu_au_poids = false, prix_modifiable = false,
    gere_peremption = false, gere_lot = false, facteur_gros = 1 } = req.body;
  const { rows } = await db.query(
    `UPDATE produits SET designation=$1,reference=$2,marque_id=$3,categorie_id=$4,prix_achat=$5,prix_gros=$6,prix_detail=$7,qte_min_gros=$8,stock_alerte=$9,stock_max=$10,
       unite_id=$11,vendu_au_poids=$12,prix_modifiable=$13,gere_peremption=$14,gere_lot=$15,facteur_gros=$16,updated_at=NOW() WHERE id=$17 RETURNING *`,
    [designation, reference, marque_id || null, categorie_id || null, prix_achat, prix_gros, prix_detail, qte_min_gros, stock_alerte, stock_max,
     unite_id || null, vendu_au_poids, prix_modifiable, gere_peremption, gere_lot, facteur_gros, req.params.id]);
  if (!rows.length) return fail(res, 'Produit non trouvé', 404);
  ok(res, rows[0]);
}));
produitsRouter.delete('/:id', requirePerm('produits'), wrap(async (req, res) => {
  await db.query(`UPDATE produits SET actif=FALSE,updated_at=NOW() WHERE id=$1`, [req.params.id]);
  ok(res, { id: +req.params.id });
}));

// GET /produits/categories-prix — référentiel des catégories de prix
produitsRouter.get('/categories-prix', wrap(async (_req, res) => {
  const { rows } = await db.query('SELECT * FROM categories_prix WHERE actif=TRUE ORDER BY ordre,libelle');
  ok(res, rows);
}));

// PUT /produits/:id/prix — remplace toutes les catégories de prix + paliers d'un produit
produitsRouter.put('/:id/prix', requirePerm('produits'), wrap(async (req, res) => {
  const produit_id = +req.params.id;
  const categories: any[] = req.body.categories ?? [];
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    // Supprimer les anciens prix (CASCADE supprime aussi les paliers)
    await client.query('DELETE FROM produits_prix WHERE produit_id=$1', [produit_id]);
    for (const cat of categories) {
      if (!cat.categorie_prix_id || cat.prix == null) continue;
      const { rows: [pp] } = await client.query(
        `INSERT INTO produits_prix (produit_id,categorie_prix_id,prix) VALUES ($1,$2,$3) RETURNING id`,
        [produit_id, cat.categorie_prix_id, cat.prix]
      );
      for (const pl of (cat.paliers ?? [])) {
        if (!pl.qte_min || pl.prix == null) continue;
        await client.query(
          `INSERT INTO prix_paliers (produit_prix_id,qte_min,qte_max,prix) VALUES ($1,$2,$3,$4)`,
          [pp.id, pl.qte_min, pl.qte_max ?? null, pl.prix]
        );
      }
    }
    await client.query('COMMIT');
    const { rows } = await db.query(
      `SELECT pp.*,cp.code,cp.libelle,cp.ordre,
         (SELECT COALESCE(JSON_AGG(pl ORDER BY pl.qte_min),'[]'::json) FROM prix_paliers pl WHERE pl.produit_prix_id=pp.id) AS paliers
       FROM produits_prix pp JOIN categories_prix cp ON cp.id=pp.categorie_prix_id
       WHERE pp.produit_id=$1 AND pp.actif=TRUE ORDER BY cp.ordre`,
      [produit_id]
    );
    ok(res, rows);
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// ─── CLIENTS ─────────────────────────────────────────────────
export const clientsRouter = Router();
clientsRouter.get('/', wrap(async (req, res) => {
  const { type, statut, search } = req.query as Record<string, string>;
  let q = `SELECT c.*,COALESCE(SUM(v.total_ttc),0) ca_total,COALESCE(SUM(v.solde_restant),0)+c.solde_initial encours_creance,MAX(v.date_vente) derniere_vente FROM clients c LEFT JOIN ventes v ON v.client_id=c.id WHERE 1=1`;
  const p: unknown[] = [];
  if (type)   { p.push(type);          q += ` AND c.type_client=$${p.length}`; }
  if (statut) { p.push(statut);        q += ` AND c.statut=$${p.length}`; }
  if (search) { p.push(`%${search}%`); q += ` AND c.raison_sociale ILIKE $${p.length}`; }
  q += ' GROUP BY c.id ORDER BY c.raison_sociale';
  const { rows } = await db.query(q, p);
  ok(res, rows);
}));
clientsRouter.get('/:id', wrap(async (req, res) => {
  const [cli, ventes, creances] = await Promise.all([
    db.query(`SELECT * FROM clients WHERE id=$1`, [req.params.id]),
    db.query(`SELECT v.*,mp.nom moyen_paiement FROM ventes v LEFT JOIN moyens_paiement mp ON mp.id=v.moyen_paiement_id WHERE v.client_id=$1 ORDER BY v.date_vente DESC LIMIT 20`, [req.params.id]),
    db.query(`SELECT * FROM v_creances_clients WHERE client_id=$1`, [req.params.id]),
  ]);
  if (!cli.rows.length) return fail(res, 'Client non trouvé', 404);
  ok(res, { ...cli.rows[0], historique_ventes: ventes.rows, creances: creances.rows });
}));
clientsRouter.post('/', requirePerm('clients'), wrap(async (req, res) => {
  const { code,type_client,raison_sociale,contact_nom,telephone,email,adresse,ville,plafond_credit,delai_paiement,solde_initial } = req.body;
  const { rows } = await db.query(
    `INSERT INTO clients (code,type_client,raison_sociale,contact_nom,telephone,email,adresse,ville,plafond_credit,delai_paiement,solde_initial) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [code,type_client,raison_sociale,contact_nom,telephone,email,adresse,ville,plafond_credit??0,delai_paiement??0,solde_initial??0]);
  ok(res, rows[0]);
}));
clientsRouter.put('/:id', requirePerm('clients'), wrap(async (req, res) => {
  const { type_client,raison_sociale,contact_nom,telephone,email,adresse,ville,plafond_credit,delai_paiement,statut,solde_initial } = req.body;
  const { rows } = await db.query(
    `UPDATE clients SET type_client=$1,raison_sociale=$2,contact_nom=$3,telephone=$4,email=$5,adresse=$6,ville=$7,plafond_credit=$8,delai_paiement=$9,statut=$10,solde_initial=$11 WHERE id=$12 RETURNING *`,
    [type_client,raison_sociale,contact_nom,telephone,email,adresse,ville,plafond_credit??0,delai_paiement??0,statut??'actif',solde_initial??0,req.params.id]);
  if (!rows.length) return fail(res, 'Client non trouvé', 404);
  ok(res, rows[0]);
}));
clientsRouter.delete('/:id', requirePerm('clients'), wrap(async (req, res) => {
  await db.query(`UPDATE clients SET statut='inactif' WHERE id=$1`, [req.params.id]);
  ok(res, { id: +req.params.id });
}));

// ─── CRÉANCES ────────────────────────────────────────────────
export const creancesRouter = Router();
creancesRouter.get('/', wrap(async (req, res) => {
  const { categorie, client_id } = req.query as Record<string, string>;
  const magasin_id = scopeMagasin(req);
  let q = `SELECT * FROM v_creances_clients WHERE 1=1`;
  const p: unknown[] = [];
  if (magasin_id) { p.push(magasin_id); q += ` AND magasin_id=$${p.length}`; }
  if (categorie)  { p.push(categorie);  q += ` AND categorie_echeance=$${p.length}`; }
  if (client_id)  { p.push(+client_id); q += ` AND client_id=$${p.length}`; }
  q += ' ORDER BY jours_retard DESC NULLS LAST';
  const mf = magasin_id ? `WHERE magasin_id=${magasin_id}` : '';
  const [{ rows }, { rows: [ag] }] = await Promise.all([
    db.query(q, p),
    db.query(`SELECT COALESCE(SUM(solde_restant),0) total,COALESCE(SUM(CASE WHEN categorie_echeance='non_echu' THEN solde_restant END),0) non_echu,COALESCE(SUM(CASE WHEN categorie_echeance='echu_30j' THEN solde_restant END),0) echu_30j,COALESCE(SUM(CASE WHEN categorie_echeance='echu_60j' THEN solde_restant END),0) echu_60j,COALESCE(SUM(CASE WHEN categorie_echeance='contentieux' THEN solde_restant END),0) contentieux FROM v_creances_clients ${mf}`),
  ]);
  ok(res, { creances: rows, ageing: ag });
}));

// ─── DETTES ──────────────────────────────────────────────────
export const dettesRouter = Router();
dettesRouter.get('/', wrap(async (req, res) => {
  const magasin_id = scopeMagasin(req);
  const mf = magasin_id ? `WHERE magasin_id=${magasin_id}` : '';
  const [{ rows }, { rows: [total] }] = await Promise.all([
    db.query(`SELECT * FROM v_dettes_fournisseurs ${mf} ORDER BY jours_retard DESC NULLS LAST,date_echeance`),
    db.query(`SELECT COALESCE(SUM(solde_restant),0) total,COALESCE(SUM(CASE WHEN date_echeance<=CURRENT_DATE THEN solde_restant END),0) echu,COALESCE(SUM(CASE WHEN date_echeance BETWEEN CURRENT_DATE+1 AND CURRENT_DATE+15 THEN solde_restant END),0) urgent FROM v_dettes_fournisseurs ${mf}`),
  ]);
  ok(res, { dettes: rows, total });
}));

// ─── ÉCHÉANCES ────────────────────────────────────────────────
export const echeancesRouter = Router();
echeancesRouter.get('/', wrap(async (req, res) => {
  const magasin_id = scopeMagasin(req);
  const mf = magasin_id ? `WHERE magasin_id=${magasin_id}` : '';
  const { rows } = await db.query(`SELECT * FROM v_echeances_30j ${mf} ORDER BY date_echeance`);
  ok(res, rows);
}));

echeancesRouter.post('/', requirePerm('paiements'), wrap(async (req, res) => {
  const { sens, tiers, montant, date_echeance, description } = req.body;
  if (!tiers || !montant || !date_echeance) return fail(res, 'Tiers, montant et date requis');
  const { rows } = await db.query(
    `INSERT INTO echeances_manuelles (sens, tiers, montant, date_echeance, description)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [sens || 'autre', tiers, montant, date_echeance, description || null]
  );
  ok(res, rows[0]);
}));

echeancesRouter.put('/:id/statut', requirePerm('paiements'), wrap(async (req, res) => {
  const { statut } = req.body;
  if (!['en_attente', 'payee', 'annulee'].includes(statut)) return fail(res, 'Statut invalide');
  const { rows } = await db.query(
    `UPDATE echeances_manuelles SET statut = $1 WHERE id = $2 RETURNING *`,
    [statut, req.params.id]
  );
  if (!rows.length) return fail(res, 'Échéance introuvable', 404);
  ok(res, rows[0]);
}));

echeancesRouter.delete('/:id', requirePerm('paiements'), wrap(async (req, res) => {
  await db.query(`DELETE FROM echeances_manuelles WHERE id = $1`, [req.params.id]);
  ok(res, null);
}));

// ─── PAIEMENTS ────────────────────────────────────────────────
export const paiementsRouter = Router();
paiementsRouter.get('/', wrap(async (req, res) => {
  const { vente_id, achat_id, client_id, fournisseur_id } = req.query as Record<string, string>;
  let q = `SELECT p.*,mp.nom moyen_paiement FROM paiements p LEFT JOIN moyens_paiement mp ON mp.id=p.moyen_paiement_id WHERE 1=1`;
  const params: unknown[] = [];
  if (vente_id)       { params.push(+vente_id);       q += ` AND p.vente_id=$${params.length}`; }
  if (achat_id)       { params.push(+achat_id);        q += ` AND p.achat_id=$${params.length}`; }
  if (client_id)      { params.push(+client_id);      q += ` AND p.client_id=$${params.length}`; }
  if (fournisseur_id) { params.push(+fournisseur_id); q += ` AND p.fournisseur_id=$${params.length}`; }
  q += ' ORDER BY p.date_paiement DESC LIMIT 100';
  const { rows } = await db.query(q, params);
  ok(res, rows);
}));
paiementsRouter.post('/', requirePerm('paiements'), wrap(async (req, res) => {
  const { type_paiement,vente_id,achat_id,montant,date_paiement,moyen_paiement_id,reference,notes,envoyer_confirmation=true } = req.body;
  const client_id      = vente_id ? (await db.query(`SELECT client_id FROM ventes WHERE id=$1`,[vente_id])).rows[0]?.client_id : null;
  const fournisseur_id = achat_id ? (await db.query(`SELECT fournisseur_id FROM achats WHERE id=$1`,[achat_id])).rows[0]?.fournisseur_id : null;
  const { rows } = await db.query(
    `INSERT INTO paiements (type_paiement,vente_id,achat_id,client_id,fournisseur_id,montant,date_paiement,moyen_paiement_id,reference,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [type_paiement,vente_id,achat_id,client_id,fournisseur_id,montant,date_paiement??new Date(),moyen_paiement_id,reference,notes]);
  if (envoyer_confirmation && vente_id && type_paiement === 'encaissement') {
    const [{ rows: [v] },{ rows: [c] }] = await Promise.all([
      db.query(`SELECT * FROM ventes WHERE id=$1`,[vente_id]),
      client_id ? db.query(`SELECT * FROM clients WHERE id=$1`,[client_id]) : Promise.resolve({ rows: [null] }),
    ]);
    if (v && c) notif.confirmerPaiement(db, rows[0], v, c).catch(() => {});
  }
  ok(res, rows[0]);
}));

// ─── FOURNISSEURS ─────────────────────────────────────────────
export const fournisseursRouter = Router();
fournisseursRouter.get('/', wrap(async (_, res) => {
  const { rows } = await db.query(`SELECT f.*,COALESCE(SUM(a.total_ttc),0) total_achats,COALESCE(SUM(a.solde_restant),0)+f.solde_initial encours_dette FROM fournisseurs f LEFT JOIN achats a ON a.fournisseur_id=f.id WHERE f.actif=TRUE GROUP BY f.id ORDER BY f.raison_sociale`);
  ok(res, rows);
}));
fournisseursRouter.post('/', requirePerm('clients'), wrap(async (req, res) => {
  const { code, raison_sociale, contact_nom, telephone, email, adresse, pays = "Côte d'Ivoire", delai_paiement = 30, conditions, solde_initial } = req.body;
  const { rows } = await db.query(
    `INSERT INTO fournisseurs (code,raison_sociale,contact_nom,telephone,email,adresse,pays,delai_paiement,conditions,solde_initial) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [code, raison_sociale, contact_nom, telephone, email, adresse, pays, delai_paiement, conditions || null, solde_initial ?? 0]);
  ok(res, rows[0]);
}));
fournisseursRouter.put('/:id', requirePerm('clients'), wrap(async (req, res) => {
  const { raison_sociale, contact_nom, telephone, email, adresse, pays, delai_paiement, conditions, solde_initial } = req.body;
  const { rows } = await db.query(
    `UPDATE fournisseurs SET raison_sociale=$1,contact_nom=$2,telephone=$3,email=$4,adresse=$5,pays=$6,delai_paiement=$7,conditions=$8,solde_initial=$9 WHERE id=$10 RETURNING *`,
    [raison_sociale, contact_nom, telephone, email, adresse, pays, delai_paiement, conditions || null, solde_initial ?? 0, req.params.id]);
  if (!rows.length) return fail(res, 'Fournisseur non trouvé', 404);
  ok(res, rows[0]);
}));
fournisseursRouter.delete('/:id', requirePerm('clients'), wrap(async (req, res) => {
  await db.query(`UPDATE fournisseurs SET actif=FALSE WHERE id=$1`, [req.params.id]);
  ok(res, { id: +req.params.id });
}));

// ─── ACHATS ──────────────────────────────────────────────────
export const achatsRouter = Router();
achatsRouter.get('/', wrap(async (req, res) => {
  const { fournisseur_id } = req.query as Record<string, string>;
  const magasin_id = scopeMagasin(req);
  let q = `SELECT a.*,f.raison_sociale fournisseur_nom,mg.nom magasin_nom FROM achats a JOIN fournisseurs f ON f.id=a.fournisseur_id LEFT JOIN magasins mg ON mg.id=a.magasin_id WHERE 1=1`;
  const p: unknown[] = [];
  if (magasin_id)    { p.push(magasin_id);     q += ` AND a.magasin_id=$${p.length}`; }
  if (fournisseur_id){ p.push(+fournisseur_id); q += ` AND a.fournisseur_id=$${p.length}`; }
  q += ' ORDER BY a.date_achat DESC LIMIT 100';
  const { rows } = await db.query(q, p);
  ok(res, rows);
}));
achatsRouter.get('/:id', wrap(async (req, res) => {
  const [achat, lignes, paiements] = await Promise.all([
    db.query(`SELECT a.*,f.raison_sociale fournisseur_nom,f.telephone fournisseur_tel,mg.nom magasin_nom FROM achats a JOIN fournisseurs f ON f.id=a.fournisseur_id LEFT JOIN magasins mg ON mg.id=a.magasin_id WHERE a.id=$1`, [req.params.id]),
    db.query(`SELECT al.*,p.designation,p.reference FROM achats_lignes al JOIN produits p ON p.id=al.produit_id WHERE al.achat_id=$1`, [req.params.id]),
    db.query(`SELECT p.*,mp.nom moyen FROM paiements p LEFT JOIN moyens_paiement mp ON mp.id=p.moyen_paiement_id WHERE p.achat_id=$1 ORDER BY p.date_paiement`, [req.params.id]),
  ]);
  if (!achat.rows.length) return fail(res, 'Achat non trouvé', 404);
  ok(res, { ...achat.rows[0], lignes: lignes.rows, paiements: paiements.rows });
}));
achatsRouter.post('/', requirePerm('ventes'), wrap(async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { fournisseur_id, date_achat, date_echeance, lignes, reference_frs, notes, montant_paye_immediat = 0, tva_pct = 18, moyen_paiement_id } = req.body;
    const magasin_id = scopeMagasin(req) ?? 1;
    const { rows: [{ max_id }] } = await client.query(`SELECT COALESCE(MAX(id),2000) max_id FROM achats`);
    const numero = `ACH-${Number(max_id) + 1}`;
    const total_ht = lignes.reduce((s: number, l: any) => s + l.quantite * l.prix_unitaire, 0);
    const tva_montant = Math.round(total_ht * tva_pct / 100);
    const total_ttc = total_ht + tva_montant;
    const solde_restant = total_ttc - montant_paye_immediat;
    const statut_paiement = solde_restant <= 0 ? 'paye' : montant_paye_immediat > 0 ? 'partiel' : 'non_paye';
    const { rows: [achat] } = await client.query(
      `INSERT INTO achats (numero,fournisseur_id,date_achat,date_echeance,total_ht,tva_montant,total_ttc,montant_paye,solde_restant,statut_paiement,reference_frs,notes,magasin_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [numero, fournisseur_id, date_achat??new Date(), date_echeance, total_ht, tva_montant, total_ttc, montant_paye_immediat, solde_restant, statut_paiement, reference_frs, notes, magasin_id]);
    for (const l of lignes) {
      await client.query(`INSERT INTO achats_lignes (achat_id,produit_id,quantite,prix_unitaire,total_ligne) VALUES ($1,$2,$3,$4,$5)`,
        [achat.id, l.produit_id, l.quantite, l.prix_unitaire, l.quantite * l.prix_unitaire]);
      const { rows:[stk] } = await client.query(
        `SELECT COALESCE(quantite,0) AS quantite FROM stocks WHERE produit_id=$1 AND magasin_id=$2`,
        [l.produit_id, magasin_id]);
      const stock_avant = stk?.quantite ?? 0;
      await client.query(
        `INSERT INTO stocks (produit_id,magasin_id,quantite,stock_alerte) VALUES ($1,$2,$3,5)
         ON CONFLICT (produit_id,magasin_id) DO UPDATE SET quantite=stocks.quantite+$3`,
        [l.produit_id, magasin_id, l.quantite]);
      await client.query(
        `INSERT INTO mouvements_stock (produit_id,type,quantite,stock_avant,stock_apres,motif,ref_doc,magasin_id) VALUES ($1,'entree',$2,$3,$4,'Achat fournisseur',$5,$6)`,
        [l.produit_id, l.quantite, stock_avant, stock_avant+l.quantite, numero, magasin_id]);
    }
    if (montant_paye_immediat > 0) {
      await client.query(
        `INSERT INTO paiements (type_paiement,achat_id,fournisseur_id,montant,date_paiement,moyen_paiement_id,magasin_id) VALUES ('decaissement',$1,$2,$3,CURRENT_DATE,$4,$5)`,
        [achat.id, fournisseur_id, montant_paye_immediat, moyen_paiement_id || null, magasin_id]);
    }
    await client.query('COMMIT');
    ok(res, achat);
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));

// ─── RAPPORTS ────────────────────────────────────────────────
export const rapportsRouter = Router();
rapportsRouter.get('/performance', wrap(async (req, res) => {
  const { mois = '4', annee = '2026' } = req.query as Record<string, string>;
  const debut = `${annee}-${mois.padStart(2,'0')}-01`;
  const magasin_id = scopeMagasin(req);
  const mf = magasin_id ? `AND magasin_id=${magasin_id}` : '';
  const [caGlobal,parType,topClients,dso,kpi] = await Promise.all([
    db.query(`SELECT to_char(date_trunc('month',date_vente),'Mon YY') m,SUM(total_ttc) ca,COUNT(*) nb FROM ventes WHERE date_vente>=CURRENT_DATE-INTERVAL '6 months' ${mf} GROUP BY 1 ORDER BY MIN(date_vente)`),
    db.query(`SELECT type_vente,SUM(total_ttc) ca,COUNT(*) nb FROM ventes WHERE date_vente>=$1 ${mf} GROUP BY type_vente`,[debut]),
    db.query(`SELECT c.raison_sociale,SUM(v.total_ttc) ca FROM ventes v JOIN clients c ON c.id=v.client_id WHERE 1=1 ${mf} GROUP BY c.id ORDER BY ca DESC LIMIT 10`),
    db.query(`SELECT ROUND((SELECT COALESCE(SUM(solde_restant),1) FROM ventes WHERE solde_restant>0 ${mf})/NULLIF((SELECT COALESCE(SUM(total_ttc),1) FROM ventes WHERE date_vente>=CURRENT_DATE-30 ${mf}),0)*30) dso`),
    db.query(`SELECT COALESCE(SUM(total_ttc),0) ca_mois,COALESCE(SUM(total_ttc-(SELECT COALESCE(SUM(vl2.quantite*p2.prix_achat),0) FROM ventes_lignes vl2 JOIN produits p2 ON p2.id=vl2.produit_id WHERE vl2.vente_id=v.id)),0) marge_brute FROM ventes v WHERE date_vente>=$1 ${mf}`,[debut]),
  ]);
  ok(res, { caGlobal:caGlobal.rows,parType:parType.rows,topClients:topClients.rows,dso:dso.rows[0],kpi:kpi.rows[0] });
}));

// ─── Clients ──────────────────────────────────────────────────
rapportsRouter.get('/clients', wrap(async (req, res) => {
  const magasin_id = scopeMagasin(req);
  const mf = magasin_id ? `AND v.magasin_id=${magasin_id}` : '';
  const mfVc = magasin_id ? `AND magasin_id=${magasin_id}` : '';
  const [clients, ageing, debiteurs] = await Promise.all([
    db.query(`
      SELECT c.id, c.raison_sociale,
        COALESCE(SUM(v.total_ttc),0) ca_total,
        COALESCE(SUM(v.solde_restant),0) creances,
        CASE WHEN COALESCE(SUM(v.solde_restant),0)>0 THEN 'actif' ELSE 'ok' END statut
      FROM clients c LEFT JOIN ventes v ON v.client_id=c.id AND TRUE ${mf}
      WHERE c.actif=TRUE GROUP BY c.id ORDER BY ca_total DESC LIMIT 100
    `),
    db.query(`
      SELECT
        COALESCE(SUM(CASE WHEN categorie_echeance='non_echu' THEN solde_restant ELSE 0 END),0) non_echu,
        COALESCE(SUM(CASE WHEN categorie_echeance='echu_30j' THEN solde_restant ELSE 0 END),0) echu_30,
        COALESCE(SUM(CASE WHEN categorie_echeance='echu_60j' THEN solde_restant ELSE 0 END),0) echu_60,
        COALESCE(SUM(CASE WHEN categorie_echeance='contentieux' THEN solde_restant ELSE 0 END),0) contentieux
      FROM v_creances_clients WHERE 1=1 ${mfVc}
    `),
    db.query(`
      SELECT c.raison_sociale, solde_restant creances, EXTRACT(DAY FROM CURRENT_DATE-date_echeance) jours_retard
      FROM v_creances_clients vc JOIN clients c ON c.id=vc.client_id
      WHERE vc.categorie_echeance IN('echu_30j','echu_60j','contentieux') ${mfVc}
      ORDER BY jours_retard DESC LIMIT 20
    `),
  ]);
  ok(res, { clients: clients.rows, ageing: ageing.rows[0], debiteurs: debiteurs.rows });
}));

// ─── Fournisseurs ─────────────────────────────────────────────
rapportsRouter.get('/fournisseurs', wrap(async (req, res) => {
  const magasin_id = scopeMagasin(req);
  const mf = magasin_id ? `AND a.magasin_id=${magasin_id}` : '';
  const mfVd = magasin_id ? `AND magasin_id=${magasin_id}` : '';
  const [fournisseurs, dettes_urgentes] = await Promise.all([
    db.query(`
      SELECT f.id, f.raison_sociale,
        COALESCE(SUM(a.solde_restant),0) dettes,
        CASE WHEN COALESCE(SUM(a.solde_restant),0)>0 THEN 'actif' ELSE 'OK' END statut
      FROM fournisseurs f LEFT JOIN achats a ON a.fournisseur_id=f.id AND TRUE ${mf}
      WHERE f.actif=TRUE GROUP BY f.id ORDER BY dettes DESC
    `),
    db.query(`
      SELECT f.raison_sociale, solde_restant dettes, EXTRACT(DAY FROM date_echeance-CURRENT_DATE) jours_echéance
      FROM v_dettes_fournisseurs vd JOIN fournisseurs f ON f.id=vd.fournisseur_id
      WHERE vd.date_echeance<=CURRENT_DATE+7 AND vd.solde_restant>0 ${mfVd}
      ORDER BY jours_echéance ASC LIMIT 15
    `),
  ]);
  ok(res, { fournisseurs: fournisseurs.rows, dettes_urgentes: dettes_urgentes.rows });
}));

// ─── Vendeurs ─────────────────────────────────────────────────
rapportsRouter.get('/vendeurs', wrap(async (req, res) => {
  const magasin_id = scopeMagasin(req);
  const mf = magasin_id ? `AND v.magasin_id=${magasin_id}` : '';
  const mfRaw = magasin_id ? `AND magasin_id=${magasin_id}` : '';
  const [vendeurs, performance, cumul] = await Promise.all([
    db.query(`
      SELECT u.id, u.nom,
        COALESCE(SUM(v.total_ttc),0) ca_total,
        COUNT(v.id) nb_ventes,
        CASE WHEN COUNT(v.id)>0 THEN ROUND(SUM(v.total_ttc)/COUNT(v.id)) ELSE 0 END ticket_moyen
      FROM utilisateurs u LEFT JOIN ventes v ON v.created_by=u.id AND TRUE ${mf}
      WHERE u.role_id IN (2,3) GROUP BY u.id ORDER BY ca_total DESC
    `),
    db.query(`
      SELECT to_char(date_trunc('month',date_vente),'Mon YY') mois, SUM(total_ttc) ca
      FROM ventes WHERE date_vente>=CURRENT_DATE-INTERVAL '6 months' ${mfRaw}
      GROUP BY 1 ORDER BY MIN(date_vente)
    `),
    db.query(`
      SELECT COALESCE(SUM(total_ttc),0) ca_total, COUNT(*) nb_ventes
      FROM ventes WHERE date_vente>=date_trunc('month',CURRENT_DATE) ${mfRaw}
    `),
  ]);
  ok(res, { vendeurs: vendeurs.rows, performance: performance.rows, cumul: cumul.rows[0] });
}));

// ─── Retours ──────────────────────────────────────────────────
rapportsRouter.get('/retours', wrap(async (req, res) => {
  const [retours, par_raison, par_client] = await Promise.all([
    db.query(`
      SELECT r.id, r.numero, rl.produit_id reference, p.designation, rl.quantite qte, rl.raison, r.date_retour date
      FROM retours_client r 
      JOIN retours_lignes rl ON rl.retour_id=r.id 
      JOIN produits p ON p.id=rl.produit_id
      ORDER BY r.date_retour DESC LIMIT 50
    `),
    db.query(`
      SELECT COALESCE(NULLIF(rl.raison,''),'-') raison, COUNT(*) nb, SUM(rl.total_ligne) total
      FROM retours_lignes rl
      GROUP BY COALESCE(NULLIF(rl.raison,''),'-')
      ORDER BY nb DESC
    `),
    db.query(`
      SELECT c.raison_sociale, COUNT(r.id) nb_retours, SUM(r.montant_total) total
      FROM retours_client r JOIN clients c ON c.id=r.client_id
      GROUP BY c.id ORDER BY nb_retours DESC LIMIT 10
    `),
  ]);
  ok(res, { retours: retours.rows, par_raison: par_raison.rows, par_client: par_client.rows });
}));

// ─── Commandes ────────────────────────────────────────────────
rapportsRouter.get('/commandes', wrap(async (req, res) => {
  const [en_cours, devis, stats] = await Promise.all([
    db.query(`
      SELECT bc.id, bc.numero num_bl, f.raison_sociale client, bc.date_commande date, bc.total_ttc total, bc.statut
      FROM bons_commande bc JOIN fournisseurs f ON f.id=bc.fournisseur_id
      WHERE bc.statut IN('envoye','confirme','receptionne_partiel','receptionne') AND bc.date_commande>=CURRENT_DATE-30
      ORDER BY bc.date_commande DESC LIMIT 30
    `),
    db.query(`
      SELECT d.id, d.numero num_devis, c.raison_sociale client, d.total_ttc montant, d.date_devis date_creation
      FROM devis d JOIN clients c ON c.id=d.client_id
      WHERE d.statut='brouillon' OR (d.statut='valide' AND d.date_devis>=CURRENT_DATE-30)
      ORDER BY d.date_devis DESC LIMIT 30
    `),
    db.query(`
      SELECT 
        (SELECT COUNT(*) FROM bons_commande WHERE statut IN('envoye','confirme','receptionne_partiel')) nb_en_cours,
        (SELECT COALESCE(SUM(total_ttc),0) FROM bons_commande WHERE statut IN('envoye','confirme','receptionne_partiel')) total_en_cours,
        (SELECT COUNT(*) FROM devis WHERE statut IN('brouillon','valide')) nb_devis
    `),
  ]);
  ok(res, { en_cours: en_cours.rows, devis: devis.rows, stats: stats.rows[0] });
}));

// ─── Comparaison ──────────────────────────────────────────────
rapportsRouter.get('/comparaison', wrap(async (req, res) => {
  const mois = new Date().getMonth() + 1;
  const annee = new Date().getFullYear();
  const mois_prec = mois === 1 ? 12 : mois - 1;
  const annee_prec = mois === 1 ? annee - 1 : annee;
  
  const [mois_courant, mois_precedent, meme_mois_ln, tendance] = await Promise.all([
    db.query(`
      SELECT COALESCE(SUM(v.total_ttc),0) ca,
        ROUND(COALESCE(
          (SUM(v.total_ttc) - (
            SELECT COALESCE(SUM(vl.quantite*p.prix_achat),0)
            FROM ventes_lignes vl
            JOIN produits p  ON p.id=vl.produit_id
            JOIN ventes v2   ON v2.id=vl.vente_id
            WHERE EXTRACT(YEAR FROM v2.date_vente)=$1 AND EXTRACT(MONTH FROM v2.date_vente)=$2
          )) / NULLIF(SUM(v.total_ttc),0) * 100, 0), 1) marge,
        COUNT(*) nb_ventes
      FROM ventes v
      WHERE EXTRACT(YEAR FROM v.date_vente)=$1 AND EXTRACT(MONTH FROM v.date_vente)=$2
    `, [annee, mois]),
    db.query(`
      SELECT COALESCE(SUM(v.total_ttc),0) ca, COUNT(*) nb_ventes,
        ROUND(COALESCE(
          (SUM(v.total_ttc) - (
            SELECT COALESCE(SUM(vl.quantite*p.prix_achat),0)
            FROM ventes_lignes vl
            JOIN produits p  ON p.id=vl.produit_id
            JOIN ventes v2   ON v2.id=vl.vente_id
            WHERE EXTRACT(YEAR FROM v2.date_vente)=$1 AND EXTRACT(MONTH FROM v2.date_vente)=$2
          )) / NULLIF(SUM(v.total_ttc),0) * 100, 0), 1) marge
      FROM ventes v
      WHERE EXTRACT(YEAR FROM v.date_vente)=$1 AND EXTRACT(MONTH FROM v.date_vente)=$2
    `, [annee_prec, mois_prec]),
    db.query(`
      SELECT COALESCE(SUM(total_ttc),0) ca FROM ventes
      WHERE EXTRACT(YEAR FROM date_vente)=$1 AND EXTRACT(MONTH FROM date_vente)=$2
    `, [annee - 1, mois]),
    db.query(`
      SELECT to_char(date_trunc('month',date_vente),'Mon YY') mois,
        SUM(CASE WHEN EXTRACT(YEAR FROM date_vente)=EXTRACT(YEAR FROM CURRENT_DATE) THEN total_ttc ELSE 0 END) ca_an,
        SUM(CASE WHEN EXTRACT(YEAR FROM date_vente)=EXTRACT(YEAR FROM CURRENT_DATE)-1 THEN total_ttc ELSE 0 END) ca_ln
      FROM ventes WHERE date_vente>=CURRENT_DATE-INTERVAL '12 months'
      GROUP BY 1 ORDER BY MIN(date_vente)
    `),
  ]);
  
  ok(res, {
    mois_courant: mois_courant.rows[0],
    mois_precedent: mois_precedent.rows[0],
    meme_mois_année_derniere: meme_mois_ln.rows[0],
    tendance: tendance.rows,
  });
}));

// ─── Marges par catégorie/fournisseur ──────────────────────────
rapportsRouter.get('/marges', wrap(async (req, res) => {
  const [par_categorie, par_fournisseur, tendance_marge] = await Promise.all([
    db.query(`
      SELECT c.libelle categorie,
        COALESCE(SUM(vl.total_ligne),0) ca,
        COALESCE(SUM(vl.quantite*p.prix_achat),0) cout,
        COALESCE(SUM(vl.total_ligne)-SUM(vl.quantite*p.prix_achat),0) marge,
        CASE WHEN COALESCE(SUM(vl.total_ligne),0)>0 
          THEN ROUND((COALESCE(SUM(vl.total_ligne)-SUM(vl.quantite*p.prix_achat),0)/COALESCE(SUM(vl.total_ligne),1))*100,1)
          ELSE 0 END taux
      FROM produits p
      LEFT JOIN categories c ON c.id=p.categorie_id
      LEFT JOIN ventes_lignes vl ON vl.produit_id=p.id
      WHERE p.actif=TRUE
      GROUP BY c.libelle ORDER BY marge DESC
    `),
    db.query(`
      SELECT m.nom fournisseur,
        COALESCE(SUM(vl.total_ligne),0) ca,
        COALESCE(SUM(vl.quantite*p.prix_achat),0) cout,
        COALESCE(SUM(vl.total_ligne)-SUM(vl.quantite*p.prix_achat),0) marge,
        CASE WHEN COALESCE(SUM(vl.total_ligne),0)>0 
          THEN ROUND((COALESCE(SUM(vl.total_ligne)-SUM(vl.quantite*p.prix_achat),0)/COALESCE(SUM(vl.total_ligne),1))*100,1)
          ELSE 0 END taux
      FROM produits p
      LEFT JOIN marques m ON m.id=p.marque_id
      LEFT JOIN ventes_lignes vl ON vl.produit_id=p.id
      WHERE p.actif=TRUE
      GROUP BY m.nom ORDER BY marge DESC
    `),
    db.query(`
      SELECT to_char(date_trunc('month',v.date_vente),'Mon YY') mois,
        CASE WHEN COALESCE(SUM(vl.total_ligne),0)>0 
          THEN ROUND((COALESCE(SUM(vl.total_ligne)-SUM(vl.quantite*p.prix_achat),0)/COALESCE(SUM(vl.total_ligne),1))*100,1)
          ELSE 0 END taux
      FROM ventes v
      LEFT JOIN ventes_lignes vl ON vl.vente_id=v.id
      LEFT JOIN produits p ON p.id=vl.produit_id
      WHERE v.date_vente>=CURRENT_DATE-INTERVAL '6 months'
      GROUP BY 1 ORDER BY MIN(v.date_vente)
    `),
  ]);
  ok(res, { par_categorie: par_categorie.rows, par_fournisseur: par_fournisseur.rows, tendance_marge: tendance_marge.rows });
}));

// ─── Prévisions ───────────────────────────────────────────────
rapportsRouter.get('/previsions', wrap(async (req, res) => {
  const [tendance_6m, saisonnalite, objectifs] = await Promise.all([
    db.query(`
      SELECT to_char(date_trunc('month',date_vente),'Mon YY') mois,
        SUM(total_ttc) ca_actuel,
        ROUND(AVG(SUM(total_ttc)) OVER(ORDER BY date_trunc('month',date_vente) ROWS BETWEEN 3 PRECEDING AND CURRENT ROW)) ca_previsionnel
      FROM ventes 
      WHERE date_vente>=CURRENT_DATE-INTERVAL '6 months'
      GROUP BY 1 ORDER BY MIN(date_vente)
    `),
    db.query(`
      SELECT to_char(date_trunc('month',date_vente),'Mon') mois,
        SUM(total_ttc) ca_moyen,
        ROUND(SUM(total_ttc)/(SELECT AVG(ca) FROM (SELECT SUM(total_ttc) ca FROM ventes v2 GROUP BY DATE_TRUNC('month',v2.date_vente)) sub)*100) coefficient
      FROM ventes GROUP BY to_char(date_trunc('month',date_vente),'Mon')
      ORDER BY EXTRACT(MONTH FROM date_trunc('month',date_vente))
    `),
    db.query(`
      SELECT 
        COALESCE((SELECT ca_cible FROM objectifs WHERE annee=EXTRACT(YEAR FROM CURRENT_DATE) LIMIT 1), 100000000) ca_annee,
        COALESCE(SUM(total_ttc),0) ca_cumul,
        ROUND(COALESCE(SUM(total_ttc),0)/(SELECT COALESCE(ca_cible/12,100000000/12) FROM objectifs WHERE annee=EXTRACT(YEAR FROM CURRENT_DATE) LIMIT 1)*100,1) taux_realisation
      FROM ventes WHERE EXTRACT(YEAR FROM date_vente)=EXTRACT(YEAR FROM CURRENT_DATE)
    `),
  ]);
  ok(res, { tendance_6m: tendance_6m.rows, saisonnalite: saisonnalite.rows, objectifs: objectifs.rows[0] });
}));

// ─── PDF ─────────────────────────────────────────────────────
export const pdfRouter = Router();
pdfRouter.get('/facture/:id', wrap(async (req, res) => {
  const { rows: ventes } = await db.query(
    `SELECT v.*,c.raison_sociale,c.adresse,c.ville,c.telephone,c.email,c.code client_code,mp.nom moyen_paiement FROM ventes v JOIN clients c ON c.id=v.client_id LEFT JOIN moyens_paiement mp ON mp.id=v.moyen_paiement_id WHERE v.id=$1`, [req.params.id]);
  if (!ventes.length) return res.status(404).json({ error: 'Vente non trouvée' });
  const { rows: lignes } = await db.query(`SELECT vl.*,p.designation,p.reference FROM ventes_lignes vl JOIN produits p ON p.id=vl.produit_id WHERE vl.vente_id=$1`, [req.params.id]);
  const v = ventes[0];
  const pdf = await genererFacture(v, { raison_sociale:v.raison_sociale,adresse:v.adresse,ville:v.ville,telephone:v.telephone,email:v.email,code:v.client_code }, lignes);
  res.set({ 'Content-Type':'application/pdf','Content-Disposition':`inline; filename="Facture-${v.numero}.pdf"`,'Content-Length':pdf.length });
  res.send(pdf);
}));
pdfRouter.get('/releve/:clientId', wrap(async (req, res) => {
  const [{ rows:[cli] },{ rows:creances }] = await Promise.all([
    db.query(`SELECT * FROM clients WHERE id=$1`,[req.params.clientId]),
    db.query(`SELECT * FROM v_creances_clients WHERE client_id=$1 ORDER BY date_echeance`,[req.params.clientId]),
  ]);
  if (!cli) return res.status(404).json({ error: 'Client non trouvé' });
  const pdf = await genererReleveClient(cli, creances, null);
  res.set({ 'Content-Type':'application/pdf','Content-Disposition':`inline; filename="Releve-${cli.code}.pdf"`,'Content-Length':pdf.length });
  res.send(pdf);
}));
pdfRouter.get('/devis/:id', wrap(async (req, res) => {
  const [{ rows: devis_rows }, { rows: lignes }] = await Promise.all([
    db.query(
      `SELECT d.*,c.raison_sociale,c.adresse,c.ville,c.telephone,c.email,c.code client_code FROM devis d JOIN clients c ON c.id=d.client_id WHERE d.id=$1`, 
      [req.params.id]
    ),
    db.query(
      `SELECT dl.*,p.designation,p.reference FROM devis_lignes dl JOIN produits p ON p.id=dl.produit_id WHERE dl.devis_id=$1`, 
      [req.params.id]
    ),
  ]);
  if (!devis_rows.length) return res.status(404).json({ error: 'Devis non trouvé' });
  const d = devis_rows[0];
  const pdf = await genererDevis(d, { raison_sociale:d.raison_sociale, adresse:d.adresse, ville:d.ville, telephone:d.telephone, email:d.email, code:d.client_code }, lignes);
  res.set({ 'Content-Type':'application/pdf','Content-Disposition':`inline; filename="Devis-${d.numero}.pdf"`,'Content-Length':pdf.length });
  res.send(pdf);
}));

// ─── NOTIFICATIONS ────────────────────────────────────────────
export const notifRouter = Router();
notifRouter.post('/sms', wrap(async (req, res) => {
  const { telephone, message } = req.body;
  const { envoyerSMS } = await import('../services/notifications');
  const r = await envoyerSMS(telephone, message);
  ok(res, r);
}));
notifRouter.post('/whatsapp', wrap(async (req, res) => {
  const { telephone, message } = req.body;
  const { envoyerWhatsApp } = await import('../services/notifications');
  const r = await envoyerWhatsApp(telephone, message);
  ok(res, r);
}));
notifRouter.post('/relancer-creance/:venteId', wrap(async (req, res) => {
  const { rows } = await db.query(`SELECT * FROM v_creances_clients WHERE id=$1`,[req.params.venteId]);
  if (!rows.length) return res.status(404).json({ success:false, error:'Créance non trouvée' });
  const cr = rows[0] as Record<string, unknown>;
  const { rows:[cli] } = await db.query(`SELECT * FROM clients WHERE id=$1`,[cr.client_id]);
  const niveau = (Number(cr.jours_retard ?? 0)) > 30 ? 2 : 1;
  const r = await notif.relancerCreance(db, cr, cli, niveau);
  ok(res, r);
}));
notifRouter.post('/campagne-relances', wrap(async (req, res) => {
  const r = await notif.campagneRelances(db);
  ok(res, { resultats: r, total: r.length });
}));
notifRouter.get('/logs', wrap(async (_, res) => {
  const { rows } = await db.query(`SELECT * FROM notifications_log ORDER BY created_at DESC LIMIT 100`);
  ok(res, rows);
}));

// ─── ADMIN ────────────────────────────────────────────────────
export const adminRouter = Router();
adminRouter.use(requireRole('admin'));
adminRouter.get('/roles', wrap(async (_, res) => {
  const { rows } = await db.query(`SELECT id, code, libelle nom FROM roles ORDER BY id`);
  ok(res, rows);
}));
adminRouter.get('/utilisateurs', wrap(async (_, res) => {
  const { rows } = await db.query(
    `SELECT u.id,u.code,u.nom,u.prenom,u.email,u.telephone,u.actif,u.derniere_cnx,
            r.id role_id,r.code role,r.libelle role_nom,
            COALESCE(vm.magasin_ids,'{}') magasin_ids,
            COALESCE(vm.magasin_noms,'{}') magasin_noms
     FROM utilisateurs u
     JOIN roles r ON r.id=u.role_id
     LEFT JOIN v_utilisateurs_magasins vm ON vm.utilisateur_id=u.id
     ORDER BY u.nom`);
  ok(res, { utilisateurs: rows });
}));
adminRouter.post('/utilisateurs', wrap(async (req, res) => {
  const bcrypt = await import('bcrypt');
  const { code,nom,prenom,email,telephone,password,role_id,magasin_ids } = req.body;
  const hash = await bcrypt.hash(password, 12);
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO utilisateurs (code,nom,prenom,email,telephone,password_hash,role_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [code,nom,prenom,email,telephone,hash,role_id]);
    const uid = rows[0].id;
    const ids: number[] = Array.isArray(magasin_ids) ? magasin_ids.filter(Boolean) : [];
    if (ids.length) {
      await client.query(
        `INSERT INTO utilisateurs_magasins (utilisateur_id, magasin_id) SELECT $1, unnest($2::int[])`,
        [uid, ids]);
    }
    await client.query('COMMIT');
    ok(res, { id: uid, code, nom, prenom, email });
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));
adminRouter.put('/utilisateurs/:id', wrap(async (req, res) => {
  const bcrypt = await import('bcrypt');
  const { nom,prenom,email,telephone,role_id,actif,password,magasin_ids } = req.body;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    let q = `UPDATE utilisateurs SET nom=$1,prenom=$2,email=$3,telephone=$4,role_id=$5,actif=$6`;
    const p: unknown[] = [nom,prenom,email,telephone,role_id,actif??true];
    if (password) { p.push(await bcrypt.hash(password, 12)); q += `,password_hash=$${p.length}`; }
    p.push(req.params.id); q += ` WHERE id=$${p.length}`;
    await client.query(q, p);
    // Remplacer toutes les associations magasins
    await client.query(`DELETE FROM utilisateurs_magasins WHERE utilisateur_id=$1`, [req.params.id]);
    const ids: number[] = Array.isArray(magasin_ids) ? magasin_ids.filter(Boolean) : [];
    if (ids.length) {
      await client.query(
        `INSERT INTO utilisateurs_magasins (utilisateur_id, magasin_id) SELECT $1, unnest($2::int[])`,
        [req.params.id, ids]);
    }
    await client.query('COMMIT');
    ok(res, { id: +req.params.id });
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));
adminRouter.delete('/utilisateurs/:id', wrap(async (req, res) => {
  await db.query(`UPDATE utilisateurs SET actif=FALSE WHERE id=$1`, [req.params.id]);
  ok(res, { id: +req.params.id });
}));
adminRouter.get('/audit', wrap(async (_, res) => {
  const { rows } = await db.query(`SELECT al.*,u.nom,u.email FROM audit_logs al LEFT JOIN utilisateurs u ON u.id=al.user_id ORDER BY al.created_at DESC LIMIT 200`);
  ok(res, rows);
}));

// ─── RÉFÉRENTIELS ─────────────────────────────────────────────
// Les référentiels génériques sont gérés via referentiels.ts
// Les anciens endpoints (marques, categories) restent disponibles ci-dessus

// ─── DEVIS ───────────────────────────────────────────────────
export const devisRouter = Router();
devisRouter.get('/', wrap(async (req, res) => {
  const { client_id, statut } = req.query as Record<string, string>;
  const magasin_id = scopeMagasin(req);
  let q = `SELECT d.*, c.raison_sociale client_nom FROM devis d JOIN clients c ON c.id=d.client_id WHERE 1=1`;
  const p: unknown[] = [];
  if (magasin_id) { p.push(magasin_id); q += ` AND d.magasin_id=$${p.length}`; }
  if (client_id)  { p.push(+client_id); q += ` AND d.client_id=$${p.length}`; }
  if (statut)     { p.push(statut);     q += ` AND d.statut=$${p.length}`; }
  q += ' ORDER BY d.date_devis DESC LIMIT 100';
  const { rows } = await db.query(q, p);
  ok(res, rows);
}));
devisRouter.get('/:id', wrap(async (req, res) => {
  const [d, lignes] = await Promise.all([
    db.query(`SELECT d.*,c.raison_sociale client_nom,c.telephone,c.email,c.adresse,c.ville FROM devis d JOIN clients c ON c.id=d.client_id WHERE d.id=$1`, [req.params.id]),
    db.query(`SELECT dl.*,p.designation,p.reference FROM devis_lignes dl JOIN produits p ON p.id=dl.produit_id WHERE dl.devis_id=$1`, [req.params.id]),
  ]);
  if (!d.rows.length) return fail(res, 'Devis non trouvé', 404);
  ok(res, { ...d.rows[0], lignes: lignes.rows });
}));
devisRouter.post('/', requirePerm('ventes'), wrap(async (req, res) => {
  const { client_id, type_vente='gros', date_devis, date_validite, lignes, remise_pct=0, tva_pct=18, notes } = req.body;
  const { rows:[{max_id}] } = await db.query(`SELECT COALESCE(MAX(id),3000) max_id FROM devis`);
  const numero = `DEV-${Number(max_id)+1}`;
  const brut = lignes.reduce((s:number,l:any)=>s+l.quantite*l.prix_unitaire,0);
  const remise_montant = Math.round(brut*remise_pct/100);
  const sous_total = brut-remise_montant;
  const tva_montant = Math.round(sous_total*tva_pct/100);
  const total_ttc = sous_total+tva_montant;
  const { rows:[devis] } = await db.query(
    `INSERT INTO devis (numero,client_id,type_vente,date_devis,date_validite,sous_total,remise_pct,remise_montant,tva_pct,tva_montant,total_ttc,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [numero,client_id,type_vente,date_devis??new Date(),date_validite,sous_total,remise_pct,remise_montant,tva_pct,tva_montant,total_ttc,notes]);
  for(const l of lignes) {
    const tl=Math.round(l.quantite*l.prix_unitaire*(1-(l.remise_pct??0)/100));
    await db.query(`INSERT INTO devis_lignes (devis_id,produit_id,quantite,prix_unitaire,remise_pct,total_ligne) VALUES ($1,$2,$3,$4,$5,$6)`,
      [devis.id,l.produit_id,l.quantite,l.prix_unitaire,l.remise_pct??0,tl]);
  }
  ok(res, devis);
}));
devisRouter.put('/:id', requirePerm('ventes'), wrap(async (req, res) => {
  const { statut, date_validite, notes } = req.body;
  const { rows } = await db.query(
    `UPDATE devis SET statut=COALESCE($1,statut),date_validite=COALESCE($2,date_validite),notes=COALESCE($3,notes) WHERE id=$4 RETURNING *`,
    [statut,date_validite,notes,req.params.id]);
  if(!rows.length) return fail(res,'Devis non trouvé',404);
  ok(res,rows[0]);
}));
devisRouter.post('/:id/convertir', requirePerm('ventes'), wrap(async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows:[devis] } = await client.query(`SELECT * FROM devis WHERE id=$1 AND statut NOT IN ('converti','refuse')`, [req.params.id]);
    if(!devis) return fail(res,'Devis non disponible pour conversion',400);
    const { rows:lignes } = await client.query(`SELECT * FROM devis_lignes WHERE devis_id=$1`, [req.params.id]);
    const { rows:[{max_id}] } = await client.query(`SELECT COALESCE(MAX(id),1000) max_id FROM ventes`);
    const numero = `VTE-${Number(max_id)+1}`;
    const solde = devis.total_ttc;
    const { rows:[vente] } = await client.query(
      `INSERT INTO ventes (numero,client_id,type_vente,date_vente,sous_total,remise_pct,remise_montant,tva_pct,tva_montant,total_ttc,montant_paye,solde_restant,statut_paiement,notes) VALUES ($1,$2,$3,CURRENT_DATE,$4,$5,$6,$7,$8,$9,0,$9,'non_paye',$10) RETURNING *`,
      [numero,devis.client_id,devis.type_vente,devis.sous_total,devis.remise_pct,devis.remise_montant,devis.tva_pct,devis.tva_montant,devis.total_ttc,devis.notes]);
    const magasin_id_conv = scopeMagasin(req) ?? 1;
    for(const l of lignes) {
      // Vérifier stock disponible avant déduction
      const { rows:[stk] } = await client.query(
        `SELECT s.quantite, p.designation FROM stocks s JOIN produits p ON p.id=s.produit_id
         WHERE s.produit_id=$1 AND s.magasin_id=$2 FOR UPDATE`,
        [l.produit_id, magasin_id_conv]);
      if (!stk) throw Object.assign(new Error(`Produit #${l.produit_id} absent du stock de ce magasin`), { statusCode: 400 });
      if (stk.quantite < l.quantite) throw Object.assign(
        new Error(`Stock insuffisant pour "${stk.designation}" (dispo: ${stk.quantite}, demandé: ${l.quantite})`),
        { statusCode: 400 }
      );
      await client.query(`INSERT INTO ventes_lignes (vente_id,produit_id,quantite,prix_unitaire,remise_pct,total_ligne) VALUES ($1,$2,$3,$4,$5,$6)`,
        [vente.id,l.produit_id,l.quantite,l.prix_unitaire,l.remise_pct,l.total_ligne]);
      await client.query(`UPDATE stocks SET quantite=quantite-$1 WHERE produit_id=$2 AND magasin_id=$3`,
        [l.quantite,l.produit_id,magasin_id_conv]);
      await client.query(`INSERT INTO mouvements_stock (produit_id,type,quantite,stock_avant,stock_apres,motif,ref_doc,magasin_id) VALUES ($1,'sortie',$2,$3,$4,'Vente (depuis devis)',$5,$6)`,
        [l.produit_id,l.quantite,stk.quantite,stk.quantite-l.quantite,numero,magasin_id_conv]);
    }
    await client.query(`UPDATE devis SET statut='converti',vente_id=$1 WHERE id=$2`,[vente.id,req.params.id]);
    await client.query('COMMIT');
    ok(res,{vente,devis_id:+req.params.id});
  } catch(e){ await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));
devisRouter.delete('/:id', requirePerm('ventes'), wrap(async (req, res) => {
  await db.query(`UPDATE devis SET statut='refuse' WHERE id=$1`,[req.params.id]);
  ok(res,{id:+req.params.id});
}));

// ─── RETOURS CLIENT ──────────────────────────────────────────
export const retoursRouter = Router();
retoursRouter.get('/', wrap(async (req, res) => {
  const magasin_id = scopeMagasin(req);
  let q = `SELECT r.*,c.raison_sociale client_nom FROM retours_client r JOIN clients c ON c.id=r.client_id WHERE 1=1`;
  const p: unknown[] = [];
  if (magasin_id) { p.push(magasin_id); q += ` AND r.magasin_id=$${p.length}`; }
  q += ' ORDER BY r.date_retour DESC LIMIT 100';
  const { rows } = await db.query(q, p);
  ok(res, rows);
}));
retoursRouter.post('/', requirePerm('ventes'), wrap(async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { client_id, vente_id, date_retour, motif, type_avoir='avoir', lignes, notes } = req.body;

    // Bug 8 — Valider que les quantités retournées ne dépassent pas les quantités vendues
    if (vente_id) {
      const { rows: venteLignes } = await client.query(
        `SELECT produit_id, SUM(quantite) AS quantite FROM ventes_lignes WHERE vente_id=$1 GROUP BY produit_id`,
        [vente_id]
      );
      const venteMap = new Map(venteLignes.map((vl: any) => [vl.produit_id, Number(vl.quantite)]));
      // Cumuler les retours précédents pour cette vente
      const { rows: dejaCreditees } = await client.query(
        `SELECT rl.produit_id, SUM(rl.quantite) AS qte_retournee
         FROM retours_lignes rl JOIN retours_client r ON r.id=rl.retour_id
         WHERE r.vente_id=$1 GROUP BY rl.produit_id`,
        [vente_id]
      );
      const retourneMap = new Map(dejaCreditees.map((r: any) => [r.produit_id, Number(r.qte_retournee)]));
      for (const l of lignes) {
        const maxQte = (venteMap.get(l.produit_id) ?? 0) - (retourneMap.get(l.produit_id) ?? 0);
        if (l.quantite > maxQte) {
          throw Object.assign(
            new Error(`Quantité retournée (${l.quantite}) dépasse la quantité vendable (${maxQte}) pour le produit #${l.produit_id}`),
            { statusCode: 400 }
          );
        }
      }
    }

    const magasin_id_retour = scopeMagasin(req) ?? 1;
    const { rows:[{max_id}] } = await client.query(`SELECT COALESCE(MAX(id),4000) max_id FROM retours_client`);
    const numero = `RET-${Number(max_id)+1}`;
    const montant_total = lignes.reduce((s:number,l:any)=>s+l.quantite*l.prix_unitaire,0);
    const { rows:[retour] } = await client.query(
      `INSERT INTO retours_client (numero,vente_id,client_id,date_retour,motif,type_avoir,montant_total,notes,magasin_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [numero,vente_id||null,client_id,date_retour??new Date(),motif,type_avoir,montant_total,notes,magasin_id_retour]);
    for(const l of lignes){
      await client.query(`INSERT INTO retours_lignes (retour_id,produit_id,quantite,prix_unitaire,total_ligne,raison) VALUES ($1,$2,$3,$4,$5,$6)`,
        [retour.id,l.produit_id,l.quantite,l.prix_unitaire,l.quantite*l.prix_unitaire,l.raison||null]);
      const { rows:[stk] } = await client.query(
        `SELECT COALESCE(quantite,0) AS quantite FROM stocks WHERE produit_id=$1 AND magasin_id=$2`,
        [l.produit_id, magasin_id_retour]);
      const stock_avant = stk?.quantite ?? 0;
      await client.query(
        `INSERT INTO stocks (produit_id,magasin_id,quantite,stock_alerte) VALUES ($1,$2,$3,5)
         ON CONFLICT (produit_id,magasin_id) DO UPDATE SET quantite=stocks.quantite+$3`,
        [l.produit_id, magasin_id_retour, l.quantite]);
      await client.query(
        `INSERT INTO mouvements_stock (produit_id,type,quantite,stock_avant,stock_apres,motif,ref_doc,magasin_id) VALUES ($1,'retour',$2,$3,$4,'Retour client',$5,$6)`,
        [l.produit_id,l.quantite,stock_avant,stock_avant+l.quantite,numero,magasin_id_retour]);
    }
    await client.query('COMMIT');
    ok(res,retour);
  } catch(e){ await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}));
retoursRouter.put('/:id/statut', requirePerm('ventes'), wrap(async (req, res) => {
  const { statut } = req.body;
  const { rows } = await db.query(`UPDATE retours_client SET statut=$1 WHERE id=$2 RETURNING *`,[statut,req.params.id]);
  ok(res,rows[0]);
}));

// ─── BONS DE COMMANDE ────────────────────────────────────────
export const bonCommandeRouter = Router();
bonCommandeRouter.get('/', wrap(async (req, res) => {
  const { fournisseur_id, statut } = req.query as Record<string,string>;
  const magasin_id = scopeMagasin(req);
  let q=`SELECT bc.*,f.raison_sociale fournisseur_nom FROM bons_commande bc JOIN fournisseurs f ON f.id=bc.fournisseur_id WHERE 1=1`;
  const p:unknown[]=[];
  if(magasin_id)    { p.push(magasin_id);     q+=` AND bc.magasin_id=$${p.length}`; }
  if(fournisseur_id){ p.push(+fournisseur_id); q+=` AND bc.fournisseur_id=$${p.length}`; }
  if(statut)        { p.push(statut);          q+=` AND bc.statut=$${p.length}`; }
  q+=' ORDER BY bc.date_commande DESC LIMIT 100';
  const { rows } = await db.query(q,p);
  ok(res,rows);
}));
bonCommandeRouter.post('/', requirePerm('ventes'), wrap(async (req, res) => {
  const { fournisseur_id, date_commande, date_livraison, lignes, notes, tva_pct=18 } = req.body;
  const { rows:[{max_id}] } = await db.query(`SELECT COALESCE(MAX(id),5000) max_id FROM bons_commande`);
  const numero = `BC-${Number(max_id)+1}`;
  const total_ht = lignes.reduce((s:number,l:any)=>s+l.quantite*l.prix_unitaire,0);
  const tva_montant = Math.round(total_ht*tva_pct/100);
  const total_ttc = total_ht+tva_montant;
  const { rows:[bc] } = await db.query(
    `INSERT INTO bons_commande (numero,fournisseur_id,date_commande,date_livraison,total_ht,tva_montant,total_ttc,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [numero,fournisseur_id,date_commande??new Date(),date_livraison,total_ht,tva_montant,total_ttc,notes]);
  for(const l of lignes){
    await db.query(`INSERT INTO bons_commande_lignes (bc_id,produit_id,quantite,prix_unitaire,total_ligne) VALUES ($1,$2,$3,$4,$5)`,
      [bc.id,l.produit_id,l.quantite,l.prix_unitaire,l.quantite*l.prix_unitaire]);
  }
  ok(res,bc);
}));
bonCommandeRouter.put('/:id/statut', requirePerm('ventes'), wrap(async (req, res) => {
  const { statut } = req.body;
  const { rows } = await db.query(`UPDATE bons_commande SET statut=$1 WHERE id=$2 RETURNING *`,[statut,req.params.id]);
  ok(res,rows[0]);
}));
// Réception d'un BC → crée/complète l'achat fournisseur lié.
// Supporte la réception PARTIELLE (body.lignes) et la création de lots
// pour les produits gérés par lot. Idempotent : refuse si déjà reçu.
//
// body optionnel : { lignes: [{ ligne_id, quantite, numero_lot?, date_peremption? }] }
//   - absent → réceptionne tout le reliquat de chaque ligne
//   - présent → ne réceptionne que les lignes/quantités fournies
bonCommandeRouter.post('/:id/receptionner', requirePerm('produits'), wrap(async (req, res) => {
  const cl = await db.connect();
  try {
    await cl.query('BEGIN');
    const { rows:[bc] } = await cl.query(
      `SELECT bc.* FROM bons_commande bc WHERE bc.id=$1 FOR UPDATE`, [req.params.id]);
    if(!bc) { await cl.query('ROLLBACK'); return fail(res,'BC non trouvé',404); }
    if(bc.statut === 'receptionne') { await cl.query('ROLLBACK'); return fail(res,'BC déjà réceptionné intégralement',409); }
    if(bc.statut === 'annule')      { await cl.query('ROLLBACK'); return fail(res,'BC annulé',400); }

    const magasin_id_bc = scopeMagasin(req) ?? bc.magasin_id ?? 1;
    const { rows:lignes } = await cl.query(
      `SELECT bcl.*, p.gere_lot FROM bons_commande_lignes bcl
       JOIN produits p ON p.id=bcl.produit_id WHERE bcl.bc_id=$1`, [req.params.id]);

    // Réceptions demandées (par ligne) ; absent → tout le reliquat
    const demande: Map<number, any> | null = Array.isArray(req.body?.lignes)
      ? new Map(req.body.lignes.map((r:any) => [Number(r.ligne_id), r])) : null;

    type Plan = { ligne:any; q:number; numero_lot?:string; date_peremption?:string };
    const plan: Plan[] = [];
    for (const l of lignes) {
      const reste = Number(l.quantite) - Number(l.quantite_recue);
      if (reste <= 0) continue;
      if (demande) {
        const r = demande.get(Number(l.id));
        if (!r) continue;
        const q = Math.min(Number(r.quantite) || 0, reste);
        if (q > 0) plan.push({ ligne:l, q, numero_lot:r.numero_lot, date_peremption:r.date_peremption });
      } else {
        plan.push({ ligne:l, q:reste });
      }
    }
    if (plan.length === 0) { await cl.query('ROLLBACK'); return fail(res,'Rien à réceptionner',400); }

    // Achat lié : réutiliser s'il existe (top-up partiel), sinon créer
    let achat:any;
    if (bc.achat_id) {
      const { rows:[a] } = await cl.query(`SELECT * FROM achats WHERE id=$1 FOR UPDATE`, [bc.achat_id]);
      achat = a;
    }
    if (!achat) {
      const { rows:[{max_id}] } = await cl.query(`SELECT COALESCE(MAX(id),2000) max_id FROM achats`);
      const numero = `ACH-${Number(max_id)+1}`;
      const { rows:[a] } = await cl.query(
        `INSERT INTO achats (numero,fournisseur_id,date_achat,total_ht,tva_montant,total_ttc,montant_paye,solde_restant,statut_paiement,magasin_id,bon_commande_id)
         VALUES ($1,$2,CURRENT_DATE,0,0,0,0,0,'non_paye',$3,$4) RETURNING *`,
        [numero, bc.fournisseur_id, magasin_id_bc, bc.id]);
      achat = a;
    }

    for (const { ligne:l, q, numero_lot, date_peremption } of plan) {
      const total_ligne = Math.round(q * Number(l.prix_unitaire));
      await cl.query(
        `INSERT INTO achats_lignes (achat_id,produit_id,quantite,prix_unitaire,total_ligne) VALUES ($1,$2,$3,$4,$5)`,
        [achat.id, l.produit_id, q, l.prix_unitaire, total_ligne]);
      await cl.query(
        `UPDATE bons_commande_lignes SET quantite_recue = quantite_recue + $1 WHERE id=$2`, [q, l.id]);

      // Stock + éventuel lot
      const { rows:[stk] } = await cl.query(
        `SELECT COALESCE(quantite,0) AS quantite FROM stocks WHERE produit_id=$1 AND magasin_id=$2 FOR UPDATE`,
        [l.produit_id, magasin_id_bc]);
      const stock_avant = Number(stk?.quantite ?? 0);
      await cl.query(
        `INSERT INTO stocks (produit_id,magasin_id,quantite,stock_alerte) VALUES ($1,$2,$3,5)
         ON CONFLICT (produit_id,magasin_id) DO UPDATE SET quantite=stocks.quantite+$3`,
        [l.produit_id, magasin_id_bc, q]);

      let lotId: number | null = null;
      if (l.gere_lot) {
        const { rows:[lot] } = await cl.query(
          `INSERT INTO lots (produit_id,magasin_id,numero_lot,date_peremption,quantite,prix_achat)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [l.produit_id, magasin_id_bc, numero_lot || `LOT-${bc.numero}`, date_peremption || null, q, l.prix_unitaire]);
        lotId = lot.id;
      }
      await cl.query(
        `INSERT INTO mouvements_stock (produit_id,type,quantite,stock_avant,stock_apres,motif,ref_doc,magasin_id,lot_id)
         VALUES ($1,'entree',$2,$3,$4,'Réception BC',$5,$6,$7)`,
        [l.produit_id, q, stock_avant, stock_avant + q, bc.numero, magasin_id_bc, lotId]);
    }

    // Recalcule les totaux de l'achat depuis ses lignes (taux TVA du BC conservé)
    const { rows:[{ ht }] } = await cl.query(
      `SELECT COALESCE(SUM(total_ligne),0) AS ht FROM achats_lignes WHERE achat_id=$1`, [achat.id]);
    const totalHt = Number(ht);
    const taux = Number(bc.total_ht) > 0 ? Number(bc.tva_montant) / Number(bc.total_ht) : 0;
    const tva = Math.round(totalHt * taux);
    const totalTtc = totalHt + tva;
    await cl.query(
      `UPDATE achats SET total_ht=$1, tva_montant=$2, total_ttc=$3,
         solde_restant = $3 - montant_paye,
         statut_paiement = CASE WHEN $3 - montant_paye <= 0 THEN 'paye'
                                WHEN montant_paye > 0 THEN 'partiel' ELSE 'non_paye' END
       WHERE id=$4`, [totalHt, tva, totalTtc, achat.id]);

    // Statut du BC : reçu intégralement ou partiellement
    const { rows:[{ complet }] } = await cl.query(
      `SELECT bool_and(quantite_recue >= quantite) AS complet FROM bons_commande_lignes WHERE bc_id=$1`, [bc.id]);
    const nouveauStatut = complet ? 'receptionne' : 'receptionne_partiel';
    await cl.query(`UPDATE bons_commande SET statut=$1, achat_id=$2 WHERE id=$3`,
      [nouveauStatut, achat.id, bc.id]);

    const { rows:[achatFinal] } = await cl.query(`SELECT * FROM achats WHERE id=$1`, [achat.id]);
    await cl.query('COMMIT');
    ok(res, { achat: achatFinal, bc_id: bc.id, statut: nouveauStatut, lignes_receptionnees: plan.length });
  } catch(e){ await cl.query('ROLLBACK'); throw e; }
  finally { cl.release(); }
}));

// ─── STOCK MOUVEMENTS MANUELS ────────────────────────────────
export const stockRouter = Router();
stockRouter.get('/mouvements', wrap(async (req, res) => {
  const { produit_id, type, limit='50' } = req.query as Record<string,string>;
  const magasin_id = scopeMagasin(req);
  let q=`SELECT * FROM v_mouvements_stock WHERE 1=1`;
  const p:unknown[]=[];
  if(magasin_id){p.push(magasin_id);q+=` AND magasin_id=$${p.length}`;}
  if(produit_id){p.push(+produit_id);q+=` AND produit_id=$${p.length}`;}
  if(type){p.push(type);q+=` AND type=$${p.length}`;}
  p.push(+limit);q+=` ORDER BY created_at DESC LIMIT $${p.length}`;
  const { rows } = await db.query(q,p);
  ok(res,rows);
}));
stockRouter.get('/par-magasin', wrap(async (req, res) => {
  const { magasin_id: qMagasin, produit_id } = req.query as Record<string,string>;
  const scopeId = scopeMagasin(req);
  const filtreId = scopeId ?? (qMagasin ? +qMagasin : null);
  let q = `SELECT * FROM v_stocks WHERE 1=1`;
  const p: unknown[] = [];
  if(filtreId){p.push(filtreId);q+=` AND magasin_id=$${p.length}`;}
  if(produit_id){p.push(+produit_id);q+=` AND produit_id=$${p.length}`;}
  q += ' ORDER BY designation';
  const { rows } = await db.query(q,p);
  ok(res,rows);
}));
stockRouter.post('/ajustement', requirePerm('produits'), wrap(async (req, res) => {
  const cl=await db.connect();
  try {
    await cl.query('BEGIN');
    const { produit_id, type, quantite, motif, ref_doc } = req.body;
    const magasin_id = scopeMagasin(req) ?? 1;
    const { rows:[s] } = await cl.query(
      `SELECT s.quantite, p.gere_lot FROM stocks s JOIN produits p ON p.id=s.produit_id
       WHERE s.produit_id=$1 AND s.magasin_id=$2 FOR UPDATE`,
      [produit_id, magasin_id]);
    if(!s) return fail(res,'Stock introuvable pour ce magasin',404);
    const stockAvant = Number(s.quantite);              // pg renvoie NUMERIC en string
    const qte = Math.abs(+quantite);
    // entree augmente ; sortie/perte/casse/peremption/don diminuent
    const delta = type==='entree' ? qte : -qte;
    const nouveau_stock = stockAvant + delta;
    if(nouveau_stock < 0) return fail(res,'Stock insuffisant',400);
    await cl.query(
      `UPDATE stocks SET quantite=$1 WHERE produit_id=$2 AND magasin_id=$3`,
      [nouveau_stock, produit_id, magasin_id]);

    // Démarque lot-aware : sur une sortie d'un produit géré par lot,
    // on consomme les lots FIFO (péremption la plus proche d'abord).
    let lotsConsommes = 0;
    if (delta < 0 && s.gere_lot) {
      const { rows: lots } = await cl.query(
        `SELECT id, quantite FROM lots
         WHERE produit_id=$1 AND magasin_id=$2 AND quantite > 0
         ORDER BY date_peremption ASC NULLS LAST, date_entree ASC, id ASC
         FOR UPDATE`,
        [produit_id, magasin_id]);
      let reste = qte, running = stockAvant;
      for (const lot of lots) {
        if (reste <= 0) break;
        const prise = Math.min(Number(lot.quantite), reste);
        await cl.query(`UPDATE lots SET quantite=quantite-$1 WHERE id=$2`, [prise, lot.id]);
        await cl.query(
          `INSERT INTO mouvements_stock (produit_id,type,quantite,stock_avant,stock_apres,motif,ref_doc,magasin_id,lot_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [produit_id, type, prise, running, running - prise, motif||'Démarque', ref_doc||null, magasin_id, lot.id]);
        running -= prise; reste -= prise; lotsConsommes++;
      }
      // Reliquat hors lot (stock hérité sans lot)
      if (reste > 0) {
        await cl.query(
          `INSERT INTO mouvements_stock (produit_id,type,quantite,stock_avant,stock_apres,motif,ref_doc,magasin_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [produit_id, type, reste, running, running - reste, motif||'Démarque', ref_doc||null, magasin_id]);
      }
      await cl.query('COMMIT');
      return ok(res,{ produit_id, type, quantite: qte, stock_avant: stockAvant, stock_apres: nouveau_stock, lots_consommes: lotsConsommes });
    }

    // Cas simple (entrée, ou produit sans gestion de lot) : un mouvement global
    const { rows:[mv] } = await cl.query(
      `INSERT INTO mouvements_stock (produit_id,type,quantite,stock_avant,stock_apres,motif,ref_doc,magasin_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [produit_id,type,qte,stockAvant,nouveau_stock,motif||'Ajustement manuel',ref_doc||null,magasin_id]);
    await cl.query('COMMIT');
    ok(res,{...mv, stock_avant:stockAvant, stock_apres:nouveau_stock});
  } catch(e){ await cl.query('ROLLBACK'); throw e; }
  finally { cl.release(); }
}));
stockRouter.post('/transfert', requirePerm('produits'), wrap(async (req, res) => {
  const cl = await db.connect();
  try {
    await cl.query('BEGIN');
    const { produit_id, magasin_source, magasin_dest, quantite, notes } = req.body;
    if(!produit_id || !magasin_source || !magasin_dest || !quantite || quantite <= 0)
      return fail(res, 'produit_id, magasin_source, magasin_dest et quantite requis', 400);
    if(magasin_source === magasin_dest)
      return fail(res, 'Source et destination identiques', 400);
    const { rows:[src] } = await cl.query(
      `SELECT quantite FROM stocks WHERE produit_id=$1 AND magasin_id=$2`,
      [produit_id, magasin_source]);
    if(!src || Number(src.quantite) < Number(quantite))
      return fail(res, 'Stock source insuffisant', 400);
    await cl.query(`UPDATE stocks SET quantite=quantite-$1 WHERE produit_id=$2 AND magasin_id=$3`,
      [quantite, produit_id, magasin_source]);
    await cl.query(
      `INSERT INTO stocks (produit_id,magasin_id,quantite,stock_alerte) VALUES ($1,$2,$3,5)
       ON CONFLICT (produit_id,magasin_id) DO UPDATE SET quantite=stocks.quantite+$3`,
      [produit_id, magasin_dest, quantite]);
    // Stock destination avant transfert
    const { rows:[dst] } = await cl.query(
      `SELECT COALESCE(quantite,0) AS quantite FROM stocks WHERE produit_id=$1 AND magasin_id=$2`,
      [produit_id, magasin_dest]);
    const qte       = Number(quantite);
    const srcAvant  = Number(src.quantite);
    const dst_avant = Number(dst?.quantite ?? 0);
    const ref = `TRF-${Date.now()}`;
    await cl.query(
      `INSERT INTO mouvements_stock (produit_id,type,quantite,stock_avant,stock_apres,motif,ref_doc,magasin_id) VALUES ($1,'sortie',$2,$3,$4,'Transfert sortie',$5,$6)`,
      [produit_id, qte, srcAvant, srcAvant - qte, ref, magasin_source]);
    await cl.query(
      `INSERT INTO mouvements_stock (produit_id,type,quantite,stock_avant,stock_apres,motif,ref_doc,magasin_id) VALUES ($1,'entree',$2,$3,$4,'Transfert entrée',$5,$6)`,
      [produit_id, qte, dst_avant, dst_avant + qte, ref, magasin_dest]);
    const { rows:[transfert] } = await cl.query(
      `INSERT INTO transferts_stock (produit_id,magasin_source,magasin_dest,quantite,notes,created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [produit_id, magasin_source, magasin_dest, quantite, notes||null, req.user?.sub||null]);
    await cl.query('COMMIT');
    ok(res, transfert);
  } catch(e){ await cl.query('ROLLBACK'); throw e; }
  finally { cl.release(); }
}));
// ─── LOTS & PÉREMPTION ────────────────────────────────────────────
// Liste des lots (optionnellement filtrés par produit / magasin)
stockRouter.get('/lots', wrap(async (req, res) => {
  const { produit_id } = req.query as Record<string,string>;
  const magasin_id = scopeMagasin(req);
  let q = `SELECT l.*, p.designation, p.reference, mg.nom AS magasin_nom,
             (l.date_peremption - CURRENT_DATE) AS jours_restants
           FROM lots l
           JOIN produits p  ON p.id  = l.produit_id
           JOIN magasins mg ON mg.id = l.magasin_id
           WHERE l.quantite > 0`;
  const p: unknown[] = [];
  if (magasin_id) { p.push(magasin_id); q += ` AND l.magasin_id=$${p.length}`; }
  if (produit_id) { p.push(+produit_id); q += ` AND l.produit_id=$${p.length}`; }
  q += ` ORDER BY l.date_peremption NULLS LAST, l.date_entree`;
  const { rows } = await db.query(q, p);
  ok(res, rows);
}));

// Lots proches de péremption (alerte) — seuil en jours via ?jours=7
stockRouter.get('/lots-expirant', wrap(async (req, res) => {
  const jours = Number((req.query as Record<string,string>).jours) || 7;
  const magasin_id = scopeMagasin(req);
  let q = `SELECT * FROM v_lots_expirant WHERE jours_restants <= $1`;
  const p: unknown[] = [jours];
  if (magasin_id) { p.push(magasin_id); q += ` AND magasin_id=$${p.length}`; }
  q += ` ORDER BY jours_restants`;
  const { rows } = await db.query(q, p);
  ok(res, rows);
}));

// Déclencher l'alerte de péremption (digest SMS/WA au gérant)
stockRouter.post('/alertes-expiration', requirePerm('produits'), wrap(async (req, res) => {
  const jours = Number((req.query as Record<string,string>).jours ?? req.body?.jours) || 7;
  const magasin_id = scopeMagasin(req);
  const r = await notif.alerteExpiration(db, jours, magasin_id);
  ok(res, r);
}));

// Créer un lot (entrée de stock avec date de péremption) — incrémente le stock
stockRouter.post('/lots', requirePerm('produits'), wrap(async (req, res) => {
  const cl = await db.connect();
  try {
    await cl.query('BEGIN');
    const { produit_id, numero_lot, date_peremption, quantite, prix_achat = 0 } = req.body;
    const magasin_id = scopeMagasin(req) ?? 1;
    const qte = Number(quantite);
    if (!produit_id || !qte || qte <= 0) { await cl.query('ROLLBACK'); return fail(res, 'produit_id et quantite (>0) requis', 400); }

    const { rows: [lot] } = await cl.query(
      `INSERT INTO lots (produit_id, magasin_id, numero_lot, date_peremption, quantite, prix_achat)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [produit_id, magasin_id, numero_lot || null, date_peremption || null, qte, prix_achat || 0]);

    // Incrémenter le stock du magasin
    const { rows: [s] } = await cl.query(
      `INSERT INTO stocks (produit_id, magasin_id, quantite, stock_alerte) VALUES ($1,$2,$3,5)
       ON CONFLICT (produit_id, magasin_id) DO UPDATE SET quantite = stocks.quantite + $3
       RETURNING quantite`, [produit_id, magasin_id, qte]);
    const stockApres = Number(s.quantite);

    await cl.query(
      `INSERT INTO mouvements_stock (produit_id,type,quantite,stock_avant,stock_apres,motif,ref_doc,magasin_id,lot_id)
       VALUES ($1,'entree',$2,$3,$4,'Réception lot',$5,$6,$7)`,
      [produit_id, qte, stockApres - qte, stockApres, lot.numero_lot || `LOT-${lot.id}`, magasin_id, lot.id]);

    await cl.query('COMMIT');
    ok(res, lot, 201);
  } catch (e) { await cl.query('ROLLBACK'); throw e; }
  finally { cl.release(); }
}));

stockRouter.get('/valorisation', wrap(async (req, res) => {
  const magasin_id = scopeMagasin(req);
  const mf = magasin_id ? `WHERE magasin_id=${magasin_id}` : '';
  const { rows } = await db.query(`
    SELECT
      COALESCE(SUM(quantite*prix_achat),0) valeur_totale,
      COALESCE(SUM(CASE WHEN quantite=0 THEN 1 ELSE 0 END),0) nb_ruptures,
      COALESCE(SUM(CASE WHEN quantite>0 AND quantite<stock_alerte THEN 1 ELSE 0 END),0) nb_alertes,
      COUNT(DISTINCT produit_id) nb_references,
      COALESCE(SUM(quantite),0) nb_total_unites
    FROM v_stocks ${mf}`);
  ok(res,rows[0]);
}));

// ─── OBJECTIFS ───────────────────────────────────────────────
export const objectifsRouter = Router();
objectifsRouter.get('/', wrap(async (req, res) => {
  const { annee=new Date().getFullYear(), mois=new Date().getMonth()+1 } = req.query as Record<string,string>;
  const [obj, reel] = await Promise.all([
    db.query(`SELECT o.*,u.prenom||' '||u.nom commercial FROM objectifs o LEFT JOIN utilisateurs u ON u.id=o.commercial_id WHERE o.annee=$1 AND o.mois=$2`,[annee,mois]),
    db.query(`SELECT COALESCE(SUM(total_ttc),0) ca_reel,COUNT(*) nb_ventes FROM ventes WHERE EXTRACT(YEAR FROM date_vente)=$1 AND EXTRACT(MONTH FROM date_vente)=$2`,[annee,mois]),
  ]);
  ok(res,{objectifs:obj.rows, reel:reel.rows[0]});
}));
objectifsRouter.post('/', requireRole('admin'), wrap(async (req, res) => {
  const { annee, mois, ca_cible, nb_ventes_cible=0, commercial_id, notes } = req.body;
  const { rows } = await db.query(
    `INSERT INTO objectifs (annee,mois,ca_cible,nb_ventes_cible,commercial_id,notes) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (annee,mois,commercial_id) DO UPDATE SET ca_cible=$3,nb_ventes_cible=$4,notes=$6 RETURNING *`,
    [annee,mois,ca_cible,nb_ventes_cible,commercial_id||null,notes||null]);
  ok(res,rows[0]);
}));

// ─── SEARCH GLOBAL ───────────────────────────────────────────
export const searchRouter = Router();
searchRouter.get('/', wrap(async (req, res) => {
  const { q='' } = req.query as Record<string,string>;
  if(q.length < 2) return ok(res,{clients:[],produits:[],ventes:[]});
  const term = `%${q}%`;
  const [clients,produits,ventes] = await Promise.all([
    db.query(`SELECT id, raison_sociale, telephone, type_client FROM clients WHERE raison_sociale ILIKE $1 OR telephone ILIKE $1 LIMIT 5`,[term]),
    db.query(`SELECT p.id, p.designation, p.reference, COALESCE(SUM(s.quantite),0) AS stock, p.prix_gros
      FROM produits p LEFT JOIN stocks s ON s.produit_id=p.id
      WHERE p.actif=TRUE AND (p.designation ILIKE $1 OR p.reference ILIKE $1)
      GROUP BY p.id LIMIT 5`,[term]),
    db.query(`SELECT v.id, v.numero, c.raison_sociale client_nom, v.total_ttc, v.date_vente FROM ventes v JOIN clients c ON c.id=v.client_id WHERE v.numero ILIKE $1 OR c.raison_sociale ILIKE $1 LIMIT 5`,[term]),
  ]);
  ok(res,{clients:clients.rows,produits:produits.rows,ventes:ventes.rows});
}));

// ─── RAPPORTS AVANCÉS ────────────────────────────────────────
export const rapportsAvancesRouter = Router();
rapportsAvancesRouter.get('/stock', wrap(async (req, res) => {
  const magasin_id = scopeMagasin(req);
  const mf = magasin_id ? `AND s.magasin_id=${magasin_id}` : '';
  const [valorisation, parCategorie, dormants, rotation] = await Promise.all([
    db.query(`SELECT
        COALESCE(SUM(sc.quantite_totale*p.prix_achat),0)  val_achat,
        COALESCE(SUM(sc.quantite_totale*p.prix_gros),0)   val_gros,
        COALESCE(SUM(sc.quantite_totale*p.prix_detail),0) val_detail,
        COUNT(p.id) references,
        COALESCE(SUM(sc.quantite_totale),0) unites
      FROM produits p JOIN v_stocks_consolide sc ON sc.produit_id=p.id WHERE p.actif=TRUE`),
    db.query(`SELECT c.libelle categorie, COUNT(p.id) nb_refs,
        COALESCE(SUM(sc.quantite_totale),0) stock_total,
        COALESCE(SUM(sc.quantite_totale*p.prix_achat),0) valeur
      FROM produits p
      LEFT JOIN categories c ON c.id=p.categorie_id
      LEFT JOIN v_stocks_consolide sc ON sc.produit_id=p.id
      WHERE p.actif=TRUE GROUP BY c.libelle ORDER BY valeur DESC`),
    db.query(`SELECT p.id,p.reference,p.designation,m.nom marque,
        COALESCE(SUM(s.quantite),0) stock,p.stock_alerte,p.prix_achat,
        COALESCE(SUM(s.quantite),0)*p.prix_achat valeur
      FROM produits p
      LEFT JOIN marques m ON m.id=p.marque_id
      LEFT JOIN stocks s ON s.produit_id=p.id ${mf}
      WHERE p.actif=TRUE
        AND (SELECT COALESCE(MAX(v.date_vente),'2000-01-01') FROM ventes_lignes vl JOIN ventes v ON v.id=vl.vente_id WHERE vl.produit_id=p.id)<CURRENT_DATE-90
      GROUP BY p.id,m.nom
      HAVING COALESCE(SUM(s.quantite),0)>0
      ORDER BY COALESCE(SUM(s.quantite),0)*p.prix_achat DESC LIMIT 20`),
    db.query(`SELECT p.id,p.reference,p.designation,
        COALESCE(SUM(vl.quantite),0) qte_vendue_30j,
        COALESCE((SELECT SUM(s2.quantite) FROM stocks s2 WHERE s2.produit_id=p.id ${mf}),0) stock
      FROM produits p
      LEFT JOIN ventes_lignes vl ON vl.produit_id=p.id
      LEFT JOIN ventes v ON v.id=vl.vente_id AND v.date_vente>=CURRENT_DATE-30
      WHERE p.actif=TRUE GROUP BY p.id ORDER BY qte_vendue_30j DESC LIMIT 20`),
  ]);
  ok(res,{valorisation:valorisation.rows[0],parCategorie:parCategorie.rows,dormants:dormants.rows,rotation:rotation.rows});
}));
rapportsAvancesRouter.get('/rentabilite', wrap(async (req, res) => {
  const { limit='20', tri='marge_brute' } = req.query as Record<string,string>;
  const cols = ['marge_brute','taux_marge','ca_total','qte_vendue'];
  const col = cols.includes(tri) ? tri : 'marge_brute';
  const [produits, global] = await Promise.all([
    db.query(`SELECT * FROM v_rentabilite_produits ORDER BY ${col} DESC LIMIT $1`,[+limit]),
    db.query(`SELECT COALESCE(SUM(ca_total),0) ca_total,COALESCE(SUM(marge_brute),0) marge_totale,CASE WHEN SUM(ca_total)>0 THEN ROUND(SUM(marge_brute)/SUM(ca_total)*100,1) ELSE 0 END taux_marge_global FROM v_rentabilite_produits`),
  ]);
  ok(res,{produits:produits.rows, global:global.rows[0]});
}));
rapportsAvancesRouter.get('/tresorerie', wrap(async (req, res) => {
  const magasin_id = scopeMagasin(req);
  const mf = magasin_id ? `AND magasin_id=${magasin_id}` : '';
  const { rows:[actuel] } = await db.query(`SELECT COALESCE(SUM(CASE WHEN type_paiement='encaissement' THEN montant END),0) entrees, COALESCE(SUM(CASE WHEN type_paiement='decaissement' THEN montant END),0) sorties FROM paiements WHERE date_paiement>=date_trunc('month',CURRENT_DATE) ${mf}`);
  const { rows:previsions } = await db.query(`
    SELECT date_trunc('week',date_echeance)::DATE semaine,
      SUM(CASE WHEN sens='client' THEN montant ELSE 0 END) encaissements_prevus,
      SUM(CASE WHEN sens='fournisseur' THEN montant ELSE 0 END) decaissements_prevus
    FROM v_echeances_30j WHERE 1=1 ${mf}
    GROUP BY 1 ORDER BY 1`);
  const { rows:historique } = await db.query(`
    SELECT to_char(date_trunc('month',date_paiement),'Mon YY') mois,
      SUM(CASE WHEN type_paiement='encaissement' THEN montant ELSE 0 END) entrees,
      SUM(CASE WHEN type_paiement='decaissement' THEN montant ELSE 0 END) sorties
    FROM paiements WHERE date_paiement>=CURRENT_DATE-INTERVAL '6 months' ${mf}
    GROUP BY 1 ORDER BY MIN(date_paiement)`);
  ok(res,{actuel,previsions,historique});
}));
rapportsAvancesRouter.get('/commercial', wrap(async (req, res) => {
  const { annee=new Date().getFullYear(), mois=new Date().getMonth()+1 } = req.query as Record<string,string>;
  const debut=`${annee}-${String(mois).padStart(2,'0')}-01`;
  const magasin_id = scopeMagasin(req);
  const mf = magasin_id ? `AND magasin_id=${magasin_id}` : '';
  const [parType, evolution, topClients] = await Promise.all([
    db.query(`SELECT type_vente,COUNT(*) nb,SUM(total_ttc) ca,SUM(montant_paye) encaisse,SUM(solde_restant) en_attente FROM ventes WHERE date_vente>=$1 ${mf} GROUP BY type_vente`,[debut]),
    db.query(`SELECT to_char(date_trunc('month',date_vente),'Mon YY') mois,SUM(total_ttc) ca,COUNT(*) nb_ventes FROM ventes WHERE date_vente>=CURRENT_DATE-INTERVAL '12 months' ${mf} GROUP BY 1 ORDER BY MIN(date_vente)`),
    db.query(`SELECT c.raison_sociale,c.type_client,SUM(v.total_ttc) ca,COUNT(v.id) nb_ventes,MAX(v.date_vente) derniere_vente FROM ventes v JOIN clients c ON c.id=v.client_id WHERE v.date_vente>=$1 ${mf} GROUP BY c.id ORDER BY ca DESC LIMIT 10`,[debut]),
  ]);
  ok(res,{parType:parType.rows, evolution:evolution.rows, topClients:topClients.rows});
}));

// ─── DÉPENSES ─────────────────────────────────────────────────
export const depensesRouter = Router();

depensesRouter.get('/', wrap(async (req, res) => {
  const { categorie, mois, debut, fin } = req.query as Record<string, string>;
  const magasin_id = scopeMagasin(req);
  const mf = magasin_id ? `AND p.magasin_id=${magasin_id}` : '';
  const mfRaw = magasin_id ? `AND magasin_id=${magasin_id}` : '';
  let q = `SELECT p.*, mp.nom moyen_paiement
            FROM paiements p
            LEFT JOIN moyens_paiement mp ON mp.id = p.moyen_paiement_id
            WHERE p.type_paiement = 'depense' ${mf}`;
  const params: unknown[] = [];
  if (categorie) { params.push(categorie); q += ` AND p.categorie_depense = $${params.length}`; }
  if (mois) { params.push(mois + '-01'); q += ` AND p.date_paiement >= $${params.length}::date AND p.date_paiement < ($${params.length}::date + INTERVAL '1 month')`; }
  if (debut) { params.push(debut); q += ` AND p.date_paiement >= $${params.length}::date`; }
  if (fin)   { params.push(fin);   q += ` AND p.date_paiement <= $${params.length}::date`; }
  q += ' ORDER BY p.date_paiement DESC';
  const { rows } = await db.query(q, params);

  const kpiWhere = debut && fin
    ? `AND date_paiement >= '${debut}'::date AND date_paiement <= '${fin}'::date`
    : `AND date_paiement >= date_trunc('month', CURRENT_DATE)`;
  const { rows: [kpi] } = await db.query(`
    SELECT COALESCE(SUM(montant),0) total_mois, COUNT(*) nb_depenses,
           COALESCE(SUM(montant),0) total_mois_courant
    FROM paiements WHERE type_paiement = 'depense' ${mfRaw} ${kpiWhere}
  `);
  const { rows: parCategorie } = await db.query(`
    SELECT categorie_depense, COALESCE(SUM(montant),0) total, COUNT(*) nb
    FROM paiements WHERE type_paiement = 'depense' ${mfRaw} ${kpiWhere}
    GROUP BY categorie_depense ORDER BY total DESC
  `);
  const { rows: evolution } = await db.query(`
    SELECT to_char(date_trunc('month', date_paiement), 'Mon YY') mois,
           COALESCE(SUM(montant),0) total
    FROM paiements
    WHERE type_paiement = 'depense' ${mfRaw} AND date_paiement >= CURRENT_DATE - INTERVAL '6 months'
    GROUP BY 1 ORDER BY MIN(date_paiement)
  `);

  ok(res, { depenses: rows, kpi, parCategorie, evolution });
}));

depensesRouter.post('/', requirePerm('paiements'), wrap(async (req, res) => {
  const { montant, date_paiement, categorie_depense, moyen_paiement_id, reference, notes, recurrence } = req.body;
  if (!montant || !categorie_depense) return fail(res, 'Montant et catégorie requis');
  const { rows } = await db.query(
    `INSERT INTO paiements (type_paiement, montant, date_paiement, categorie_depense, moyen_paiement_id, reference, notes, recurrence)
     VALUES ('depense', $1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [montant, date_paiement ?? new Date(), categorie_depense, moyen_paiement_id || null, reference || null, notes || null, recurrence || null]
  );
  ok(res, rows[0]);
}));

depensesRouter.put('/:id', requirePerm('paiements'), wrap(async (req, res) => {
  const { montant, date_paiement, categorie_depense, moyen_paiement_id, reference, notes, recurrence } = req.body;
  if (!montant || !categorie_depense) return fail(res, 'Montant et catégorie requis');
  const { rows } = await db.query(
    `UPDATE paiements SET montant=$1, date_paiement=$2, categorie_depense=$3, moyen_paiement_id=$4, reference=$5, notes=$6, recurrence=$7
     WHERE id=$8 AND type_paiement='depense' RETURNING *`,
    [montant, date_paiement, categorie_depense, moyen_paiement_id || null, reference || null, notes || null, recurrence || null, req.params.id]
  );
  if (!rows.length) return fail(res, 'Dépense introuvable', 404);
  ok(res, rows[0]);
}));

depensesRouter.delete('/:id', requirePerm('paiements'), wrap(async (req, res) => {
  await db.query(`DELETE FROM paiements WHERE id = $1 AND type_paiement = 'depense'`, [req.params.id]);
  ok(res, null);
}));

// Catégories de dépenses (référentiel)
depensesRouter.get('/categories', wrap(async (_, res) => {
  const { rows } = await db.query(`SELECT * FROM categories_depenses WHERE actif = TRUE ORDER BY libelle`);
  ok(res, rows);
}));

depensesRouter.post('/categories', requirePerm('paiements'), wrap(async (req, res) => {
  const { libelle } = req.body;
  if (!libelle?.trim()) return fail(res, 'Libellé requis');
  const { rows } = await db.query(
    `INSERT INTO categories_depenses (libelle) VALUES ($1) ON CONFLICT (libelle) DO UPDATE SET actif = TRUE RETURNING *`,
    [libelle.trim()]
  );
  ok(res, rows[0]);
}));

depensesRouter.put('/categories/:id', requirePerm('paiements'), wrap(async (req, res) => {
  const { libelle } = req.body;
  if (!libelle?.trim()) return fail(res, 'Libellé requis');
  const { rows } = await db.query(
    `UPDATE categories_depenses SET libelle = $1 WHERE id = $2 RETURNING *`,
    [libelle.trim(), req.params.id]
  );
  if (!rows.length) return fail(res, 'Catégorie introuvable', 404);
  ok(res, rows[0]);
}));

depensesRouter.delete('/categories/:id', requirePerm('paiements'), wrap(async (req, res) => {
  await db.query(`UPDATE categories_depenses SET actif = FALSE WHERE id = $1`, [req.params.id]);
  ok(res, null);
}));

// Générer les dépenses récurrentes du mois
depensesRouter.post('/generer-recurrentes', requirePerm('paiements'), wrap(async (_, res) => {
  const { rows: recurrentes } = await db.query(`
    SELECT DISTINCT ON (categorie_depense, montant) categorie_depense, montant, moyen_paiement_id, reference, notes, recurrence
    FROM paiements
    WHERE type_paiement = 'depense' AND recurrence IS NOT NULL
    ORDER BY categorie_depense, montant, date_paiement DESC
  `);

  let created = 0;
  for (const r of recurrentes) {
    const { rows: existing } = await db.query(
      `SELECT 1 FROM paiements WHERE type_paiement='depense' AND categorie_depense=$1 AND montant=$2
       AND date_paiement >= date_trunc('month', CURRENT_DATE) LIMIT 1`,
      [r.categorie_depense, r.montant]
    );
    if (!existing.length) {
      await db.query(
        `INSERT INTO paiements (type_paiement, montant, date_paiement, categorie_depense, moyen_paiement_id, reference, notes, recurrence)
         VALUES ('depense', $1, CURRENT_DATE, $2, $3, $4, $5, $6)`,
        [r.montant, r.categorie_depense, r.moyen_paiement_id, r.reference, r.notes, r.recurrence]
      );
      created++;
    }
  }
  ok(res, { created, message: `${created} dépense(s) récurrente(s) générée(s)` });
}));

// ─── MAGASINS ─────────────────────────────────────────────────
export const magasinsRouter = Router();
magasinsRouter.get('/', wrap(async (_, res) => {
  const { rows } = await db.query(`
    SELECT mg.*,
      COUNT(DISTINCT u.id) nb_utilisateurs,
      COALESCE(SUM(s.quantite * p.prix_achat), 0) valeur_stock
    FROM magasins mg
    LEFT JOIN utilisateurs_magasins um ON um.magasin_id = mg.id
    LEFT JOIN utilisateurs u ON u.id = um.utilisateur_id AND u.actif = TRUE
    LEFT JOIN stocks s ON s.magasin_id = mg.id
    LEFT JOIN produits p ON p.id = s.produit_id
    WHERE mg.actif = TRUE
    GROUP BY mg.id
    ORDER BY mg.nom
  `);
  ok(res, rows);
}));
magasinsRouter.get('/:id', wrap(async (req, res) => {
  const [mg, utilisateurs, stock] = await Promise.all([
    db.query(`SELECT * FROM magasins WHERE id=$1`, [req.params.id]),
    db.query(`SELECT u.id,u.code,u.nom,u.prenom,u.email,r.libelle role FROM utilisateurs u JOIN roles r ON r.id=u.role_id JOIN utilisateurs_magasins um ON um.utilisateur_id=u.id WHERE um.magasin_id=$1 AND u.actif=TRUE`, [req.params.id]),
    db.query(`SELECT * FROM v_stocks WHERE magasin_id=$1 ORDER BY designation`, [req.params.id]),
  ]);
  if (!mg.rows.length) return fail(res, 'Magasin non trouvé', 404);
  ok(res, { ...mg.rows[0], utilisateurs: utilisateurs.rows, stock: stock.rows });
}));
magasinsRouter.post('/', requireRole('admin'), wrap(async (req, res) => {
  const { code, nom, adresse, telephone, email } = req.body;
  if (!code?.trim() || !nom?.trim()) return fail(res, 'Code et nom requis', 400);
  const { rows } = await db.query(
    `INSERT INTO magasins (code, nom, adresse, telephone, email) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [code.trim(), nom.trim(), adresse||null, telephone||null, email||null]);
  ok(res, rows[0]);
}));
magasinsRouter.put('/:id', requireRole('admin'), wrap(async (req, res) => {
  const { nom, adresse, telephone, email, actif } = req.body;
  const { rows } = await db.query(
    `UPDATE magasins SET nom=$1,adresse=$2,telephone=$3,email=$4,actif=$5 WHERE id=$6 RETURNING *`,
    [nom, adresse||null, telephone||null, email||null, actif??true, req.params.id]);
  if (!rows.length) return fail(res, 'Magasin non trouvé', 404);
  ok(res, rows[0]);
}));
magasinsRouter.get('/:id/stock', wrap(async (req, res) => {
  const { rows } = await db.query(`SELECT * FROM v_stocks WHERE magasin_id=$1 ORDER BY designation`, [req.params.id]);
  ok(res, rows);
}));
magasinsRouter.get('/:id/transferts', wrap(async (req, res) => {
  const { rows } = await db.query(
    `SELECT t.*,p.designation,p.reference,ms.nom magasin_source_nom,md.nom magasin_dest_nom
     FROM transferts_stock t
     JOIN produits p ON p.id=t.produit_id
     JOIN magasins ms ON ms.id=t.magasin_source
     JOIN magasins md ON md.id=t.magasin_dest
     WHERE t.magasin_source=$1 OR t.magasin_dest=$1
     ORDER BY t.created_at DESC LIMIT 100`,
    [req.params.id]);
  ok(res, rows);
}));

