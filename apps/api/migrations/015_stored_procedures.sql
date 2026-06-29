-- ============================================================
-- StoreBox — Migration 015 : Procédures stockées PostgreSQL
-- Remplace les requêtes SQL dans le backend par des SP
-- ============================================================

-- ─── AUTH ────────────────────────────────────────────────
-- NB : bloque_jusqu est TIMESTAMPTZ (et non TIMESTAMP) pour matcher le schema.
-- is_super_admin absent en colonne -> litteral FALSE.
-- magasin_ids / magasin_noms viennent de v_utilisateurs_magasins (multi-magasin).
CREATE OR REPLACE FUNCTION sp_auth_login(
  p_email VARCHAR
)
RETURNS TABLE (
  id INT,
  code VARCHAR,
  nom VARCHAR,
  prenom VARCHAR,
  email VARCHAR,
  telephone VARCHAR,
  actif BOOLEAN,
  bloque_jusqu TIMESTAMPTZ,
  tentatives_echec INT,
  password_hash VARCHAR,
  role_id INT,
  role_code VARCHAR,
  role_libelle VARCHAR,
  permissions JSONB,
  is_super_admin BOOLEAN,
  magasin_ids INTEGER[],
  magasin_noms VARCHAR[]
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      u.id, u.code, u.nom, u.prenom, u.email, u.telephone,
      u.actif, u.bloque_jusqu, u.tentatives_echec, u.password_hash,
      r.id AS role_id, r.code AS role_code, r.libelle AS role_libelle,
      r.permissions,
      FALSE::boolean AS is_super_admin,
      COALESCE(vm.magasin_ids,  ARRAY[]::integer[])          AS magasin_ids,
      COALESCE(vm.magasin_noms, ARRAY[]::character varying[]) AS magasin_noms
    FROM utilisateurs u
    JOIN roles r ON r.id = u.role_id
    LEFT JOIN v_utilisateurs_magasins vm ON vm.utilisateur_id = u.id
    WHERE LOWER(u.email) = LOWER(p_email)
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ─── VENTES ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sp_ventes_list(
  p_magasin_id INT DEFAULT NULL,
  p_limit INT DEFAULT 100,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id INT,
  numero VARCHAR,
  client_id INT,
  client_nom VARCHAR,
  type_vente VARCHAR,
  date_vente DATE,
  sous_total NUMERIC,
  remise_pct NUMERIC,
  remise_montant NUMERIC,
  tva_pct NUMERIC,
  tva_montant NUMERIC,
  total_ttc NUMERIC,
  montant_paye NUMERIC,
  solde_restant NUMERIC,
  statut_paiement VARCHAR,
  moyen_paiement_nom VARCHAR
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      v.id, v.numero, v.client_id, c.raison_sociale,
      v.type_vente, v.date_vente,
      v.sous_total, v.remise_pct, v.remise_montant,
      v.tva_pct, v.tva_montant, v.total_ttc,
      v.montant_paye, v.solde_restant, v.statut_paiement,
      mp.nom
    FROM ventes v
    JOIN clients c ON c.id = v.client_id
    LEFT JOIN moyens_paiement mp ON mp.id = v.moyen_paiement_id
    WHERE (p_magasin_id IS NULL OR v.magasin_id = p_magasin_id)
    ORDER BY v.date_vente DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sp_ventes_list_filters(
  p_magasin_id INT DEFAULT NULL,
  p_type_vente VARCHAR DEFAULT NULL,
  p_statut VARCHAR DEFAULT NULL,
  p_client_id INT DEFAULT NULL,
  p_date_debut DATE DEFAULT NULL,
  p_date_fin DATE DEFAULT NULL,
  p_limit INT DEFAULT 100,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id INT,
  numero VARCHAR,
  client_id INT,
  client_nom VARCHAR,
  type_vente VARCHAR,
  date_vente DATE,
  sous_total NUMERIC,
  remise_pct NUMERIC,
  remise_montant NUMERIC,
  tva_pct NUMERIC,
  tva_montant NUMERIC,
  total_ttc NUMERIC,
  montant_paye NUMERIC,
  solde_restant NUMERIC,
  statut_paiement VARCHAR,
  moyen_paiement_nom VARCHAR
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      v.id, v.numero, v.client_id, c.raison_sociale,
      v.type_vente, v.date_vente,
      v.sous_total, v.remise_pct, v.remise_montant,
      v.tva_pct, v.tva_montant, v.total_ttc,
      v.montant_paye, v.solde_restant, v.statut_paiement,
      mp.nom
    FROM ventes v
    JOIN clients c ON c.id = v.client_id
    LEFT JOIN moyens_paiement mp ON mp.id = v.moyen_paiement_id
    WHERE (p_magasin_id IS NULL OR v.magasin_id = p_magasin_id)
      AND (p_type_vente IS NULL OR v.type_vente = p_type_vente)
      AND (p_statut IS NULL OR v.statut_paiement = p_statut)
      AND (p_client_id IS NULL OR v.client_id = p_client_id)
      AND (p_date_debut IS NULL OR v.date_vente >= p_date_debut)
      AND (p_date_fin IS NULL OR v.date_vente <= p_date_fin)
    ORDER BY v.date_vente DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sp_ventes_get(
  p_id INT
)
RETURNS TABLE (
  id INT,
  numero VARCHAR,
  client_id INT,
  client_nom VARCHAR,
  type_vente VARCHAR,
  date_vente DATE,
  date_echeance DATE,
  sous_total NUMERIC,
  remise_pct NUMERIC,
  remise_montant NUMERIC,
  tva_pct NUMERIC,
  tva_montant NUMERIC,
  total_ttc NUMERIC,
  montant_paye NUMERIC,
  solde_restant NUMERIC,
  statut_paiement VARCHAR,
  moyen_paiement_id INT,
  moyen_paiement_nom VARCHAR,
  notes TEXT,
  magasin_id INT,
  created_by INT,
  created_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      v.id, v.numero, v.client_id, c.raison_sociale,
      v.type_vente, v.date_vente, v.date_echeance,
      v.sous_total, v.remise_pct, v.remise_montant,
      v.tva_pct, v.tva_montant, v.total_ttc,
      v.montant_paye, v.solde_restant, v.statut_paiement,
      v.moyen_paiement_id, mp.nom,
      v.notes, v.magasin_id, v.created_by, v.created_at
    FROM ventes v
    JOIN clients c ON c.id = v.client_id
    LEFT JOIN moyens_paiement mp ON mp.id = v.moyen_paiement_id
    WHERE v.id = p_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sp_ventes_lignes_list(
  p_vente_id INT
)
RETURNS TABLE (
  id INT,
  vente_id INT,
  produit_id INT,
  produit_nom VARCHAR,
  quantite NUMERIC,
  prix_unitaire NUMERIC,
  remise_pct NUMERIC,
  montant_ht NUMERIC
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      vl.id, vl.vente_id, vl.produit_id, p.nom,
      vl.quantite, vl.prix_unitaire, vl.remise_pct,
      (vl.quantite * vl.prix_unitaire * (1 - vl.remise_pct / 100))::NUMERIC
    FROM ventes_lignes vl
    JOIN produits p ON p.id = vl.produit_id
    WHERE vl.vente_id = p_vente_id
    ORDER BY vl.id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sp_ventes_paiements_list(
  p_vente_id INT
)
RETURNS TABLE (
  id INT,
  vente_id INT,
  montant NUMERIC,
  date_paiement DATE,
  moyen_paiement_nom VARCHAR,
  reference VARCHAR,
  notes TEXT
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      p.id, p.vente_id, p.montant, p.date_paiement,
      mp.nom, p.reference, p.notes
    FROM paiements p
    LEFT JOIN moyens_paiement mp ON mp.id = p.moyen_paiement_id
    WHERE p.vente_id = p_vente_id
    ORDER BY p.date_paiement DESC;
END;
$$ LANGUAGE plpgsql;

-- NB : p_date_echeance ne porte PAS de DEFAULT (un parametre par defaut ne peut
-- pas etre suivi de parametres sans defaut en PostgreSQL). Tous les appelants
-- fournissent ce parametre explicitement.
CREATE OR REPLACE FUNCTION sp_ventes_create_complete(
  p_magasin_id INT,
  p_client_id INT,
  p_type_vente VARCHAR,
  p_date_vente DATE,
  p_date_echeance DATE,
  p_sous_total NUMERIC,
  p_remise_pct NUMERIC,
  p_remise_montant NUMERIC,
  p_tva_pct NUMERIC,
  p_tva_montant NUMERIC,
  p_total_ttc NUMERIC,
  p_moyen_paiement_id INT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_montant_paye NUMERIC DEFAULT 0,
  p_lignes_json JSONB DEFAULT NULL,
  p_created_by INT DEFAULT NULL
)
RETURNS TABLE (
  id INT,
  numero VARCHAR,
  total_ttc NUMERIC
) AS $$
DECLARE
  v_numero VARCHAR;
  v_id INT;
  v_ligne JSONB;
  v_solde NUMERIC;
BEGIN
  -- Générer numéro
  SELECT 'VTE-' || LPAD((COALESCE(MAX(id), 1000) + 1)::VARCHAR, 6, '0') INTO v_numero FROM ventes;

  -- Créer vente
  INSERT INTO ventes (
    numero, magasin_id, client_id, type_vente, date_vente, date_echeance,
    sous_total, remise_pct, remise_montant, tva_pct, tva_montant, total_ttc,
    montant_paye, solde_restant, statut_paiement, moyen_paiement_id, notes, created_by
  ) VALUES (
    v_numero, p_magasin_id, p_client_id, p_type_vente, p_date_vente, p_date_echeance,
    p_sous_total, p_remise_pct, p_remise_montant, p_tva_pct, p_tva_montant, p_total_ttc,
    p_montant_paye, p_total_ttc - p_montant_paye,
    CASE WHEN p_montant_paye >= p_total_ttc THEN 'paye' ELSE 'non_paye' END,
    p_moyen_paiement_id, p_notes, p_created_by
  )
  RETURNING ventes.id INTO v_id;

  -- Ajouter lignes si JSON fourni
  IF p_lignes_json IS NOT NULL THEN
    FOR v_ligne IN SELECT jsonb_array_elements(p_lignes_json)
    LOOP
      INSERT INTO ventes_lignes (
        vente_id, produit_id, quantite, prix_unitaire, remise_pct
      ) VALUES (
        v_id,
        (v_ligne->>'produit_id')::INT,
        (v_ligne->>'quantite')::NUMERIC,
        (v_ligne->>'prix_unitaire')::NUMERIC,
        COALESCE((v_ligne->>'remise_pct')::NUMERIC, 0)
      );
    END LOOP;
  END IF;

  -- Ajouter paiement initial si montant fourni
  IF p_montant_paye > 0 THEN
    INSERT INTO paiements (
      vente_id, montant, date_paiement, moyen_paiement_id
    ) VALUES (
      v_id, p_montant_paye, p_date_vente, p_moyen_paiement_id
    );
  END IF;

  RETURN QUERY SELECT v_id, v_numero, p_total_ttc;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sp_ventes_paiement_add(
  p_vente_id INT,
  p_montant NUMERIC,
  p_date_paiement DATE,
  p_moyen_paiement_id INT DEFAULT NULL,
  p_reference VARCHAR DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  id INT,
  vente_id INT,
  montant NUMERIC,
  montant_total_paye NUMERIC,
  solde_restant NUMERIC,
  nouveau_statut VARCHAR
) AS $$
DECLARE
  v_paiement_id INT;
  v_total_ttc NUMERIC;
  v_montant_paye_avant NUMERIC;
  v_montant_paye_apres NUMERIC;
  v_nouveau_statut VARCHAR;
BEGIN
  -- Récupérer infos vente
  SELECT total_ttc, montant_paye INTO v_total_ttc, v_montant_paye_avant
  FROM ventes WHERE id = p_vente_id;

  IF v_total_ttc IS NULL THEN
    RAISE EXCEPTION 'Vente non trouvée';
  END IF;

  -- Insérer paiement
  INSERT INTO paiements (
    vente_id, montant, date_paiement, moyen_paiement_id, reference, notes
  ) VALUES (
    p_vente_id, p_montant, p_date_paiement, p_moyen_paiement_id, p_reference, p_notes
  )
  RETURNING paiements.id INTO v_paiement_id;

  -- Recalculer montant payé et statut
  SELECT SUM(montant) INTO v_montant_paye_apres FROM paiements WHERE vente_id = p_vente_id;
  v_montant_paye_apres := COALESCE(v_montant_paye_apres, 0);

  IF v_montant_paye_apres >= v_total_ttc THEN
    v_nouveau_statut := 'paye';
  ELSIF v_montant_paye_apres > 0 THEN
    v_nouveau_statut := 'partiel';
  ELSE
    v_nouveau_statut := 'non_paye';
  END IF;

  -- Mettre à jour vente
  UPDATE ventes SET
    montant_paye = v_montant_paye_apres,
    solde_restant = v_total_ttc - v_montant_paye_apres,
    statut_paiement = v_nouveau_statut
  WHERE id = p_vente_id;

  RETURN QUERY
    SELECT
      v_paiement_id,
      p_vente_id,
      p_montant,
      v_montant_paye_apres,
      v_total_ttc - v_montant_paye_apres,
      v_nouveau_statut;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sp_ventes_update(
  p_id INT,
  p_notes TEXT DEFAULT NULL,
  p_date_echeance DATE DEFAULT NULL
)
RETURNS TABLE (
  id INT,
  numero VARCHAR,
  notes TEXT,
  date_echeance DATE
) AS $$
BEGIN
  UPDATE ventes SET
    notes = COALESCE(p_notes, notes),
    date_echeance = COALESCE(p_date_echeance, date_echeance)
  WHERE id = p_id;

  RETURN QUERY
    SELECT v.id, v.numero, v.notes, v.date_echeance
    FROM ventes v WHERE v.id = p_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sp_ventes_cancel(
  p_id INT
)
RETURNS void AS $$
BEGIN
  UPDATE ventes SET
    statut_paiement = 'annulee',
    solde_restant = 0,
    montant_paye = total_ttc
  WHERE id = p_id;

  -- TODO: Restaurer stock, créer mouvements négatifs
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sp_ventes_kpi_ca_mois(
  p_magasin_id INT DEFAULT NULL,
  p_type_vente VARCHAR DEFAULT NULL
)
RETURNS TABLE (
  ca_total NUMERIC,
  nombre_ventes INT,
  panier_moyen NUMERIC,
  montant_paye NUMERIC,
  solde_en_cours NUMERIC
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      COALESCE(SUM(v.total_ttc), 0)::NUMERIC,
      COUNT(*)::INT,
      COALESCE(AVG(v.total_ttc), 0)::NUMERIC,
      COALESCE(SUM(v.montant_paye), 0)::NUMERIC,
      COALESCE(SUM(v.solde_restant), 0)::NUMERIC
    FROM ventes v
    WHERE DATE_TRUNC('month', v.date_vente) = DATE_TRUNC('month', NOW())
      AND (p_magasin_id IS NULL OR v.magasin_id = p_magasin_id)
      AND (p_type_vente IS NULL OR v.type_vente = p_type_vente);
END;
$$ LANGUAGE plpgsql;

-- ─── CLIENTS ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sp_clients_list(
  p_type_client VARCHAR DEFAULT NULL,
  p_statut VARCHAR DEFAULT NULL,
  p_search VARCHAR DEFAULT NULL
)
RETURNS TABLE (
  id INT,
  code VARCHAR,
  type_client VARCHAR,
  raison_sociale VARCHAR,
  contact_nom VARCHAR,
  telephone VARCHAR,
  email VARCHAR,
  adresse TEXT,
  ville VARCHAR,
  plafond_credit NUMERIC,
  delai_paiement INT,
  statut VARCHAR,
  ca_total NUMERIC,
  encours_creance NUMERIC
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      c.id, c.code, c.type_client, c.raison_sociale, c.contact_nom,
      c.telephone, c.email, c.adresse, c.ville,
      c.plafond_credit, c.delai_paiement, c.statut,
      COALESCE(SUM(v.total_ttc), 0)::NUMERIC,
      COALESCE(SUM(v.solde_restant), 0)::NUMERIC
    FROM clients c
    LEFT JOIN ventes v ON v.client_id = c.id
    WHERE (p_type_client IS NULL OR c.type_client = p_type_client)
      AND (p_statut IS NULL OR c.statut = p_statut)
      AND (p_search IS NULL OR c.raison_sociale ILIKE '%' || p_search || '%')
    GROUP BY c.id
    ORDER BY c.raison_sociale;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sp_clients_get(
  p_id INT
)
RETURNS TABLE (
  id INT,
  code VARCHAR,
  type_client VARCHAR,
  raison_sociale VARCHAR,
  contact_nom VARCHAR,
  telephone VARCHAR,
  email VARCHAR,
  adresse TEXT,
  ville VARCHAR,
  plafond_credit NUMERIC,
  delai_paiement INT,
  statut VARCHAR
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      c.id, c.code, c.type_client, c.raison_sociale, c.contact_nom,
      c.telephone, c.email, c.adresse, c.ville,
      c.plafond_credit, c.delai_paiement, c.statut
    FROM clients c
    WHERE c.id = p_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sp_clients_create(
  p_code VARCHAR,
  p_type_client VARCHAR,
  p_raison_sociale VARCHAR,
  p_contact_nom VARCHAR DEFAULT NULL,
  p_telephone VARCHAR DEFAULT NULL,
  p_email VARCHAR DEFAULT NULL,
  p_adresse VARCHAR DEFAULT NULL,
  p_ville VARCHAR DEFAULT NULL,
  p_plafond_credit NUMERIC DEFAULT 0,
  p_delai_paiement INT DEFAULT 0
)
RETURNS TABLE (
  id INT,
  code VARCHAR
) AS $$
DECLARE
  v_id INT;
BEGIN
  INSERT INTO clients (
    code, type_client, raison_sociale, contact_nom,
    telephone, email, adresse, ville, plafond_credit, delai_paiement
  ) VALUES (
    p_code, p_type_client, p_raison_sociale, p_contact_nom,
    p_telephone, p_email, p_adresse, p_ville, p_plafond_credit, p_delai_paiement
  )
  RETURNING clients.id INTO v_id;

  RETURN QUERY SELECT v_id, p_code;
END;
$$ LANGUAGE plpgsql;

-- ─── CRÉANCES ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sp_creances_list(
  p_categorie VARCHAR DEFAULT NULL,
  p_client_id INT DEFAULT NULL
)
RETURNS TABLE (
  id INT,
  vente_id INT,
  vente_numero VARCHAR,
  client_id INT,
  client_nom VARCHAR,
  montant_creance NUMERIC,
  date_echeance DATE,
  jours_retard INT,
  categorie VARCHAR
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      v.id,
      v.id,
      v.numero,
      v.client_id,
      c.raison_sociale,
      v.solde_restant,
      v.date_echeance,
      EXTRACT(DAY FROM NOW() - v.date_echeance)::INT,
      CASE
        WHEN v.date_echeance > NOW() THEN 'non_echu'
        WHEN EXTRACT(DAY FROM NOW() - v.date_echeance) <= 30 THEN 'echu_30j'
        WHEN EXTRACT(DAY FROM NOW() - v.date_echeance) <= 60 THEN 'echu_60j'
        ELSE 'contentieux'
      END
    FROM ventes v
    JOIN clients c ON c.id = v.client_id
    WHERE v.solde_restant > 0
      AND (p_categorie IS NULL OR CASE
        WHEN v.date_echeance > NOW() THEN 'non_echu'
        WHEN EXTRACT(DAY FROM NOW() - v.date_echeance) <= 30 THEN 'echu_30j'
        WHEN EXTRACT(DAY FROM NOW() - v.date_echeance) <= 60 THEN 'echu_60j'
        ELSE 'contentieux'
      END = p_categorie)
      AND (p_client_id IS NULL OR v.client_id = p_client_id)
    ORDER BY v.date_echeance ASC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sp_creances_ageing()
RETURNS TABLE (
  non_echu NUMERIC,
  echu_30j NUMERIC,
  echu_60j NUMERIC,
  contentieux NUMERIC,
  total NUMERIC
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      COALESCE(SUM(CASE WHEN v.date_echeance > NOW() THEN v.solde_restant ELSE 0 END), 0)::NUMERIC,
      COALESCE(SUM(CASE WHEN EXTRACT(DAY FROM NOW() - v.date_echeance) BETWEEN 0 AND 30 THEN v.solde_restant ELSE 0 END), 0)::NUMERIC,
      COALESCE(SUM(CASE WHEN EXTRACT(DAY FROM NOW() - v.date_echeance) BETWEEN 31 AND 60 THEN v.solde_restant ELSE 0 END), 0)::NUMERIC,
      COALESCE(SUM(CASE WHEN EXTRACT(DAY FROM NOW() - v.date_echeance) > 60 THEN v.solde_restant ELSE 0 END), 0)::NUMERIC,
      COALESCE(SUM(v.solde_restant), 0)::NUMERIC
    FROM ventes v
    WHERE v.solde_restant > 0;
END;
$$ LANGUAGE plpgsql;

-- ─── PRODUITS ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sp_produits_list(
  p_limit INT DEFAULT 100,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id INT,
  code VARCHAR,
  nom VARCHAR,
  marque VARCHAR,
  categorie VARCHAR,
  prix_achat NUMERIC,
  prix_gros NUMERIC,
  prix_detail NUMERIC,
  quantite_stock NUMERIC,
  stock_alerte INT
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      p.id, p.code, p.nom,
      m.nom, cat.nom,
      p.prix_achat, p.prix_gros, p.prix_detail,
      COALESCE(SUM(s.quantite), 0)::NUMERIC,
      p.stock_alerte
    FROM produits p
    LEFT JOIN marques m ON m.id = p.marque_id
    LEFT JOIN categories cat ON cat.id = p.categorie_id
    LEFT JOIN stocks s ON s.produit_id = p.id
    GROUP BY p.id, m.nom, cat.nom
    ORDER BY p.nom
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- ─── STOCKS ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sp_stocks_get(
  p_produit_id INT,
  p_magasin_id INT DEFAULT NULL
)
RETURNS TABLE (
  produit_id INT,
  magasin_id INT,
  quantite NUMERIC,
  stock_alerte INT,
  reserve NUMERIC
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      s.produit_id,
      s.magasin_id,
      s.quantite,
      p.stock_alerte,
      COALESCE(s.reserve, 0)::NUMERIC
    FROM stocks s
    JOIN produits p ON p.id = s.produit_id
    WHERE s.produit_id = p_produit_id
      AND (p_magasin_id IS NULL OR s.magasin_id = p_magasin_id);
END;
$$ LANGUAGE plpgsql;

-- ─── PAIEMENTS ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION sp_paiements_create(
  p_vente_id INT,
  p_montant NUMERIC,
  p_date_paiement DATE,
  p_moyen_paiement_id INT DEFAULT NULL
)
RETURNS TABLE (
  id INT,
  vente_id INT,
  montant NUMERIC
) AS $$
DECLARE
  v_id INT;
BEGIN
  INSERT INTO paiements (
    vente_id, montant, date_paiement, moyen_paiement_id
  ) VALUES (
    p_vente_id, p_montant, p_date_paiement, p_moyen_paiement_id
  )
  RETURNING paiements.id INTO v_id;

  RETURN QUERY SELECT v_id, p_vente_id, p_montant;
END;
$$ LANGUAGE plpgsql;

-- ─── DASHBOARD ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION sp_dashboard_kpis(
  p_magasin_id INT DEFAULT NULL
)
RETURNS TABLE (
  ca_jour NUMERIC,
  ca_mois NUMERIC,
  creances_total NUMERIC,
  creances_contentieux NUMERIC,
  stock_value NUMERIC,
  nombre_clients INT
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      COALESCE(SUM(CASE WHEN DATE(v.date_vente) = CURRENT_DATE THEN v.total_ttc ELSE 0 END), 0)::NUMERIC,
      COALESCE(SUM(CASE WHEN DATE_TRUNC('month', v.date_vente) = DATE_TRUNC('month', NOW()) THEN v.total_ttc ELSE 0 END), 0)::NUMERIC,
      COALESCE(SUM(v.solde_restant), 0)::NUMERIC,
      COALESCE(SUM(CASE WHEN v.date_echeance < NOW() AND EXTRACT(DAY FROM NOW() - v.date_echeance) > 60 THEN v.solde_restant ELSE 0 END), 0)::NUMERIC,
      COALESCE(SUM(s.quantite * p2.prix_achat), 0)::NUMERIC,
      COUNT(DISTINCT c.id)::INT
    FROM ventes v
    LEFT JOIN clients c ON c.id = v.client_id
    LEFT JOIN stocks s ON TRUE
    LEFT JOIN produits p2 ON p2.id = s.produit_id
    WHERE (p_magasin_id IS NULL OR v.magasin_id = p_magasin_id);
END;
$$ LANGUAGE plpgsql;

-- ─── PRODUITS (EXTENDED) ──────────────────────────
CREATE OR REPLACE FUNCTION sp_produits_get(
  p_id INT
)
RETURNS TABLE (
  id INT,
  code VARCHAR,
  nom VARCHAR,
  description TEXT,
  marque_id INT,
  marque VARCHAR,
  categorie_id INT,
  categorie VARCHAR,
  prix_achat NUMERIC,
  prix_gros NUMERIC,
  prix_detail NUMERIC,
  stock_alerte INT
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      p.id, p.code, p.nom, p.description,
      p.marque_id, m.nom,
      p.categorie_id, cat.nom,
      p.prix_achat, p.prix_gros, p.prix_detail,
      p.stock_alerte
    FROM produits p
    LEFT JOIN marques m ON m.id = p.marque_id
    LEFT JOIN categories cat ON cat.id = p.categorie_id
    WHERE p.id = p_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sp_produits_create(
  p_code VARCHAR,
  p_nom VARCHAR,
  p_marque_id INT DEFAULT NULL,
  p_categorie_id INT DEFAULT NULL,
  p_prix_achat NUMERIC DEFAULT 0,
  p_prix_gros NUMERIC DEFAULT 0,
  p_prix_detail NUMERIC DEFAULT 0,
  p_stock_alerte INT DEFAULT 10
)
RETURNS TABLE (
  id INT,
  code VARCHAR
) AS $$
DECLARE
  v_id INT;
BEGIN
  INSERT INTO produits (
    code, nom, marque_id, categorie_id, prix_achat, prix_gros, prix_detail, stock_alerte
  ) VALUES (
    p_code, p_nom, p_marque_id, p_categorie_id, p_prix_achat, p_prix_gros, p_prix_detail, p_stock_alerte
  )
  RETURNING produits.id INTO v_id;

  RETURN QUERY SELECT v_id, p_code;
END;
$$ LANGUAGE plpgsql;

-- ─── FOURNISSEURS ─────────────────────────────────
CREATE OR REPLACE FUNCTION sp_fournisseurs_list(
  p_limit INT DEFAULT 100,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id INT,
  code VARCHAR,
  raison_sociale VARCHAR,
  contact_nom VARCHAR,
  telephone VARCHAR,
  email VARCHAR,
  adresse TEXT,
  ville VARCHAR,
  statut VARCHAR
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      f.id, f.code, f.raison_sociale, f.contact_nom,
      f.telephone, f.email, f.adresse, f.ville, f.statut
    FROM fournisseurs f
    ORDER BY f.raison_sociale
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sp_fournisseurs_get(
  p_id INT
)
RETURNS TABLE (
  id INT,
  code VARCHAR,
  raison_sociale VARCHAR,
  contact_nom VARCHAR,
  telephone VARCHAR,
  email VARCHAR,
  adresse TEXT,
  ville VARCHAR,
  statut VARCHAR
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      f.id, f.code, f.raison_sociale, f.contact_nom,
      f.telephone, f.email, f.adresse, f.ville, f.statut
    FROM fournisseurs f
    WHERE f.id = p_id;
END;
$$ LANGUAGE plpgsql;

-- ─── ACHATS ───────────────────────────────────────
CREATE OR REPLACE FUNCTION sp_achats_list(
  p_magasin_id INT DEFAULT NULL,
  p_limit INT DEFAULT 100,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id INT,
  numero VARCHAR,
  fournisseur_id INT,
  fournisseur_nom VARCHAR,
  date_achat DATE,
  total_ttc NUMERIC,
  montant_paye NUMERIC,
  solde_restant NUMERIC,
  statut_paiement VARCHAR
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      a.id, a.numero, a.fournisseur_id, f.raison_sociale,
      a.date_achat, a.total_ttc,
      a.montant_paye, a.solde_restant, a.statut_paiement
    FROM achats a
    JOIN fournisseurs f ON f.id = a.fournisseur_id
    WHERE (p_magasin_id IS NULL OR a.magasin_id = p_magasin_id)
    ORDER BY a.date_achat DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sp_achats_get(
  p_id INT
)
RETURNS TABLE (
  id INT,
  numero VARCHAR,
  fournisseur_id INT,
  fournisseur_nom VARCHAR,
  date_achat DATE,
  total_ttc NUMERIC,
  montant_paye NUMERIC,
  solde_restant NUMERIC,
  statut_paiement VARCHAR,
  notes TEXT
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      a.id, a.numero, a.fournisseur_id, f.raison_sociale,
      a.date_achat, a.total_ttc,
      a.montant_paye, a.solde_restant, a.statut_paiement,
      a.notes
    FROM achats a
    JOIN fournisseurs f ON f.id = a.fournisseur_id
    WHERE a.id = p_id;
END;
$$ LANGUAGE plpgsql;

-- ─── STOCK ────────────────────────────────────────
CREATE OR REPLACE FUNCTION sp_stocks_list(
  p_magasin_id INT DEFAULT NULL,
  p_limit INT DEFAULT 100,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  produit_id INT,
  produit_nom VARCHAR,
  magasin_id INT,
  quantite NUMERIC,
  stock_alerte INT,
  reserve NUMERIC
) AS $$
BEGIN
  RETURN QUERY
    SELECT
      s.produit_id,
      p.nom,
      s.magasin_id,
      s.quantite,
      p.stock_alerte,
      COALESCE(s.reserve, 0)::NUMERIC
    FROM stocks s
    JOIN produits p ON p.id = s.produit_id
    WHERE (p_magasin_id IS NULL OR s.magasin_id = p_magasin_id)
    ORDER BY p.nom
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- ─── DÉPENSES ─────────────────────────────────────
-- Note: Implementation depends on depenses table structure
-- Placeholder for future implementation when depenses module is finalized
