-- ============================================================
-- Migration 008 : Trigger pour synchroniser paiements et ventes
-- Calcule automatiquement montant_paye et solde_restant
-- ============================================================

-- Fonction pour recalculer montant_paye et solde_restant d'une vente
CREATE OR REPLACE FUNCTION recalc_montant_vente()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ventes 
  SET 
    montant_paye = COALESCE((SELECT SUM(montant) FROM paiements WHERE vente_id = ventes.id AND type_paiement = 'encaissement'), 0),
    solde_restant = total_ttc - COALESCE((SELECT SUM(montant) FROM paiements WHERE vente_id = ventes.id AND type_paiement = 'encaissement'), 0)
  WHERE id = (CASE WHEN NEW.vente_id IS NOT NULL THEN NEW.vente_id ELSE OLD.vente_id END);
  
  -- Mettre à jour le statut_paiement
  UPDATE ventes
  SET statut_paiement = 
    CASE 
      WHEN solde_restant <= 0 THEN 'paye'
      WHEN montant_paye > 0 THEN 'partiel'
      ELSE 'non_paye'
    END
  WHERE id = (CASE WHEN NEW.vente_id IS NOT NULL THEN NEW.vente_id ELSE OLD.vente_id END);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fonction équivalente pour les achats
CREATE OR REPLACE FUNCTION recalc_montant_achat()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE achats 
  SET 
    montant_paye = COALESCE((SELECT SUM(montant) FROM paiements WHERE achat_id = achats.id AND type_paiement = 'decaissement'), 0),
    solde_restant = total_ttc - COALESCE((SELECT SUM(montant) FROM paiements WHERE achat_id = achats.id AND type_paiement = 'decaissement'), 0)
  WHERE id = (CASE WHEN NEW.achat_id IS NOT NULL THEN NEW.achat_id ELSE OLD.achat_id END);
  
  -- Mettre à jour le statut_paiement
  UPDATE achats
  SET statut_paiement = 
    CASE 
      WHEN solde_restant <= 0 THEN 'paye'
      WHEN montant_paye > 0 THEN 'partiel'
      ELSE 'non_paye'
    END
  WHERE id = (CASE WHEN NEW.achat_id IS NOT NULL THEN NEW.achat_id ELSE OLD.achat_id END);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger sur INSERT/UPDATE/DELETE de paiement vers vente
DROP TRIGGER IF EXISTS trg_paiements_sync_ventes ON paiements;
CREATE TRIGGER trg_paiements_sync_ventes
AFTER INSERT OR UPDATE OR DELETE ON paiements
FOR EACH ROW
EXECUTE FUNCTION recalc_montant_vente();

-- Trigger sur INSERT/UPDATE/DELETE de paiement vers achat
DROP TRIGGER IF EXISTS trg_paiements_sync_achats ON paiements;
CREATE TRIGGER trg_paiements_sync_achats
AFTER INSERT OR UPDATE OR DELETE ON paiements
FOR EACH ROW
EXECUTE FUNCTION recalc_montant_achat();
