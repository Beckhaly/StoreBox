-- Migration 027 : Solde initial d'ouverture (clients & fournisseurs)
-- Permet de saisir le solde antérieur à l'utilisation de StoreBox.
-- Ce solde apparaît automatiquement dans les vues créances / dettes.

-- 1. Colonnes
ALTER TABLE clients      ADD COLUMN IF NOT EXISTS solde_initial NUMERIC(15,0) NOT NULL DEFAULT 0;
ALTER TABLE fournisseurs ADD COLUMN IF NOT EXISTS solde_initial NUMERIC(15,0) NOT NULL DEFAULT 0;

-- 2. Recréer v_creances_clients (UNION ALL : vraies ventes + solde initial)
DROP VIEW IF EXISTS v_creances_clients CASCADE;

CREATE VIEW v_creances_clients AS
SELECT
  v.id,
  v.numero,
  v.magasin_id,
  mg.nom             AS magasin_nom,
  c.id               AS client_id,
  c.code             AS client_code,
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
    WHEN v.solde_restant = 0     THEN 0
    ELSE CURRENT_DATE - v.date_echeance
  END AS jours_retard,
  CASE
    WHEN v.solde_restant = 0                  THEN 'paye'
    WHEN v.date_echeance IS NULL              THEN 'comptant_impaye'
    WHEN CURRENT_DATE <= v.date_echeance      THEN 'non_echu'
    WHEN CURRENT_DATE - v.date_echeance <= 30 THEN 'echu_30j'
    WHEN CURRENT_DATE - v.date_echeance <= 60 THEN 'echu_60j'
    ELSE 'contentieux'
  END AS categorie_echeance
FROM ventes v
JOIN clients c       ON c.id = v.client_id
LEFT JOIN magasins mg ON mg.id = v.magasin_id
WHERE v.solde_restant > 0

UNION ALL

-- Lignes synthétiques : solde initial par client (préfixe SI-)
SELECT
  (-c.id)::int                               AS id,
  ('SI-' || c.code)::varchar                 AS numero,
  NULL::int                                  AS magasin_id,
  NULL::text                                 AS magasin_nom,
  c.id                                       AS client_id,
  c.code                                     AS client_code,
  c.raison_sociale,
  c.type_client,
  c.telephone,
  c.created_at::date                         AS date_vente,
  c.created_at::date                         AS date_echeance,
  c.solde_initial                            AS total_ttc,
  0::numeric                                 AS montant_paye,
  c.solde_initial                            AS solde_restant,
  'impaye'::varchar                          AS statut_paiement,
  (CURRENT_DATE - c.created_at::date)::int   AS jours_retard,
  CASE
    WHEN CURRENT_DATE - c.created_at::date <= 30 THEN 'non_echu'
    WHEN CURRENT_DATE - c.created_at::date <= 60 THEN 'echu_30j'
    ELSE 'contentieux'
  END AS categorie_echeance
FROM clients c
WHERE c.solde_initial > 0;

-- 3. Recréer v_dettes_fournisseurs (UNION ALL : vrais achats + solde initial)
DROP VIEW IF EXISTS v_dettes_fournisseurs CASCADE;

CREATE VIEW v_dettes_fournisseurs AS
SELECT
  a.id,
  a.numero,
  a.magasin_id,
  mg.nom             AS magasin_nom,
  f.id               AS fournisseur_id,
  f.code             AS fournisseur_code,
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
    WHEN a.solde_restant = 0     THEN 0
    ELSE CURRENT_DATE - a.date_echeance
  END AS jours_retard,
  CASE
    WHEN a.solde_restant = 0                  THEN 'paye'
    WHEN a.date_echeance IS NULL              THEN 'non_echu'
    WHEN CURRENT_DATE <= a.date_echeance      THEN 'non_echu'
    WHEN CURRENT_DATE - a.date_echeance <= 15 THEN 'echu_15j'
    ELSE 'en_retard'
  END AS categorie_echeance
FROM achats a
JOIN fournisseurs f    ON f.id = a.fournisseur_id
LEFT JOIN magasins mg  ON mg.id = a.magasin_id
WHERE a.solde_restant > 0

UNION ALL

-- Lignes synthétiques : solde initial par fournisseur (préfixe SI-)
SELECT
  (-f.id)::int                               AS id,
  ('SI-' || f.code)::varchar                 AS numero,
  NULL::int                                  AS magasin_id,
  NULL::text                                 AS magasin_nom,
  f.id                                       AS fournisseur_id,
  f.code                                     AS fournisseur_code,
  f.raison_sociale,
  f.telephone,
  f.created_at::date                         AS date_achat,
  f.created_at::date                         AS date_echeance,
  f.solde_initial                            AS total_ttc,
  0::numeric                                 AS montant_paye,
  f.solde_initial                            AS solde_restant,
  'impaye'::varchar                          AS statut_paiement,
  (CURRENT_DATE - f.created_at::date)::int   AS jours_retard,
  CASE
    WHEN CURRENT_DATE - f.created_at::date <= 15 THEN 'non_echu'
    ELSE 'en_retard'
  END AS categorie_echeance
FROM fournisseurs f
WHERE f.solde_initial > 0;
