-- ═══════════════════════════════════════════════════════════════════
-- Migration 021 — Produits universels
-- Unités de mesure · quantités décimales · vente au poids · prix variable
-- lots · péremption (FIFO) · types de pertes (casse/péremption/don)
-- Objectif : l'app gère TOUT type de produit (téléphones, fruits au kg,
-- liquides au litre, tissus au mètre, cartons, etc.)
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Référentiel des unités de mesure ───────────────────────────
CREATE TABLE IF NOT EXISTS unites_mesure (
  id        SERIAL PRIMARY KEY,
  code      VARCHAR(12) UNIQUE NOT NULL,
  libelle   VARCHAR(50) NOT NULL,
  decimales SMALLINT NOT NULL DEFAULT 0,   -- nb de décimales autorisées (0=pièce, 3=kg)
  actif     BOOLEAN  NOT NULL DEFAULT TRUE,
  ordre     SMALLINT NOT NULL DEFAULT 0
);

INSERT INTO unites_mesure (code, libelle, decimales, ordre) VALUES
  ('pcs',      'Pièce',        0, 1),
  ('kg',       'Kilogramme',   3, 2),
  ('g',        'Gramme',       0, 3),
  ('l',        'Litre',        3, 4),
  ('ml',       'Millilitre',   0, 5),
  ('m',        'Mètre',        2, 6),
  ('m2',       'Mètre carré',  2, 7),
  ('carton',   'Carton',       0, 8),
  ('sac',      'Sac',          0, 9),
  ('cageot',   'Cageot',       0, 10),
  ('douzaine', 'Douzaine',     0, 11),
  ('regime',   'Régime',       0, 12)
ON CONFLICT (code) DO NOTHING;

-- ── 2. Colonnes produits (comportement par produit) ──────────────
ALTER TABLE produits
  ADD COLUMN IF NOT EXISTS unite_id        INT REFERENCES unites_mesure(id),
  ADD COLUMN IF NOT EXISTS vendu_au_poids  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS prix_modifiable BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS gere_peremption BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS gere_lot        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS facteur_gros    NUMERIC(12,3) NOT NULL DEFAULT 1;

-- Tous les produits existants = unitaires (pièce) par défaut
UPDATE produits
SET    unite_id = (SELECT id FROM unites_mesure WHERE code = 'pcs')
WHERE  unite_id IS NULL;

-- ── 3. Supprimer les vues dépendantes (recréées en étape 5) ───────
DROP VIEW IF EXISTS v_stocks;
DROP VIEW IF EXISTS v_stocks_consolide;
DROP VIEW IF EXISTS v_mouvements_stock;
DROP VIEW IF EXISTS v_rentabilite_produits;

-- ── 4. Quantités & stocks en décimal (NUMERIC 12,3) ───────────────
ALTER TABLE ventes_lignes    ALTER COLUMN quantite     TYPE NUMERIC(12,3);
ALTER TABLE achats_lignes    ALTER COLUMN quantite     TYPE NUMERIC(12,3);
ALTER TABLE stocks           ALTER COLUMN quantite     TYPE NUMERIC(12,3);
ALTER TABLE stocks           ALTER COLUMN stock_alerte TYPE NUMERIC(12,3);
ALTER TABLE transferts_stock ALTER COLUMN quantite     TYPE NUMERIC(12,3);
ALTER TABLE mouvements_stock ALTER COLUMN quantite     TYPE NUMERIC(12,3);
ALTER TABLE mouvements_stock ALTER COLUMN stock_avant  TYPE NUMERIC(12,3);
ALTER TABLE mouvements_stock ALTER COLUMN stock_apres  TYPE NUMERIC(12,3);
ALTER TABLE produits         ALTER COLUMN stock         TYPE NUMERIC(12,3);
ALTER TABLE produits         ALTER COLUMN stock_alerte  TYPE NUMERIC(12,3);
ALTER TABLE produits         ALTER COLUMN stock_max     TYPE NUMERIC(12,3);

-- ── 5. Recréer les vues (définitions d'origine, inchangées) ───────
CREATE VIEW v_stocks AS
 SELECT s.produit_id,
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
    mg.nom AS magasin_nom,
    s.quantite = 0 AS rupture,
    s.quantite > 0 AND s.quantite <= s.stock_alerte AS alerte_stock
   FROM stocks s
     JOIN produits p ON p.id = s.produit_id
     JOIN magasins mg ON mg.id = s.magasin_id;

CREATE VIEW v_stocks_consolide AS
 SELECT p.id AS produit_id,
    p.designation,
    p.reference,
    p.prix_achat,
    p.prix_gros,
    p.prix_detail,
    p.stock_alerte,
    p.stock_max,
    p.actif,
    COALESCE(sum(s.quantite), 0) AS quantite_totale,
    COALESCE(sum(s.quantite), 0)::numeric * p.prix_achat AS valeur_stock,
        CASE
            WHEN COALESCE(sum(s.quantite), 0) = 0 THEN true
            ELSE false
        END AS rupture,
        CASE
            WHEN COALESCE(sum(s.quantite), 0) > 0 AND COALESCE(sum(s.quantite), 0) <= min(s.stock_alerte) THEN true
            ELSE false
        END AS alerte_stock
   FROM produits p
     LEFT JOIN stocks s ON s.produit_id = p.id
  GROUP BY p.id;

CREATE VIEW v_mouvements_stock AS
 SELECT ms.id,
    ms.produit_id,
    ms.type AS type_mouvement,
    ms.quantite,
    ms.stock_avant,
    ms.stock_apres,
    ms.motif,
    ms.ref_doc,
    ms.magasin_id,
    ms.created_at,
    p.designation,
    p.reference,
    mg.nom AS magasin_nom,
    COALESCE(( SELECT stocks.quantite
           FROM stocks
          WHERE stocks.produit_id = ms.produit_id AND stocks.magasin_id = ms.magasin_id), 0) AS stock_actuel
   FROM mouvements_stock ms
     JOIN produits p ON p.id = ms.produit_id
     LEFT JOIN magasins mg ON mg.id = ms.magasin_id;

CREATE VIEW v_rentabilite_produits AS
 SELECT p.id,
    p.reference,
    p.designation,
    m.nom AS marque,
    c.libelle AS categorie,
    p.prix_achat,
    p.prix_gros,
    p.prix_detail,
    COALESCE(sum(s.quantite), 0) AS stock_total,
    COALESCE(sum(vl.quantite), 0) AS qte_vendue,
    COALESCE(sum(vl.total_ligne), 0::numeric) AS ca_total,
    COALESCE(sum(vl.quantite::numeric * p.prix_achat), 0::numeric) AS cout_total,
    COALESCE(sum(vl.total_ligne) - sum(vl.quantite::numeric * p.prix_achat), 0::numeric) AS marge_brute,
        CASE
            WHEN COALESCE(sum(vl.total_ligne), 0::numeric) > 0::numeric THEN round(COALESCE(sum(vl.total_ligne) - sum(vl.quantite::numeric * p.prix_achat), 0::numeric) / sum(vl.total_ligne) * 100::numeric, 1)
            ELSE 0::numeric
        END AS taux_marge,
    COALESCE(sum(s.quantite), 0)::numeric * p.prix_achat AS valeur_stock,
    max(v.date_vente) AS derniere_vente
   FROM produits p
     LEFT JOIN marques m ON m.id = p.marque_id
     LEFT JOIN categories c ON c.id = p.categorie_id
     LEFT JOIN stocks s ON s.produit_id = p.id
     LEFT JOIN ventes_lignes vl ON vl.produit_id = p.id
     LEFT JOIN ventes v ON v.id = vl.vente_id
  WHERE p.actif = true
  GROUP BY p.id, m.nom, c.libelle;

-- ── 6. Types de mouvements étendus (pertes / casse / péremption / don)
ALTER TABLE mouvements_stock DROP CONSTRAINT IF EXISTS mouvements_stock_type_check;
ALTER TABLE mouvements_stock ADD  CONSTRAINT mouvements_stock_type_check
  CHECK (type IN ('entree','sortie','ajustement','retour','perte','casse','peremption','don'));

-- ── 7. Lots & péremption (FIFO) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS lots (
  id              SERIAL PRIMARY KEY,
  produit_id      INT NOT NULL REFERENCES produits(id) ON DELETE CASCADE,
  magasin_id      INT NOT NULL REFERENCES magasins(id) ON DELETE CASCADE,
  numero_lot      VARCHAR(60),
  date_entree     DATE NOT NULL DEFAULT CURRENT_DATE,
  date_peremption DATE,
  quantite        NUMERIC(12,3) NOT NULL DEFAULT 0,
  prix_achat      NUMERIC(12,0) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lots_produit_mag ON lots(produit_id, magasin_id);
CREATE INDEX IF NOT EXISTS idx_lots_peremption  ON lots(date_peremption) WHERE quantite > 0;

-- Lien optionnel ligne de vente / mouvement → lot
ALTER TABLE ventes_lignes    ADD COLUMN IF NOT EXISTS lot_id INT REFERENCES lots(id);
ALTER TABLE mouvements_stock ADD COLUMN IF NOT EXISTS lot_id INT REFERENCES lots(id);

-- ── 8. Vue des lots proches de péremption ─────────────────────────
CREATE OR REPLACE VIEW v_lots_expirant AS
 SELECT l.id,
        l.produit_id,
        l.magasin_id,
        l.numero_lot,
        l.date_entree,
        l.date_peremption,
        l.quantite,
        l.prix_achat,
        p.designation,
        p.reference,
        mg.nom AS magasin_nom,
        (l.date_peremption - CURRENT_DATE) AS jours_restants
   FROM lots l
     JOIN produits p  ON p.id  = l.produit_id
     JOIN magasins mg ON mg.id = l.magasin_id
  WHERE l.quantite > 0
    AND l.date_peremption IS NOT NULL;
