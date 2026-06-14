-- ═══════════════════════════════════════════════════════════════════
-- Migration 023 — Reception des bons de commande (partielle + lots)
-- - nouveau statut 'receptionne_partiel'
-- - lien inverse achat -> bon de commande (tracabilite)
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Statut reception partielle ─────────────────────────────────
ALTER TABLE bons_commande DROP CONSTRAINT IF EXISTS bons_commande_statut_check;
ALTER TABLE bons_commande ADD  CONSTRAINT bons_commande_statut_check
  CHECK (statut IN ('brouillon','envoye','confirme','receptionne_partiel','receptionne','annule'));

-- ── 2. Lien inverse achat -> BC ───────────────────────────────────
ALTER TABLE achats ADD COLUMN IF NOT EXISTS bon_commande_id INT REFERENCES bons_commande(id);
CREATE INDEX IF NOT EXISTS idx_achats_bon_commande ON achats(bon_commande_id);
