-- ═══════════════════════════════════════════════════════════════════
-- Migration 024 — Données ESSENTIELLES (toujours appliquées)
-- Contrairement aux fichiers *_seed* (données de démo, désactivables),
-- ce contenu est indispensable au fonctionnement (POS, etc.).
-- Idempotent.
-- ═══════════════════════════════════════════════════════════════════

-- Moyens de paiement (indispensables à la caisse / aux règlements)
INSERT INTO moyens_paiement (code, nom) VALUES
  ('ESPECES',   'Espèces'),
  ('OMONEY',    'Orange Money'),
  ('MTNMOMO',   'MTN Mobile Money'),
  ('WAVE',      'Wave'),
  ('VIREMENT',  'Virement bancaire'),
  ('CHEQUE',    'Chèque'),
  ('CB',        'Carte bancaire'),
  ('CREDIT',    'Crédit client')
ON CONFLICT (code) DO NOTHING;
