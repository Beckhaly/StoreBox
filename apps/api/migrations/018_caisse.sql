-- ═══════════════════════════════════════════════════════════════════
-- Migration 018 — Module Caisse & Point de Vente
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Sessions de caisse ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions_caisse (
  id                      SERIAL PRIMARY KEY,
  magasin_id              INT NOT NULL REFERENCES magasins(id),
  caissier_id             INT NOT NULL REFERENCES utilisateurs(id),
  ouvert_a                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ferme_a                 TIMESTAMPTZ,
  fond_ouverture          NUMERIC(15,0) NOT NULL DEFAULT 0,
  montant_especes_attendu NUMERIC(15,0) NOT NULL DEFAULT 0,
  montant_especes_reel    NUMERIC(15,0),
  ecart                   NUMERIC(15,0),
  nb_ventes               INT NOT NULL DEFAULT 0,
  total_ventes            NUMERIC(15,0) NOT NULL DEFAULT 0,
  notes                   TEXT,
  statut                  VARCHAR(20) NOT NULL DEFAULT 'ouverte'
    CHECK (statut IN ('ouverte','fermee')),
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_magasin   ON sessions_caisse(magasin_id);
CREATE INDEX IF NOT EXISTS idx_sessions_caissier  ON sessions_caisse(caissier_id);
CREATE INDEX IF NOT EXISTS idx_sessions_statut    ON sessions_caisse(statut);

-- ── 2. Règlements multi-moyen sur une vente ───────────────────────
-- (complète le champ moyen_paiement_id unique déjà sur ventes)
CREATE TABLE IF NOT EXISTS ventes_reglements (
  id                 SERIAL PRIMARY KEY,
  vente_id           INT NOT NULL REFERENCES ventes(id) ON DELETE CASCADE,
  moyen_paiement_id  INT REFERENCES moyens_paiement(id),
  montant            NUMERIC(15,0) NOT NULL CHECK (montant > 0),
  reference          VARCHAR(100),
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reglements_vente ON ventes_reglements(vente_id);

-- ── 3. Lier une vente à sa session de caisse ─────────────────────
ALTER TABLE ventes
  ADD COLUMN IF NOT EXISTS session_caisse_id INT REFERENCES sessions_caisse(id);

CREATE INDEX IF NOT EXISTS idx_ventes_session ON ventes(session_caisse_id);

-- ── 4. Vue sessions avec stats ────────────────────────────────────
CREATE OR REPLACE VIEW v_sessions_caisse AS
SELECT
  sc.id,
  sc.magasin_id,
  sc.caissier_id,
  sc.ouvert_a,
  sc.ferme_a,
  sc.fond_ouverture,
  sc.montant_especes_attendu,
  sc.montant_especes_reel,
  sc.ecart,
  sc.nb_ventes,
  sc.total_ventes,
  sc.notes,
  sc.statut,
  sc.created_at,
  u.prenom || ' ' || u.nom   AS caissier_nom,
  mg.nom                     AS magasin_nom,
  EXTRACT(EPOCH FROM (COALESCE(sc.ferme_a, NOW()) - sc.ouvert_a)) / 3600
                             AS duree_heures
FROM sessions_caisse sc
JOIN utilisateurs u  ON u.id  = sc.caissier_id
JOIN magasins     mg ON mg.id = sc.magasin_id;
