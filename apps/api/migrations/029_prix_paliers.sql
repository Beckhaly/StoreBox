-- Migration 029 : Catégories de prix + paliers optionnels par quantité
-- Remplace l'ancienne version (prix_paliers bruts) par un système à 3 niveaux :
--   categories_prix  : référentiel réutilisable (Détail, Demi-gros, Gros…)
--   produits_prix    : prix de base d'un produit pour une catégorie donnée
--   prix_paliers     : tranches quantité optionnelles liées à un produits_prix

-- 1. Référentiel des catégories de prix
CREATE TABLE IF NOT EXISTS categories_prix (
  id      SERIAL PRIMARY KEY,
  code    VARCHAR(30)  UNIQUE NOT NULL,
  libelle VARCHAR(100) NOT NULL,
  ordre   INT          NOT NULL DEFAULT 0,
  actif   BOOLEAN      NOT NULL DEFAULT TRUE
);

INSERT INTO categories_prix (code, libelle, ordre) VALUES
  ('detail',    'Détail',    1),
  ('demi_gros', 'Demi-gros', 2),
  ('gros',      'Gros',      3),
  ('grossiste', 'Grossiste', 4)
ON CONFLICT (code) DO NOTHING;

-- 2. Prix par produit / catégorie (prix de base)
CREATE TABLE IF NOT EXISTS produits_prix (
  id                SERIAL PRIMARY KEY,
  produit_id        INT           NOT NULL REFERENCES produits(id) ON DELETE CASCADE,
  categorie_prix_id INT           NOT NULL REFERENCES categories_prix(id) ON DELETE CASCADE,
  prix              NUMERIC(15,0) NOT NULL,
  actif             BOOLEAN       NOT NULL DEFAULT TRUE,
  UNIQUE(produit_id, categorie_prix_id)
);

CREATE INDEX IF NOT EXISTS idx_produits_prix_produit ON produits_prix(produit_id);

-- 3. Paliers de quantité optionnels (liés à un produits_prix)
CREATE TABLE IF NOT EXISTS prix_paliers (
  id              SERIAL PRIMARY KEY,
  produit_prix_id INT           NOT NULL REFERENCES produits_prix(id) ON DELETE CASCADE,
  qte_min         NUMERIC(12,3) NOT NULL DEFAULT 1,
  qte_max         NUMERIC(12,3),            -- NULL = illimité
  prix            NUMERIC(15,0) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prix_paliers_produit_prix ON prix_paliers(produit_prix_id);
