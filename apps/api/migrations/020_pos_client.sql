-- ═══════════════════════════════════════════════════════════════════
-- Migration 020 — Client par défaut pour les ventes au comptoir (POS)
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Insérer client "Vente au comptoir" si inexistant ─────────────
INSERT INTO clients
  (code, type_client, raison_sociale, statut)
VALUES
  ('POS-COMPTOIR', 'particulier', 'Vente au comptoir', 'actif')
ON CONFLICT (code) DO NOTHING;

-- Créer un alias pour faciliter les requêtes
INSERT INTO clients
  (code, type_client, raison_sociale, statut)
VALUES
  ('POS-ANONYMOUS', 'particulier', 'Client anonyme (POS)', 'actif')
ON CONFLICT (code) DO NOTHING;

-- ── 2. Ajouter colonne session_caisse_id à ventes si absente ────────
ALTER TABLE ventes
  ADD COLUMN IF NOT EXISTS session_caisse_id INT REFERENCES sessions_caisse(id);

-- Index pour retrouver les ventes d'une session
CREATE INDEX IF NOT EXISTS idx_ventes_session_caisse_id
  ON ventes(session_caisse_id);

-- ── 3. Numéro de vente auto-incrémenté par magasin ──────────────────
-- Crée une séquence per-magasin pour les numéros de vente
-- Format: MAG01-VTE-001, MAG02-VTE-001, etc.
CREATE SEQUENCE IF NOT EXISTS vente_numero_seq;

-- ── 4. Contrainte : un seul montant_especes_reel non-null par session
-- (Une session ne peut être fermée qu'une seule fois)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_caisse_une_fermeture
  ON sessions_caisse(id)
  WHERE montant_especes_reel IS NOT NULL;
