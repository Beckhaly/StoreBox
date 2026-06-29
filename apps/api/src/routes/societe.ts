import { Router } from 'express';
import { db } from '../lib/db';
import { ok, fail, wrap } from '../lib/helpers';
import { requirePerm } from '../middleware/auth';

const router = Router();

// GET /api/societe - Récupère les paramètres actuels de la société
router.get('/', wrap(async (req, res) => {
  const { rows } = await db.query('SELECT * FROM societe_parametres ORDER BY id DESC LIMIT 1');
  if (!rows.length) {
    return ok(res, {
      nom: 'StoreBox',
      raison_sociale: 'StoreBox SARL',
      email: 'info@storebox.app',
      telephone: '+225 27 22 XX XX XX',
      ville: 'Abidjan',
      pays: 'Côte d\'Ivoire',
      devise: 'XOF',
      tva_defaut: 18.00,
      langue: 'fr',
    });
  }
  ok(res, rows[0]);
}));

// GET /api/societe/:id - Récupère un paramètre complet (rare, surtout pour admin)
router.get('/:id', requirePerm('admin'), wrap(async (req, res) => {
  const { id } = req.params;
  const { rows } = await db.query('SELECT * FROM societe_parametres WHERE id = $1', [id]);
  if (!rows.length) return fail(res, 'Paramètres non trouvés', 404);
  ok(res, rows[0]);
}));

// PUT /api/societe - Met à jour les paramètres de la société (admin only)
router.put('/', requirePerm('admin'), wrap(async (req, res) => {
  const {
    nom,
    raison_sociale,
    slogan,
    description,
    telephone,
    telephone2,
    email,
    email_facturation,
    adresse,
    adresse2,
    ville,
    code_postal,
    pays,
    rccm,
    numero_impot,
    numero_compte_bancaire,
    iban,
    swift,
    nom_banque,
    adresse_banque,
    telephone_banque,
    devise,
    tva_defaut,
    langue,
    format_date,
    logo_url,
    couleur_primaire,
    couleur_secondaire,
    signature_dirigeant,
    signature_comptable,
  } = req.body;

  // Récupérer l'ID du dernier enregistrement (il n'y en a qu'un)
  const { rows: existingRows } = await db.query(
    'SELECT id FROM societe_parametres ORDER BY id DESC LIMIT 1'
  );

  if (!existingRows.length) {
    // Créer le premier enregistrement
    const { rows } = await db.query(
      `INSERT INTO societe_parametres (
        nom, raison_sociale, slogan, description, telephone, telephone2, email, email_facturation,
        adresse, adresse2, ville, code_postal, pays,
        rccm, numero_impot, numero_compte_bancaire, iban, swift,
        nom_banque, adresse_banque, telephone_banque,
        devise, tva_defaut, langue, format_date,
        logo_url, couleur_primaire, couleur_secondaire,
        signature_dirigeant, signature_comptable, updated_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18,
        $19, $20, $21,
        $22, $23, $24, $25,
        $26, $27, $28,
        $29, $30, $31
      ) RETURNING *`,
      [
        nom,
        raison_sociale,
        slogan,
        description,
        telephone,
        telephone2,
        email,
        email_facturation,
        adresse,
        adresse2,
        ville,
        code_postal,
        pays,
        rccm,
        numero_impot,
        numero_compte_bancaire,
        iban,
        swift,
        nom_banque,
        adresse_banque,
        telephone_banque,
        devise,
        tva_defaut,
        langue,
        format_date,
        logo_url,
        couleur_primaire,
        couleur_secondaire,
        signature_dirigeant,
        signature_comptable,
        req.user?.id,
      ]
    );
    return ok(res, rows[0], 201);
  }

  // Mettre à jour l'enregistrement existant
  const id = existingRows[0].id;
  const updates: string[] = [];
  const values: unknown[] = [];
  let counter = 1;

  if (nom !== undefined) { updates.push(`nom = $${counter++}`); values.push(nom); }
  if (raison_sociale !== undefined) { updates.push(`raison_sociale = $${counter++}`); values.push(raison_sociale); }
  if (slogan !== undefined) { updates.push(`slogan = $${counter++}`); values.push(slogan); }
  if (description !== undefined) { updates.push(`description = $${counter++}`); values.push(description); }
  if (telephone !== undefined) { updates.push(`telephone = $${counter++}`); values.push(telephone); }
  if (telephone2 !== undefined) { updates.push(`telephone2 = $${counter++}`); values.push(telephone2); }
  if (email !== undefined) { updates.push(`email = $${counter++}`); values.push(email); }
  if (email_facturation !== undefined) { updates.push(`email_facturation = $${counter++}`); values.push(email_facturation); }
  if (adresse !== undefined) { updates.push(`adresse = $${counter++}`); values.push(adresse); }
  if (adresse2 !== undefined) { updates.push(`adresse2 = $${counter++}`); values.push(adresse2); }
  if (ville !== undefined) { updates.push(`ville = $${counter++}`); values.push(ville); }
  if (code_postal !== undefined) { updates.push(`code_postal = $${counter++}`); values.push(code_postal); }
  if (pays !== undefined) { updates.push(`pays = $${counter++}`); values.push(pays); }
  if (rccm !== undefined) { updates.push(`rccm = $${counter++}`); values.push(rccm); }
  if (numero_impot !== undefined) { updates.push(`numero_impot = $${counter++}`); values.push(numero_impot); }
  if (numero_compte_bancaire !== undefined) { updates.push(`numero_compte_bancaire = $${counter++}`); values.push(numero_compte_bancaire); }
  if (iban !== undefined) { updates.push(`iban = $${counter++}`); values.push(iban); }
  if (swift !== undefined) { updates.push(`swift = $${counter++}`); values.push(swift); }
  if (nom_banque !== undefined) { updates.push(`nom_banque = $${counter++}`); values.push(nom_banque); }
  if (adresse_banque !== undefined) { updates.push(`adresse_banque = $${counter++}`); values.push(adresse_banque); }
  if (telephone_banque !== undefined) { updates.push(`telephone_banque = $${counter++}`); values.push(telephone_banque); }
  if (devise !== undefined) { updates.push(`devise = $${counter++}`); values.push(devise); }
  if (tva_defaut !== undefined) { updates.push(`tva_defaut = $${counter++}`); values.push(tva_defaut); }
  if (langue !== undefined) { updates.push(`langue = $${counter++}`); values.push(langue); }
  if (format_date !== undefined) { updates.push(`format_date = $${counter++}`); values.push(format_date); }
  if (logo_url !== undefined) { updates.push(`logo_url = $${counter++}`); values.push(logo_url); }
  if (couleur_primaire !== undefined) { updates.push(`couleur_primaire = $${counter++}`); values.push(couleur_primaire); }
  if (couleur_secondaire !== undefined) { updates.push(`couleur_secondaire = $${counter++}`); values.push(couleur_secondaire); }
  if (signature_dirigeant !== undefined) { updates.push(`signature_dirigeant = $${counter++}`); values.push(signature_dirigeant); }
  if (signature_comptable !== undefined) { updates.push(`signature_comptable = $${counter++}`); values.push(signature_comptable); }
  updates.push(`updated_by = $${counter++}`);
  values.push(req.user?.id);

  if (updates.length === 1) return fail(res, 'Aucun champ à mettre à jour');

  values.push(id);
  const query = `UPDATE societe_parametres SET ${updates.join(', ')} WHERE id = $${counter} RETURNING *`;
  const { rows } = await db.query(query, values);

  if (!rows.length) return fail(res, 'Erreur mise à jour', 500);
  ok(res, rows[0]);
}));

export default router;
