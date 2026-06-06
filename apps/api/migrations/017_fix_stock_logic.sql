-- ═══════════════════════════════════════════════════════════════════
-- Migration 017 — Correctifs logique de stock
-- ═══════════════════════════════════════════════════════════════════

-- ── 0. Permettre statut_paiement='annulee' sur les ventes ────────
-- La contrainte originale ne couvrait pas l'annulation
ALTER TABLE ventes
  DROP CONSTRAINT IF EXISTS ventes_statut_paiement_check;
ALTER TABLE ventes
  ADD CONSTRAINT ventes_statut_paiement_check
  CHECK (statut_paiement IN ('non_paye','partiel','paye','en_retard','contentieux','annulee'));

-- ── 0b. Protéger le trigger paiements contre l'écrasement d'une vente annulée ──
-- Sans ça, supprimer un paiement sur une vente annulée réinitialise son statut
CREATE OR REPLACE FUNCTION recalc_montant_vente()
RETURNS TRIGGER AS $$
DECLARE
  v_vente_id INT;
BEGIN
  v_vente_id := COALESCE(NEW.vente_id, OLD.vente_id);
  IF v_vente_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  UPDATE ventes
  SET
    montant_paye   = COALESCE((SELECT SUM(montant) FROM paiements WHERE vente_id = ventes.id AND type_paiement = 'encaissement'), 0),
    solde_restant  = total_ttc - COALESCE((SELECT SUM(montant) FROM paiements WHERE vente_id = ventes.id AND type_paiement = 'encaissement'), 0)
  WHERE id = v_vente_id;

  -- Ne pas écraser 'annulee' — une vente annulée reste annulée
  UPDATE ventes
  SET statut_paiement =
    CASE
      WHEN solde_restant <= 0 THEN 'paye'
      WHEN montant_paye  > 0 THEN 'partiel'
      ELSE 'non_paye'
    END
  WHERE id = v_vente_id
    AND statut_paiement <> 'annulee';

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ── 1. Contrainte stock non négatif ──────────────────────────────
ALTER TABLE stocks
  DROP CONSTRAINT IF EXISTS chk_stock_positif;
ALTER TABLE stocks
  ADD CONSTRAINT chk_stock_positif CHECK (quantite >= 0);

-- ── 2. Colonnes stock_avant / stock_apres sur mouvements_stock ───
ALTER TABLE mouvements_stock
  ADD COLUMN IF NOT EXISTS stock_avant INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_apres  INT NOT NULL DEFAULT 0;

-- ── 3. Vue v_mouvements_stock avec alias type_mouvement ──────────
DROP VIEW IF EXISTS v_mouvements_stock CASCADE;
CREATE VIEW v_mouvements_stock AS
SELECT
  ms.id,
  ms.produit_id,
  ms.type                AS type_mouvement,
  ms.quantite,
  ms.stock_avant,
  ms.stock_apres,
  ms.motif,
  ms.ref_doc,
  ms.magasin_id,
  ms.created_at,
  p.designation,
  p.reference,
  mg.nom                 AS magasin_nom,
  COALESCE(
    (SELECT quantite FROM stocks
      WHERE produit_id = ms.produit_id
        AND magasin_id = ms.magasin_id),
    0
  )                      AS stock_actuel
FROM mouvements_stock ms
JOIN  produits  p  ON p.id  = ms.produit_id
LEFT JOIN magasins mg ON mg.id = ms.magasin_id;

-- ── 4. Vue v_stocks mise à jour avec alerte_stock calculée ───────
-- (stocks n'a pas de colonne id ni updated_at — clé composite produit_id+magasin_id)
DROP VIEW IF EXISTS v_stocks CASCADE;
CREATE VIEW v_stocks AS
SELECT
  s.produit_id,
  s.magasin_id,
  s.quantite,
  s.stock_alerte,
  p.designation,
  p.reference,
  p.prix_achat,
  p.prix_gros,
  p.prix_detail,
  p.stock_max,
  p.actif,
  mg.nom                                           AS magasin_nom,
  s.quantite = 0                                   AS rupture,
  s.quantite > 0 AND s.quantite <= s.stock_alerte  AS alerte_stock
FROM stocks s
JOIN produits  p  ON p.id  = s.produit_id
JOIN magasins  mg ON mg.id = s.magasin_id;

-- ── 5. Vue v_stocks_consolide mise à jour ────────────────────────
DROP VIEW IF EXISTS v_stocks_consolide CASCADE;
CREATE VIEW v_stocks_consolide AS
SELECT
  p.id                                              AS produit_id,
  p.designation,
  p.reference,
  p.prix_achat,
  p.prix_gros,
  p.prix_detail,
  p.stock_alerte,
  p.stock_max,
  p.actif,
  COALESCE(SUM(s.quantite), 0)                     AS quantite_totale,
  COALESCE(SUM(s.quantite), 0) * p.prix_achat      AS valeur_stock,
  CASE WHEN COALESCE(SUM(s.quantite), 0) = 0
       THEN TRUE ELSE FALSE END                     AS rupture,
  CASE WHEN COALESCE(SUM(s.quantite), 0) > 0
            AND COALESCE(SUM(s.quantite), 0) <= MIN(s.stock_alerte)
       THEN TRUE ELSE FALSE END                     AS alerte_stock
FROM produits p
LEFT JOIN stocks s ON s.produit_id = p.id
GROUP BY p.id;
