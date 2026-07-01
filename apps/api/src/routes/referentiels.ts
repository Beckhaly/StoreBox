import { Router } from 'express';
import { db } from '../lib/db';
import { ok, fail, wrap } from '../lib/helpers';
import { requirePerm } from '../middleware/auth';

const router = Router();

// Tables de références disponibles avec leurs configurations
const REFERENTIELS = {
  types_clients: { table: 'types_clients', perm: 'admin' },
  statuts_clients: { table: 'statuts_clients', perm: 'admin' },
  types_ventes: { table: 'types_ventes', perm: 'admin' },
  statuts_paiements_ventes: { table: 'statuts_paiements_ventes', perm: 'admin' },
  statuts_paiements_achats: { table: 'statuts_paiements_achats', perm: 'admin' },
  types_mouvements_stock: { table: 'types_mouvements_stock', perm: 'admin' },
  canaux_notification: { table: 'canaux_notification', perm: 'admin' },
  statuts_notification: { table: 'statuts_notification', perm: 'admin' },
  statuts_devis: { table: 'statuts_devis', perm: 'admin' },
  types_avoir: { table: 'types_avoir', perm: 'admin' },
  statuts_avoir: { table: 'statuts_avoir', perm: 'admin' },
  statuts_reception: { table: 'statuts_reception', perm: 'admin' },
  types_paiement: { table: 'types_paiement', perm: 'admin' },
  // Référentiels produits (marques, catégories) et paiements
  marques: { table: 'marques', perm: 'admin' },
  categories: { table: 'categories', perm: 'admin' },
  categories_prix: { table: 'categories_prix', perm: 'admin' },
  categories_depenses: { table: 'categories_depenses', perm: 'admin' },
  moyens_paiement: { table: 'moyens_paiement', perm: 'admin' },
  unites_mesure: { table: 'unites_mesure', perm: 'admin' },
};

// GET /api/referentiels - Récupère tous les référentiels
router.get('/', wrap(async (req, res) => {
  const result: Record<string, any> = {};

  // Tables spéciales sans colonnes actif/ordre
  const simpleTablesqueries: Record<string, string> = {
    moyens_paiement: 'SELECT * FROM moyens_paiement ORDER BY id',
  };

  for (const [key, ref] of Object.entries(REFERENTIELS)) {
    // Utiliser la requête personnalisée si elle existe
    const query = simpleTablesqueries[ref.table]
      || `SELECT * FROM ${ref.table} WHERE actif = TRUE ORDER BY COALESCE(ordre, 0), COALESCE(libelle, '')`;

    const { rows } = await db.query(query);
    result[key] = rows;
  }

  ok(res, result);
}));

// GET /api/referentiels/:type/all - Récupère tous les items (actif et inactif)
router.get('/:type/all', requirePerm('admin'), wrap(async (req, res) => {
  const { type } = req.params;
  const ref = REFERENTIELS[type as keyof typeof REFERENTIELS];
  if (!ref) return fail(res, 'Référentiel non trouvé', 404);

  // Requêtes personnalisées pour tables sans colonne 'ordre'
  const simpleTablesqueries: Record<string, string> = {
    moyens_paiement: 'SELECT * FROM moyens_paiement ORDER BY id',
  };

  const query = simpleTablesqueries[ref.table]
    || `SELECT * FROM ${ref.table} ORDER BY COALESCE(ordre, 0), COALESCE(libelle, '')`;

  const { rows } = await db.query(query);
  ok(res, rows);
}));

// GET /api/referentiels/:type/:id - Récupère un item spécifique
router.get('/:type/:id', wrap(async (req, res) => {
  const { type, id } = req.params;
  const ref = REFERENTIELS[type as keyof typeof REFERENTIELS];
  if (!ref) return fail(res, 'Référentiel non trouvé', 404);

  const { rows } = await db.query(`SELECT * FROM ${ref.table} WHERE id = $1`, [id]);
  if (!rows.length) return fail(res, 'Item non trouvé', 404);
  ok(res, rows[0]);
}));

// POST /api/referentiels/:type - Crée un nouvel item
router.post('/:type', requirePerm('admin'), wrap(async (req, res) => {
  const { type } = req.params;
  const ref = REFERENTIELS[type as keyof typeof REFERENTIELS];
  if (!ref) return fail(res, 'Référentiel non trouvé', 404);

  const { code, libelle, couleur, signe, icone, ordre = 0, actif = true } = req.body;

  if (!code || !libelle) return fail(res, 'code et libelle requis');

  // Construction dynamique de l'INSERT en fonction des champs disponibles
  const colonnes = ['code', 'libelle', 'ordre', 'actif'];
  const valeurs = [code, libelle, ordre, actif];
  const placeholders = valeurs.map((_, i) => `$${i + 1}`);

  if (couleur) { colonnes.push('couleur'); valeurs.push(couleur); }
  if (signe) { colonnes.push('signe'); valeurs.push(signe); }
  if (icone) { colonnes.push('icone'); valeurs.push(icone); }

  const query = `INSERT INTO ${ref.table} (${colonnes.join(',')}) VALUES (${placeholders.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`;
  const { rows } = await db.query(query, valeurs);
  ok(res, rows[0], 201);
}));

// PUT /api/referentiels/:type/:id - Met à jour un item
router.put('/:type/:id', requirePerm('admin'), wrap(async (req, res) => {
  const { type, id } = req.params;
  const ref = REFERENTIELS[type as keyof typeof REFERENTIELS];
  if (!ref) return fail(res, 'Référentiel non trouvé', 404);

  const { code, libelle, couleur, signe, icone, ordre, actif } = req.body;

  // Construire dynamiquement l'UPDATE
  const updates: string[] = [];
  const values: unknown[] = [];
  let counter = 1;

  if (code) { updates.push(`code = $${counter++}`); values.push(code); }
  if (libelle) { updates.push(`libelle = $${counter++}`); values.push(libelle); }
  if (couleur !== undefined) { updates.push(`couleur = $${counter++}`); values.push(couleur); }
  if (signe !== undefined) { updates.push(`signe = $${counter++}`); values.push(signe); }
  if (icone !== undefined) { updates.push(`icone = $${counter++}`); values.push(icone); }
  if (ordre !== undefined) { updates.push(`ordre = $${counter++}`); values.push(ordre); }
  if (actif !== undefined) { updates.push(`actif = $${counter++}`); values.push(actif); }

  if (!updates.length) return fail(res, 'Aucun champ à mettre à jour');

  values.push(id);
  const query = `UPDATE ${ref.table} SET ${updates.join(', ')} WHERE id = $${counter} RETURNING *`;
  const { rows } = await db.query(query, values);

  if (!rows.length) return fail(res, 'Item non trouvé', 404);
  ok(res, rows[0]);
}));

// DELETE /api/referentiels/:type/:id - Supprime (désactive) un item
router.delete('/:type/:id', requirePerm('admin'), wrap(async (req, res) => {
  const { type, id } = req.params;
  const ref = REFERENTIELS[type as keyof typeof REFERENTIELS];
  if (!ref) return fail(res, 'Référentiel non trouvé', 404);

  const { rows } = await db.query(`UPDATE ${ref.table} SET actif = FALSE WHERE id = $1 RETURNING *`, [id]);
  if (!rows.length) return fail(res, 'Item non trouvé', 404);
  ok(res, rows[0]);
}));

// GET /api/referentiels/:type - Récupère tous les items d'un référentiel (doit être DERNIER)
router.get('/:type', wrap(async (req, res) => {
  const { type } = req.params;
  const ref = REFERENTIELS[type as keyof typeof REFERENTIELS];
  if (!ref) return fail(res, 'Référentiel non trouvé', 404);

  const { rows } = await db.query(`SELECT * FROM ${ref.table} WHERE actif = TRUE ORDER BY ordre, libelle`);
  ok(res, rows);
}));

export default router;
