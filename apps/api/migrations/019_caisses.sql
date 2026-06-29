-- ═══════════════════════════════════════════════════════════════════
-- Migration 019 — Table caisses (un magasin peut avoir N caisses)
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Table caisses ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS caisses (
  id         SERIAL PRIMARY KEY,
  magasin_id INT NOT NULL REFERENCES magasins(id),
  nom        VARCHAR(100) NOT NULL,
  actif      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caisses_magasin ON caisses(magasin_id);

-- ── 2. Rattacher les sessions à une caisse ────────────────────────
ALTER TABLE sessions_caisse
  ADD COLUMN IF NOT EXISTS caisse_id INT REFERENCES caisses(id);

CREATE INDEX IF NOT EXISTS idx_sessions_caisse_id ON sessions_caisse(caisse_id);

-- Unicité partielle : une seule session ouverte par caisse
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_caisse_unique_ouverte
  ON sessions_caisse(caisse_id)
  WHERE statut = 'ouverte';

-- ── 3. Caisse par défaut pour chaque magasin existant ─────────────
INSERT INTO caisses (magasin_id, nom)
SELECT id, 'Caisse 1'
FROM   magasins
WHERE  actif = TRUE
ON CONFLICT DO NOTHING;

-- Rattacher les sessions existantes à la Caisse 1 de leur magasin
UPDATE sessions_caisse sc
SET    caisse_id = (
  SELECT c.id FROM caisses c
  WHERE  c.magasin_id = sc.magasin_id
  ORDER  BY c.id
  LIMIT  1
)
WHERE  sc.caisse_id IS NULL;

-- ── 4. Vue sessions enrichie avec caisse_nom ─────────────────────
-- DROP prealable : 018 a cree la vue sans caisse_id ; CREATE OR REPLACE ne peut
-- pas inserer une colonne au milieu (reordonnancement interdit).
DROP VIEW IF EXISTS v_sessions_caisse;
CREATE VIEW v_sessions_caisse AS
SELECT
  sc.id,
  sc.magasin_id,
  sc.caissier_id,
  sc.caisse_id,
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
  u.prenom  || ' ' || u.nom  AS caissier_nom,
  mg.nom                     AS magasin_nom,
  c.nom                      AS caisse_nom,
  EXTRACT(EPOCH FROM (COALESCE(sc.ferme_a, NOW()) - sc.ouvert_a)) / 3600
                             AS duree_heures
FROM sessions_caisse sc
JOIN utilisateurs u  ON u.id  = sc.caissier_id
JOIN magasins     mg ON mg.id = sc.magasin_id
LEFT JOIN caisses  c ON c.id  = sc.caisse_id;
