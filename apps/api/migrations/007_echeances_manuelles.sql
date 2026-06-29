-- Migration: échéances manuelles
-- Permet d'ajouter des échéances indépendantes des ventes/achats

CREATE TABLE IF NOT EXISTS echeances_manuelles (
  id              SERIAL PRIMARY KEY,
  sens            VARCHAR(20) NOT NULL CHECK (sens IN ('client','fournisseur','autre')),
  tiers           VARCHAR(200) NOT NULL,
  montant         NUMERIC(15,0) NOT NULL,
  date_echeance   DATE NOT NULL,
  description     TEXT,
  statut          VARCHAR(20) NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente','payee','annulee')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Mettre à jour la vue pour inclure les échéances manuelles
DROP VIEW IF EXISTS v_echeances_30j;
CREATE VIEW v_echeances_30j AS
  SELECT 'client'::text AS sens,
    v.numero,
    c.raison_sociale AS tiers,
    v.date_echeance,
    v.solde_restant AS montant,
    v.statut_paiement,
    v.id AS ref_id,
    'vente'::text AS ref_type
  FROM ventes v
  JOIN clients c ON c.id = v.client_id
  WHERE v.solde_restant > 0 AND v.date_echeance >= CURRENT_DATE - INTERVAL '7 days' AND v.date_echeance <= CURRENT_DATE + INTERVAL '30 days'

  UNION ALL

  SELECT 'fournisseur'::text AS sens,
    a.numero,
    f.raison_sociale AS tiers,
    a.date_echeance,
    a.solde_restant AS montant,
    a.statut_paiement,
    a.id AS ref_id,
    'achat'::text AS ref_type
  FROM achats a
  JOIN fournisseurs f ON f.id = a.fournisseur_id
  WHERE a.solde_restant > 0 AND a.date_echeance >= CURRENT_DATE - INTERVAL '7 days' AND a.date_echeance <= CURRENT_DATE + INTERVAL '30 days'

  UNION ALL

  SELECT e.sens,
    'ECH-' || e.id AS numero,
    e.tiers,
    e.date_echeance,
    e.montant,
    e.statut AS statut_paiement,
    e.id AS ref_id,
    'manuelle'::text AS ref_type
  FROM echeances_manuelles e
  WHERE e.statut = 'en_attente' AND e.date_echeance >= CURRENT_DATE - INTERVAL '7 days' AND e.date_echeance <= CURRENT_DATE + INTERVAL '30 days'

  ORDER BY date_echeance;
