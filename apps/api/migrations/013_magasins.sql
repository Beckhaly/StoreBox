-- ============================================================
-- TéléPro CI — Migration 013 : Gestion multi-magasin
-- Crée les structures sans casser l'existant (colonnes nullable)
-- ============================================================

-- ─────────────────────────────────────────────
-- TABLE MAGASINS
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS magasins (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(20)  UNIQUE NOT NULL,
  nom         VARCHAR(100) NOT NULL,
  adresse     TEXT,
  telephone   VARCHAR(30),
  email       VARCHAR(100),
  actif       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- STOCK PAR MAGASIN (remplacera produits.stock)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stocks (
  produit_id    INT NOT NULL REFERENCES produits(id) ON DELETE CASCADE,
  magasin_id    INT NOT NULL REFERENCES magasins(id) ON DELETE CASCADE,
  quantite      INT NOT NULL DEFAULT 0,
  stock_alerte  INT NOT NULL DEFAULT 5,
  PRIMARY KEY (produit_id, magasin_id)
);

CREATE INDEX IF NOT EXISTS idx_stocks_magasin  ON stocks(magasin_id);
CREATE INDEX IF NOT EXISTS idx_stocks_produit  ON stocks(produit_id);
CREATE INDEX IF NOT EXISTS idx_stocks_alerte   ON stocks(quantite) WHERE quantite > 0;

-- ─────────────────────────────────────────────
-- TRANSFERTS INTER-MAGASINS
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS transferts_stock (
  id              SERIAL PRIMARY KEY,
  produit_id      INT NOT NULL REFERENCES produits(id),
  magasin_source  INT NOT NULL REFERENCES magasins(id),
  magasin_dest    INT NOT NULL REFERENCES magasins(id),
  quantite        INT NOT NULL CHECK (quantite > 0),
  notes           TEXT,
  created_by      INT REFERENCES utilisateurs(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  CHECK (magasin_source <> magasin_dest)
);

CREATE INDEX IF NOT EXISTS idx_transferts_produit ON transferts_stock(produit_id);
CREATE INDEX IF NOT EXISTS idx_transferts_source  ON transferts_stock(magasin_source);
CREATE INDEX IF NOT EXISTS idx_transferts_dest    ON transferts_stock(magasin_dest);

-- ─────────────────────────────────────────────
-- AJOUT magasin_id SUR LES TABLES MÉTIER
-- (nullable pour ne pas casser les données existantes)
-- La migration 014 fera le backfill puis ajoutera DEFAULT 1
-- ─────────────────────────────────────────────

ALTER TABLE utilisateurs    ADD COLUMN IF NOT EXISTS magasin_id INT REFERENCES magasins(id);
ALTER TABLE ventes          ADD COLUMN IF NOT EXISTS magasin_id INT REFERENCES magasins(id);
ALTER TABLE achats          ADD COLUMN IF NOT EXISTS magasin_id INT REFERENCES magasins(id);
ALTER TABLE paiements       ADD COLUMN IF NOT EXISTS magasin_id INT REFERENCES magasins(id);
ALTER TABLE mouvements_stock ADD COLUMN IF NOT EXISTS magasin_id INT REFERENCES magasins(id);
ALTER TABLE devis            ADD COLUMN IF NOT EXISTS magasin_id INT REFERENCES magasins(id);
ALTER TABLE retours_client   ADD COLUMN IF NOT EXISTS magasin_id INT REFERENCES magasins(id);
ALTER TABLE bons_commande    ADD COLUMN IF NOT EXISTS magasin_id INT REFERENCES magasins(id);
ALTER TABLE objectifs        ADD COLUMN IF NOT EXISTS magasin_id INT REFERENCES magasins(id);
ALTER TABLE IF EXISTS echeances_manuelles ADD COLUMN IF NOT EXISTS magasin_id INT REFERENCES magasins(id);

-- Index sur les colonnes les plus interrogées
CREATE INDEX IF NOT EXISTS idx_ventes_magasin        ON ventes(magasin_id);
CREATE INDEX IF NOT EXISTS idx_achats_magasin        ON achats(magasin_id);
CREATE INDEX IF NOT EXISTS idx_paiements_magasin     ON paiements(magasin_id);
CREATE INDEX IF NOT EXISTS idx_mouvements_magasin    ON mouvements_stock(magasin_id);
CREATE INDEX IF NOT EXISTS idx_utilisateurs_magasin  ON utilisateurs(magasin_id);
