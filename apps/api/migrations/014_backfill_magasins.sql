-- ============================================================
-- TéléPro CI — Migration 014 : Backfill multi-magasin
-- À exécuter APRÈS la migration 013
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. CRÉER LE MAGASIN PRINCIPAL
-- ─────────────────────────────────────────────

INSERT INTO magasins (id, code, nom, adresse, telephone, email)
VALUES (1, 'MG-PRINCIPAL', 'Magasin Principal', 'Abidjan, Côte d''Ivoire', '+22507000000', 'admin@telepro.ci')
ON CONFLICT (id) DO NOTHING;

-- Réinitialiser la séquence pour éviter les conflits lors des prochains INSERT
SELECT setval('magasins_id_seq', GREATEST((SELECT MAX(id) FROM magasins), 1));

-- ─────────────────────────────────────────────
-- 2. BACKFILL TABLE stocks DEPUIS produits.stock
-- ─────────────────────────────────────────────

INSERT INTO stocks (produit_id, magasin_id, quantite, stock_alerte)
SELECT id, 1, stock, stock_alerte
FROM produits
ON CONFLICT (produit_id, magasin_id) DO UPDATE
  SET quantite     = EXCLUDED.quantite,
      stock_alerte = EXCLUDED.stock_alerte;

-- ─────────────────────────────────────────────
-- 3. BACKFILL magasin_id = 1 SUR TOUTES LES TABLES
-- ─────────────────────────────────────────────

UPDATE ventes           SET magasin_id = 1 WHERE magasin_id IS NULL;
UPDATE achats           SET magasin_id = 1 WHERE magasin_id IS NULL;
UPDATE paiements        SET magasin_id = 1 WHERE magasin_id IS NULL;
UPDATE mouvements_stock SET magasin_id = 1 WHERE magasin_id IS NULL;
UPDATE devis            SET magasin_id = 1 WHERE magasin_id IS NULL;
UPDATE retours_client   SET magasin_id = 1 WHERE magasin_id IS NULL;
UPDATE bons_commande    SET magasin_id = 1 WHERE magasin_id IS NULL;
UPDATE objectifs        SET magasin_id = 1 WHERE magasin_id IS NULL;
UPDATE echeances_manuelles SET magasin_id = 1 WHERE magasin_id IS NULL;
-- utilisateurs.magasin_id reste NULL = accès tous magasins (comportement admin)

-- ─────────────────────────────────────────────
-- 4. AJOUTER DEFAULT 1 SUR LES COLONNES OPÉRATIONNELLES
-- (ne pas mettre NOT NULL encore — Phase 4)
-- ─────────────────────────────────────────────

ALTER TABLE ventes           ALTER COLUMN magasin_id SET DEFAULT 1;
ALTER TABLE achats           ALTER COLUMN magasin_id SET DEFAULT 1;
ALTER TABLE paiements        ALTER COLUMN magasin_id SET DEFAULT 1;
ALTER TABLE mouvements_stock ALTER COLUMN magasin_id SET DEFAULT 1;
ALTER TABLE devis            ALTER COLUMN magasin_id SET DEFAULT 1;
ALTER TABLE retours_client   ALTER COLUMN magasin_id SET DEFAULT 1;
ALTER TABLE bons_commande    ALTER COLUMN magasin_id SET DEFAULT 1;
ALTER TABLE objectifs        ALTER COLUMN magasin_id SET DEFAULT 1;
ALTER TABLE echeances_manuelles ALTER COLUMN magasin_id SET DEFAULT 1;

-- ─────────────────────────────────────────────
-- 5. MISE À JOUR DES VUES (ajouter magasin_id)
-- ─────────────────────────────────────────────

DROP VIEW IF EXISTS v_mouvements_stock CASCADE;
DROP VIEW IF EXISTS v_rentabilite_produits CASCADE;
DROP VIEW IF EXISTS v_stocks_consolide CASCADE;
DROP VIEW IF EXISTS v_stocks CASCADE;
DROP VIEW IF EXISTS v_echeances_30j CASCADE;
DROP VIEW IF EXISTS v_dettes_fournisseurs CASCADE;
DROP VIEW IF EXISTS v_creances_clients CASCADE;

CREATE VIEW v_creances_clients AS
SELECT
  v.id,
  v.numero,
  v.magasin_id,
  mg.nom          AS magasin_nom,
  c.id            AS client_id,
  c.code          AS client_code,
  c.raison_sociale,
  c.type_client,
  c.telephone,
  v.date_vente,
  v.date_echeance,
  v.total_ttc,
  v.montant_paye,
  v.solde_restant,
  v.statut_paiement,
  CASE
    WHEN v.date_echeance IS NULL THEN NULL
    WHEN v.solde_restant = 0 THEN 0
    ELSE CURRENT_DATE - v.date_echeance
  END AS jours_retard,
  CASE
    WHEN v.solde_restant = 0 THEN 'paye'
    WHEN v.date_echeance IS NULL THEN 'comptant_impaye'
    WHEN CURRENT_DATE <= v.date_echeance THEN 'non_echu'
    WHEN CURRENT_DATE - v.date_echeance <= 30 THEN 'echu_30j'
    WHEN CURRENT_DATE - v.date_echeance <= 60 THEN 'echu_60j'
    ELSE 'contentieux'
  END AS categorie_echeance
FROM ventes v
JOIN clients c    ON c.id = v.client_id
LEFT JOIN magasins mg ON mg.id = v.magasin_id
WHERE v.solde_restant > 0;

CREATE VIEW v_dettes_fournisseurs AS
SELECT
  a.id,
  a.numero,
  a.magasin_id,
  mg.nom          AS magasin_nom,
  f.id            AS fournisseur_id,
  f.code          AS fournisseur_code,
  f.raison_sociale,
  f.telephone,
  a.date_achat,
  a.date_echeance,
  a.total_ttc,
  a.montant_paye,
  a.solde_restant,
  a.statut_paiement,
  CASE
    WHEN a.date_echeance IS NULL THEN NULL
    WHEN a.solde_restant = 0 THEN 0
    ELSE CURRENT_DATE - a.date_echeance
  END AS jours_retard,
  CASE
    WHEN a.solde_restant = 0 THEN 'paye'
    WHEN a.date_echeance IS NULL THEN 'non_echu'
    WHEN CURRENT_DATE <= a.date_echeance THEN 'non_echu'
    WHEN CURRENT_DATE - a.date_echeance <= 15 THEN 'echu_15j'
    ELSE 'en_retard'
  END AS categorie_echeance
FROM achats a
JOIN fournisseurs f   ON f.id = a.fournisseur_id
LEFT JOIN magasins mg ON mg.id = a.magasin_id
WHERE a.solde_restant > 0;

CREATE VIEW v_echeances_30j AS
  SELECT 'client'::text AS sens,
    v.numero,
    c.raison_sociale AS tiers,
    v.date_echeance,
    v.solde_restant AS montant,
    v.statut_paiement,
    v.id AS ref_id,
    'vente'::text AS ref_type,
    v.magasin_id
  FROM ventes v
  JOIN clients c ON c.id = v.client_id
  WHERE v.solde_restant > 0
    AND v.date_echeance >= CURRENT_DATE - INTERVAL '7 days'
    AND v.date_echeance <= CURRENT_DATE + INTERVAL '30 days'

  UNION ALL

  SELECT 'fournisseur'::text,
    a.numero,
    f.raison_sociale,
    a.date_echeance,
    a.solde_restant,
    a.statut_paiement,
    a.id,
    'achat'::text,
    a.magasin_id
  FROM achats a
  JOIN fournisseurs f ON f.id = a.fournisseur_id
  WHERE a.solde_restant > 0
    AND a.date_echeance >= CURRENT_DATE - INTERVAL '7 days'
    AND a.date_echeance <= CURRENT_DATE + INTERVAL '30 days'

  UNION ALL

  SELECT e.sens,
    'ECH-' || e.id,
    e.tiers,
    e.date_echeance,
    e.montant,
    e.statut,
    e.id,
    'manuelle'::text,
    e.magasin_id
  FROM echeances_manuelles e
  WHERE e.statut = 'en_attente'
    AND e.date_echeance >= CURRENT_DATE - INTERVAL '7 days'
    AND e.date_echeance <= CURRENT_DATE + INTERVAL '30 days'

  ORDER BY date_echeance;

-- Vue stock par magasin (remplace la lecture directe de produits.stock)
CREATE VIEW v_stocks AS
SELECT
  s.produit_id,
  s.magasin_id,
  mg.nom          AS magasin_nom,
  p.reference,
  p.designation,
  p.prix_achat,
  p.prix_gros,
  p.prix_detail,
  p.actif,
  s.quantite,
  s.stock_alerte,
  p.stock_max,
  CASE WHEN s.quantite <= s.stock_alerte THEN TRUE ELSE FALSE END AS alerte_stock
FROM stocks s
JOIN produits p  ON p.id = s.produit_id
JOIN magasins mg ON mg.id = s.magasin_id;

-- Vue stock consolidé tous magasins
CREATE VIEW v_stocks_consolide AS
SELECT
  p.id            AS produit_id,
  p.reference,
  p.designation,
  p.prix_achat,
  p.prix_gros,
  p.prix_detail,
  p.actif,
  p.stock_max,
  COALESCE(SUM(s.quantite), 0)       AS quantite_totale,
  MIN(s.stock_alerte)                AS stock_alerte_min,
  CASE WHEN COALESCE(SUM(s.quantite), 0) <= MIN(s.stock_alerte) THEN TRUE ELSE FALSE END AS alerte_stock
FROM produits p
LEFT JOIN stocks s ON s.produit_id = p.id
GROUP BY p.id, p.reference, p.designation, p.prix_achat, p.prix_gros, p.prix_detail, p.actif, p.stock_max;

-- Mettre à jour v_rentabilite_produits pour utiliser stocks
CREATE VIEW v_rentabilite_produits AS
SELECT
  p.id,
  p.reference,
  p.designation,
  m.nom AS marque,
  c.libelle AS categorie,
  p.prix_achat,
  p.prix_gros,
  p.prix_detail,
  COALESCE(SUM(s.quantite), 0)                        AS stock_total,
  COALESCE(SUM(vl.quantite), 0)                       AS qte_vendue,
  COALESCE(SUM(vl.total_ligne), 0)                    AS ca_total,
  COALESCE(SUM(vl.quantite * p.prix_achat), 0)        AS cout_total,
  COALESCE(SUM(vl.total_ligne) - SUM(vl.quantite * p.prix_achat), 0) AS marge_brute,
  CASE WHEN COALESCE(SUM(vl.total_ligne), 0) > 0
    THEN ROUND((COALESCE(SUM(vl.total_ligne) - SUM(vl.quantite * p.prix_achat), 0)
         / SUM(vl.total_ligne)) * 100, 1)
    ELSE 0 END                                        AS taux_marge,
  COALESCE(SUM(s.quantite), 0) * p.prix_achat        AS valeur_stock,
  MAX(v.date_vente)                                   AS derniere_vente
FROM produits p
LEFT JOIN marques m        ON m.id = p.marque_id
LEFT JOIN categories c     ON c.id = p.categorie_id
LEFT JOIN stocks s         ON s.produit_id = p.id
LEFT JOIN ventes_lignes vl ON vl.produit_id = p.id
LEFT JOIN ventes v         ON v.id = vl.vente_id
WHERE p.actif = TRUE
GROUP BY p.id, m.nom, c.libelle;

-- Mettre à jour v_mouvements_stock pour inclure magasin
CREATE VIEW v_mouvements_stock AS
SELECT
  ms.*,
  p.designation,
  p.reference,
  mg.nom AS magasin_nom,
  COALESCE((SELECT quantite FROM stocks WHERE produit_id = ms.produit_id AND magasin_id = ms.magasin_id), 0) AS stock_actuel
FROM mouvements_stock ms
JOIN produits p ON p.id = ms.produit_id
LEFT JOIN magasins mg ON mg.id = ms.magasin_id;
