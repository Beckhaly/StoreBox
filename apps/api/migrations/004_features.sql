-- ============================================================
-- TéléPro CI — Migration 004 : Devis, Retours, Bons commande,
--              Objectifs, Export, Rapports avancés
-- ============================================================

-- ─── DEVIS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS devis (
  id              SERIAL PRIMARY KEY,
  numero          VARCHAR(20) UNIQUE NOT NULL,
  client_id       INT NOT NULL REFERENCES clients(id),
  type_vente      VARCHAR(10) NOT NULL DEFAULT 'gros' CHECK (type_vente IN ('gros','detail')),
  date_devis      DATE NOT NULL DEFAULT CURRENT_DATE,
  date_validite   DATE,
  statut          VARCHAR(20) NOT NULL DEFAULT 'brouillon'
    CHECK (statut IN ('brouillon','envoye','accepte','refuse','expire','converti')),
  sous_total      NUMERIC(15,0) NOT NULL DEFAULT 0,
  remise_pct      NUMERIC(5,2) DEFAULT 0,
  remise_montant  NUMERIC(15,0) DEFAULT 0,
  tva_pct         NUMERIC(5,2) DEFAULT 18,
  tva_montant     NUMERIC(15,0) DEFAULT 0,
  total_ttc       NUMERIC(15,0) NOT NULL DEFAULT 0,
  vente_id        INT REFERENCES ventes(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  created_by      INT
);

CREATE TABLE IF NOT EXISTS devis_lignes (
  id            SERIAL PRIMARY KEY,
  devis_id      INT NOT NULL REFERENCES devis(id) ON DELETE CASCADE,
  produit_id    INT NOT NULL REFERENCES produits(id),
  quantite      INT NOT NULL,
  prix_unitaire NUMERIC(12,0) NOT NULL,
  remise_pct    NUMERIC(5,2) DEFAULT 0,
  total_ligne   NUMERIC(15,0) NOT NULL
);

-- ─── RETOURS CLIENT ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS retours_client (
  id           SERIAL PRIMARY KEY,
  numero       VARCHAR(20) UNIQUE NOT NULL,
  vente_id     INT REFERENCES ventes(id),
  client_id    INT NOT NULL REFERENCES clients(id),
  date_retour  DATE NOT NULL DEFAULT CURRENT_DATE,
  motif        TEXT,
  type_avoir   VARCHAR(15) NOT NULL DEFAULT 'avoir'
    CHECK (type_avoir IN ('avoir','remboursement','echange')),
  montant_total NUMERIC(15,0) NOT NULL DEFAULT 0,
  statut       VARCHAR(15) NOT NULL DEFAULT 'en_attente'
    CHECK (statut IN ('en_attente','traite','annule')),
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS retours_lignes (
  id              SERIAL PRIMARY KEY,
  retour_id       INT NOT NULL REFERENCES retours_client(id) ON DELETE CASCADE,
  produit_id      INT NOT NULL REFERENCES produits(id),
  quantite        INT NOT NULL,
  prix_unitaire   NUMERIC(12,0) NOT NULL,
  total_ligne     NUMERIC(15,0) NOT NULL,
  raison          TEXT
);

-- ─── BONS DE COMMANDE FOURNISSEUR ────────────────────────────
CREATE TABLE IF NOT EXISTS bons_commande (
  id              SERIAL PRIMARY KEY,
  numero          VARCHAR(20) UNIQUE NOT NULL,
  fournisseur_id  INT NOT NULL REFERENCES fournisseurs(id),
  date_commande   DATE NOT NULL DEFAULT CURRENT_DATE,
  date_livraison  DATE,
  statut          VARCHAR(20) NOT NULL DEFAULT 'brouillon'
    CHECK (statut IN ('brouillon','envoye','confirme','receptionne','annule')),
  total_ht        NUMERIC(15,0) NOT NULL DEFAULT 0,
  tva_montant     NUMERIC(15,0) DEFAULT 0,
  total_ttc       NUMERIC(15,0) NOT NULL DEFAULT 0,
  achat_id        INT REFERENCES achats(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bons_commande_lignes (
  id              SERIAL PRIMARY KEY,
  bc_id           INT NOT NULL REFERENCES bons_commande(id) ON DELETE CASCADE,
  produit_id      INT NOT NULL REFERENCES produits(id),
  quantite        INT NOT NULL,
  quantite_recue  INT NOT NULL DEFAULT 0,
  prix_unitaire   NUMERIC(12,0) NOT NULL,
  total_ligne     NUMERIC(15,0) NOT NULL
);

-- ─── OBJECTIFS COMMERCIAUX ───────────────────────────────────
CREATE TABLE IF NOT EXISTS objectifs (
  id           SERIAL PRIMARY KEY,
  annee        INT NOT NULL,
  mois         INT NOT NULL CHECK (mois BETWEEN 1 AND 12),
  ca_cible     NUMERIC(15,0) NOT NULL DEFAULT 0,
  nb_ventes_cible INT DEFAULT 0,
  commercial_id INT REFERENCES utilisateurs(id),
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (annee, mois, commercial_id)
);

-- ─── VUES RAPPORTS AVANCÉS ───────────────────────────────────

-- Vue rentabilité par produit
CREATE OR REPLACE VIEW v_rentabilite_produits AS
SELECT
  p.id,
  p.reference,
  p.designation,
  m.nom AS marque,
  c.libelle AS categorie,
  p.prix_achat,
  p.prix_gros,
  p.prix_detail,
  p.stock,
  COALESCE(SUM(vl.quantite), 0)                        AS qte_vendue,
  COALESCE(SUM(vl.total_ligne), 0)                     AS ca_total,
  COALESCE(SUM(vl.quantite * p.prix_achat), 0)         AS cout_total,
  COALESCE(SUM(vl.total_ligne) - SUM(vl.quantite * p.prix_achat), 0) AS marge_brute,
  CASE WHEN COALESCE(SUM(vl.total_ligne), 0) > 0
    THEN ROUND((COALESCE(SUM(vl.total_ligne) - SUM(vl.quantite * p.prix_achat), 0)
         / SUM(vl.total_ligne)) * 100, 1)
    ELSE 0 END                                          AS taux_marge,
  p.stock * p.prix_achat                               AS valeur_stock,
  MAX(v.date_vente)                                    AS derniere_vente
FROM produits p
LEFT JOIN marques m      ON m.id = p.marque_id
LEFT JOIN categories c   ON c.id = p.categorie_id
LEFT JOIN ventes_lignes vl ON vl.produit_id = p.id
LEFT JOIN ventes v       ON v.id = vl.vente_id
WHERE p.actif = TRUE
GROUP BY p.id, m.nom, c.libelle;

-- Vue mouvements stock enrichie
CREATE OR REPLACE VIEW v_mouvements_stock AS
SELECT
  ms.*,
  p.designation,
  p.reference,
  p.stock AS stock_actuel
FROM mouvements_stock ms
JOIN produits p ON p.id = ms.produit_id;

-- Index utiles
CREATE INDEX IF NOT EXISTS idx_devis_client     ON devis(client_id);
CREATE INDEX IF NOT EXISTS idx_devis_statut     ON devis(statut);
CREATE INDEX IF NOT EXISTS idx_retours_client   ON retours_client(client_id);
CREATE INDEX IF NOT EXISTS idx_bc_fournisseur   ON bons_commande(fournisseur_id);
CREATE INDEX IF NOT EXISTS idx_objectifs_periode ON objectifs(annee, mois);
