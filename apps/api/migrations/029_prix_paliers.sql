-- Migration 029 : Paliers de prix par quantité (multi-tarif produit)
-- Permet de définir plusieurs tranches de prix selon la quantité vendue.
-- Si aucun palier ne correspond : fallback sur prix_gros / prix_detail.

CREATE TABLE IF NOT EXISTS prix_paliers (
  id          SERIAL PRIMARY KEY,
  produit_id  INT           NOT NULL REFERENCES produits(id) ON DELETE CASCADE,
  libelle     VARCHAR(100)  NOT NULL DEFAULT '',
  qte_min     NUMERIC(12,3) NOT NULL DEFAULT 1,
  qte_max     NUMERIC(12,3),                    -- NULL = illimité
  prix        NUMERIC(15,0) NOT NULL,
  type_vente  VARCHAR(10)   NOT NULL DEFAULT 'tous'
              CHECK (type_vente IN ('gros','detail','tous')),
  actif       BOOLEAN       NOT NULL DEFAULT TRUE,
  ordre       INT           NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_prix_paliers_produit ON prix_paliers(produit_id);
