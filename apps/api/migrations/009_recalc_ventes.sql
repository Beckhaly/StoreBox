-- ============================================================
-- Migration 009 : Recalculer tous les montants des ventes
-- Applique la formule correcte incluant les remises individuelles
-- ============================================================

-- Recalculer tous les sous-totaux HT (brut après remises individuelles)
WITH ventes_brut AS (
  SELECT 
    v.id,
    SUM(ROUND(vl.quantite * vl.prix_unitaire * (1.0 - COALESCE(vl.remise_pct, 0) / 100)))::BIGINT AS brut_total
  FROM ventes v
  LEFT JOIN ventes_lignes vl ON vl.vente_id = v.id
  GROUP BY v.id
)
UPDATE ventes v
SET 
  sous_total = GREATEST(0, vb.brut_total - ROUND(vb.brut_total * v.remise_pct / 100.0))::NUMERIC,
  remise_montant = ROUND(vb.brut_total * v.remise_pct / 100.0)::NUMERIC,
  tva_montant = ROUND((GREATEST(0, vb.brut_total - ROUND(vb.brut_total * v.remise_pct / 100.0)) * v.tva_pct / 100.0))::NUMERIC,
  total_ttc = (
    GREATEST(0, vb.brut_total - ROUND(vb.brut_total * v.remise_pct / 100.0)) +
    ROUND((GREATEST(0, vb.brut_total - ROUND(vb.brut_total * v.remise_pct / 100.0)) * v.tva_pct / 100.0))
  )::NUMERIC
FROM ventes_brut vb
WHERE v.id = vb.id AND vb.brut_total > 0;

-- Recalculer solde_restant pour toutes les ventes (au cas où des paiements ont été ajoutés)
UPDATE ventes v
SET 
  solde_restant = (v.total_ttc - COALESCE((SELECT SUM(montant) FROM paiements p WHERE p.vente_id = v.id AND p.type_paiement = 'encaissement'), 0))::NUMERIC;

-- Recalculer les statuts de paiement
UPDATE ventes
SET statut_paiement = 
  CASE 
    WHEN solde_restant <= 0 THEN 'paye'
    WHEN montant_paye > 0 THEN 'partiel'
    ELSE 'non_paye'
  END;
