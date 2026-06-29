-- ============================================================
-- TéléPro CI — Schéma PostgreSQL complet
-- Gestion commerciale : téléphones & accessoires
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────
-- RÉFÉRENTIELS
-- ─────────────────────────────────────────────

CREATE TABLE categories (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(20) UNIQUE NOT NULL,
  libelle     VARCHAR(100) NOT NULL,
  parent_id   INT REFERENCES categories(id)
);

CREATE TABLE marques (
  id      SERIAL PRIMARY KEY,
  nom     VARCHAR(80) UNIQUE NOT NULL,
  pays    VARCHAR(60)
);

CREATE TABLE moyens_paiement (
  id   SERIAL PRIMARY KEY,
  code VARCHAR(30) UNIQUE NOT NULL,
  nom  VARCHAR(80) NOT NULL
);

-- ─────────────────────────────────────────────
-- PRODUITS & STOCK
-- ─────────────────────────────────────────────

CREATE TABLE produits (
  id              SERIAL PRIMARY KEY,
  reference       VARCHAR(40) UNIQUE NOT NULL,
  designation     VARCHAR(200) NOT NULL,
  marque_id       INT REFERENCES marques(id),
  categorie_id    INT REFERENCES categories(id),
  description     TEXT,
  prix_achat      NUMERIC(12,0) NOT NULL DEFAULT 0,
  prix_gros       NUMERIC(12,0) NOT NULL,
  prix_detail     NUMERIC(12,0) NOT NULL,
  qte_min_gros    INT NOT NULL DEFAULT 5,   -- seuil pour prix gros
  stock           INT NOT NULL DEFAULT 0,
  stock_alerte    INT NOT NULL DEFAULT 10,
  stock_max       INT NOT NULL DEFAULT 500,
  actif           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE mouvements_stock (
  id           SERIAL PRIMARY KEY,
  produit_id   INT NOT NULL REFERENCES produits(id),
  type         VARCHAR(20) NOT NULL CHECK (type IN ('entree','sortie','ajustement','retour')),
  quantite     INT NOT NULL,
  motif        VARCHAR(200),
  ref_doc      VARCHAR(50),   -- facture, bon de livraison, etc.
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  created_by   INT
);

-- ─────────────────────────────────────────────
-- TIERS : CLIENTS & FOURNISSEURS
-- ─────────────────────────────────────────────

CREATE TABLE clients (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(20) UNIQUE NOT NULL,
  type_client     VARCHAR(20) NOT NULL CHECK (type_client IN ('grossiste','detaillant','particulier')),
  raison_sociale  VARCHAR(200) NOT NULL,
  contact_nom     VARCHAR(100),
  telephone       VARCHAR(30),
  email           VARCHAR(120),
  adresse         TEXT,
  ville           VARCHAR(80) DEFAULT 'Abidjan',
  siret           VARCHAR(30),
  plafond_credit  NUMERIC(15,0) DEFAULT 0,    -- 0 = pas de crédit
  delai_paiement  INT DEFAULT 0,              -- jours de crédit accordés
  encours_actuel  NUMERIC(15,0) DEFAULT 0,   -- calculé
  statut          VARCHAR(20) DEFAULT 'actif' CHECK (statut IN ('actif','inactif','bloque','contentieux')),
  note_risque     SMALLINT DEFAULT 3 CHECK (note_risque BETWEEN 1 AND 5),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE fournisseurs (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(20) UNIQUE NOT NULL,
  raison_sociale  VARCHAR(200) NOT NULL,
  contact_nom     VARCHAR(100),
  telephone       VARCHAR(30),
  email           VARCHAR(120),
  adresse         TEXT,
  pays            VARCHAR(60) DEFAULT 'Côte d''Ivoire',
  delai_paiement  INT DEFAULT 30,
  conditions      TEXT,
  actif           BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- VENTES
-- ─────────────────────────────────────────────

CREATE TABLE ventes (
  id              SERIAL PRIMARY KEY,
  numero          VARCHAR(20) UNIQUE NOT NULL,
  client_id       INT NOT NULL REFERENCES clients(id),
  type_vente      VARCHAR(20) NOT NULL CHECK (type_vente IN ('gros','detail')),
  date_vente      DATE NOT NULL DEFAULT CURRENT_DATE,
  date_echeance   DATE,                        -- null = paiement comptant
  sous_total      NUMERIC(15,0) NOT NULL DEFAULT 0,
  remise_pct      NUMERIC(5,2) DEFAULT 0,
  remise_montant  NUMERIC(15,0) DEFAULT 0,
  tva_pct         NUMERIC(5,2) DEFAULT 18,
  tva_montant     NUMERIC(15,0) DEFAULT 0,
  total_ttc       NUMERIC(15,0) NOT NULL DEFAULT 0,
  montant_paye    NUMERIC(15,0) DEFAULT 0,
  solde_restant   NUMERIC(15,0) DEFAULT 0,     -- calculé
  statut_paiement VARCHAR(25) DEFAULT 'non_paye'
    CHECK (statut_paiement IN ('non_paye','partiel','paye','en_retard','contentieux')),
  moyen_paiement_id INT REFERENCES moyens_paiement(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  created_by      INT
);

CREATE TABLE ventes_lignes (
  id           SERIAL PRIMARY KEY,
  vente_id     INT NOT NULL REFERENCES ventes(id) ON DELETE CASCADE,
  produit_id   INT NOT NULL REFERENCES produits(id),
  quantite     INT NOT NULL,
  prix_unitaire NUMERIC(12,0) NOT NULL,
  remise_pct   NUMERIC(5,2) DEFAULT 0,
  total_ligne  NUMERIC(15,0) NOT NULL
);

-- ─────────────────────────────────────────────
-- ACHATS FOURNISSEURS
-- ─────────────────────────────────────────────

CREATE TABLE achats (
  id              SERIAL PRIMARY KEY,
  numero          VARCHAR(20) UNIQUE NOT NULL,
  fournisseur_id  INT NOT NULL REFERENCES fournisseurs(id),
  date_achat      DATE NOT NULL DEFAULT CURRENT_DATE,
  date_echeance   DATE,
  total_ht        NUMERIC(15,0) NOT NULL DEFAULT 0,
  tva_montant     NUMERIC(15,0) DEFAULT 0,
  total_ttc       NUMERIC(15,0) NOT NULL DEFAULT 0,
  montant_paye    NUMERIC(15,0) DEFAULT 0,
  solde_restant   NUMERIC(15,0) DEFAULT 0,
  statut_paiement VARCHAR(25) DEFAULT 'non_paye'
    CHECK (statut_paiement IN ('non_paye','partiel','paye','en_retard')),
  reference_frs   VARCHAR(80),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE achats_lignes (
  id            SERIAL PRIMARY KEY,
  achat_id      INT NOT NULL REFERENCES achats(id) ON DELETE CASCADE,
  produit_id    INT NOT NULL REFERENCES produits(id),
  quantite      INT NOT NULL,
  prix_unitaire NUMERIC(12,0) NOT NULL,
  total_ligne   NUMERIC(15,0) NOT NULL
);

-- ─────────────────────────────────────────────
-- PAIEMENTS (règlements partiels ou totaux)
-- ─────────────────────────────────────────────

CREATE TABLE paiements (
  id                  SERIAL PRIMARY KEY,
  type_paiement       VARCHAR(20) NOT NULL CHECK (type_paiement IN ('encaissement','decaissement')),
  vente_id            INT REFERENCES ventes(id),
  achat_id            INT REFERENCES achats(id),
  client_id           INT REFERENCES clients(id),
  fournisseur_id      INT REFERENCES fournisseurs(id),
  montant             NUMERIC(15,0) NOT NULL,
  date_paiement       DATE NOT NULL DEFAULT CURRENT_DATE,
  moyen_paiement_id   INT REFERENCES moyens_paiement(id),
  reference           VARCHAR(80),  -- N° chèque, transaction mobile money…
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- CRÉANCES & ÉCHÉANCES (vues calculées)
-- ─────────────────────────────────────────────

CREATE VIEW v_creances_clients AS
SELECT
  v.id,
  v.numero,
  c.id            AS client_id,
  c.code          AS client_code,
  c.raison_sociale,
  c.type_client,
  c.telephone,
  v.date_vente,
  v.date_echeance,
  v.total_ttc,
  v.montant_paye,
  v.solde_restant,
  v.statut_paiement,
  CASE
    WHEN v.date_echeance IS NULL THEN NULL
    WHEN v.solde_restant = 0 THEN 0
    ELSE CURRENT_DATE - v.date_echeance
  END AS jours_retard,
  CASE
    WHEN v.solde_restant = 0 THEN 'paye'
    WHEN v.date_echeance IS NULL THEN 'comptant_impaye'
    WHEN CURRENT_DATE <= v.date_echeance THEN 'non_echu'
    WHEN CURRENT_DATE - v.date_echeance <= 30 THEN 'echu_30j'
    WHEN CURRENT_DATE - v.date_echeance <= 60 THEN 'echu_60j'
    ELSE 'contentieux'
  END AS categorie_echeance
FROM ventes v
JOIN clients c ON c.id = v.client_id
WHERE v.solde_restant > 0;

CREATE VIEW v_dettes_fournisseurs AS
SELECT
  a.id,
  a.numero,
  f.id            AS fournisseur_id,
  f.code          AS fournisseur_code,
  f.raison_sociale,
  f.telephone,
  a.date_achat,
  a.date_echeance,
  a.total_ttc,
  a.montant_paye,
  a.solde_restant,
  a.statut_paiement,
  CASE
    WHEN a.date_echeance IS NULL THEN NULL
    WHEN a.solde_restant = 0 THEN 0
    ELSE CURRENT_DATE - a.date_echeance
  END AS jours_retard,
  CASE
    WHEN a.solde_restant = 0 THEN 'paye'
    WHEN a.date_echeance IS NULL THEN 'non_echu'
    WHEN CURRENT_DATE <= a.date_echeance THEN 'non_echu'
    WHEN CURRENT_DATE - a.date_echeance <= 15 THEN 'echu_15j'
    ELSE 'en_retard'
  END AS categorie_echeance
FROM achats a
JOIN fournisseurs f ON f.id = a.fournisseur_id
WHERE a.solde_restant > 0;

CREATE VIEW v_echeances_30j AS
SELECT 'client' AS sens, v.numero, c.raison_sociale AS tiers, v.date_echeance, v.solde_restant AS montant, v.statut_paiement
FROM ventes v JOIN clients c ON c.id = v.client_id
WHERE v.solde_restant > 0 AND v.date_echeance BETWEEN CURRENT_DATE - INTERVAL '7 days' AND CURRENT_DATE + INTERVAL '30 days'
UNION ALL
SELECT 'fournisseur', a.numero, f.raison_sociale, a.date_echeance, a.solde_restant, a.statut_paiement
FROM achats a JOIN fournisseurs f ON f.id = a.fournisseur_id
WHERE a.solde_restant > 0 AND a.date_echeance BETWEEN CURRENT_DATE - INTERVAL '7 days' AND CURRENT_DATE + INTERVAL '30 days'
ORDER BY date_echeance;

-- ─────────────────────────────────────────────
-- INDEX PERFORMANCES
-- ─────────────────────────────────────────────

CREATE INDEX idx_ventes_client      ON ventes(client_id);
CREATE INDEX idx_ventes_statut      ON ventes(statut_paiement);
CREATE INDEX idx_ventes_echeance    ON ventes(date_echeance) WHERE solde_restant > 0;
CREATE INDEX idx_achats_fournisseur ON achats(fournisseur_id);
CREATE INDEX idx_achats_echeance    ON achats(date_echeance) WHERE solde_restant > 0;
CREATE INDEX idx_produits_stock     ON produits(stock) WHERE actif = TRUE;
CREATE INDEX idx_paiements_vente    ON paiements(vente_id);
CREATE INDEX idx_paiements_achat    ON paiements(achat_id);

-- ─────────────────────────────────────────────
-- TRIGGER : mise à jour solde_restant
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_solde_vente() RETURNS TRIGGER AS $$
BEGIN
  UPDATE ventes SET
    solde_restant = total_ttc - COALESCE((SELECT SUM(montant) FROM paiements WHERE vente_id = NEW.vente_id), 0),
    montant_paye  = COALESCE((SELECT SUM(montant) FROM paiements WHERE vente_id = NEW.vente_id), 0),
    statut_paiement = CASE
      WHEN total_ttc - COALESCE((SELECT SUM(montant) FROM paiements WHERE vente_id = NEW.vente_id), 0) <= 0 THEN 'paye'
      WHEN COALESCE((SELECT SUM(montant) FROM paiements WHERE vente_id = NEW.vente_id), 0) > 0 THEN 'partiel'
      ELSE statut_paiement
    END
  WHERE id = NEW.vente_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_paiement_vente
AFTER INSERT OR UPDATE ON paiements
FOR EACH ROW WHEN (NEW.vente_id IS NOT NULL)
EXECUTE FUNCTION update_solde_vente();

CREATE OR REPLACE FUNCTION update_solde_achat() RETURNS TRIGGER AS $$
BEGIN
  UPDATE achats SET
    solde_restant = total_ttc - COALESCE((SELECT SUM(montant) FROM paiements WHERE achat_id = NEW.achat_id), 0),
    montant_paye  = COALESCE((SELECT SUM(montant) FROM paiements WHERE achat_id = NEW.achat_id), 0),
    statut_paiement = CASE
      WHEN total_ttc - COALESCE((SELECT SUM(montant) FROM paiements WHERE achat_id = NEW.achat_id), 0) <= 0 THEN 'paye'
      WHEN COALESCE((SELECT SUM(montant) FROM paiements WHERE achat_id = NEW.achat_id), 0) > 0 THEN 'partiel'
      ELSE statut_paiement
    END
  WHERE id = NEW.achat_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_paiement_achat
AFTER INSERT OR UPDATE ON paiements
FOR EACH ROW WHEN (NEW.achat_id IS NOT NULL)
EXECUTE FUNCTION update_solde_achat();
