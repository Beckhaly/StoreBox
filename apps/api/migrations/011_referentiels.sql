-- ============================================================
-- TéléPro CI — Migration 011 : Énumérations → Tables Référence
-- Conversion des énumérations en tables de referred avec CRUD
-- ============================================================

-- TYPES ÉNUMÉRÉS À CONVERTIR EN RÉFÉRENTIELS
-- 1. Type de client
CREATE TABLE IF NOT EXISTS types_clients (
  id        SERIAL PRIMARY KEY,
  code      VARCHAR(20) UNIQUE NOT NULL,
  libelle   VARCHAR(80) NOT NULL,
  actif     BOOLEAN DEFAULT TRUE,
  ordre     SMALLINT DEFAULT 0
);

INSERT INTO types_clients (code, libelle, ordre) VALUES
  ('grossiste', 'Grossiste', 1),
  ('detaillant', 'Détaillant', 2),
  ('particulier', 'Particulier', 3)
ON CONFLICT DO NOTHING;

-- 2. Statuts client
CREATE TABLE IF NOT EXISTS statuts_clients (
  id        SERIAL PRIMARY KEY,
  code      VARCHAR(20) UNIQUE NOT NULL,
  libelle   VARCHAR(80) NOT NULL,
  couleur   VARCHAR(10) DEFAULT 'gray',
  actif     BOOLEAN DEFAULT TRUE,
  ordre     SMALLINT DEFAULT 0
);

INSERT INTO statuts_clients (code, libelle, couleur, ordre) VALUES
  ('actif', 'Actif', 'green', 1),
  ('inactif', 'Inactif', 'gray', 2),
  ('bloque', 'Bloqué', 'red', 3),
  ('contentieux', 'Contentieux', 'orange', 4)
ON CONFLICT DO NOTHING;

-- 3. Types de vente
CREATE TABLE IF NOT EXISTS types_ventes (
  id        SERIAL PRIMARY KEY,
  code      VARCHAR(20) UNIQUE NOT NULL,
  libelle   VARCHAR(80) NOT NULL,
  actif     BOOLEAN DEFAULT TRUE,
  ordre     SMALLINT DEFAULT 0
);

INSERT INTO types_ventes (code, libelle, ordre) VALUES
  ('gros', 'Vente gros', 1),
  ('detail', 'Vente détail', 2)
ON CONFLICT DO NOTHING;

-- 4. Statuts de paiement (ventes)
CREATE TABLE IF NOT EXISTS statuts_paiements_ventes (
  id        SERIAL PRIMARY KEY,
  code      VARCHAR(20) UNIQUE NOT NULL,
  libelle   VARCHAR(80) NOT NULL,
  couleur   VARCHAR(10) DEFAULT 'gray',
  actif     BOOLEAN DEFAULT TRUE,
  ordre     SMALLINT DEFAULT 0
);

INSERT INTO statuts_paiements_ventes (code, libelle, couleur, ordre) VALUES
  ('non_paye', 'Non payé', 'red', 1),
  ('partiel', 'Partiellement payé', 'yellow', 2),
  ('paye', 'Payé', 'green', 3),
  ('en_retard', 'En retard', 'orange', 4),
  ('contentieux', 'Contentieux', 'red', 5)
ON CONFLICT DO NOTHING;

-- 5. Statuts de paiement (achats)
CREATE TABLE IF NOT EXISTS statuts_paiements_achats (
  id        SERIAL PRIMARY KEY,
  code      VARCHAR(20) UNIQUE NOT NULL,
  libelle   VARCHAR(80) NOT NULL,
  couleur   VARCHAR(10) DEFAULT 'gray',
  actif     BOOLEAN DEFAULT TRUE,
  ordre     SMALLINT DEFAULT 0
);

INSERT INTO statuts_paiements_achats (code, libelle, couleur, ordre) VALUES
  ('non_paye', 'Non payé', 'red', 1),
  ('partiel', 'Partiellement payé', 'yellow', 2),
  ('paye', 'Payé', 'green', 3),
  ('en_retard', 'En retard', 'orange', 4)
ON CONFLICT DO NOTHING;

-- 6. Types de mouvements de stock
CREATE TABLE IF NOT EXISTS types_mouvements_stock (
  id        SERIAL PRIMARY KEY,
  code      VARCHAR(20) UNIQUE NOT NULL,
  libelle   VARCHAR(80) NOT NULL,
  signe     SMALLINT NOT NULL CHECK (signe IN (1, -1)),
  actif     BOOLEAN DEFAULT TRUE,
  ordre     SMALLINT DEFAULT 0
);

INSERT INTO types_mouvements_stock (code, libelle, signe, ordre) VALUES
  ('entree', 'Entrée', 1, 1),
  ('sortie', 'Sortie', -1, 2),
  ('ajustement', 'Ajustement', 1, 3),
  ('retour', 'Retour', 1, 4)
ON CONFLICT DO NOTHING;

-- 7. Canaux de notification
CREATE TABLE IF NOT EXISTS canaux_notification (
  id        SERIAL PRIMARY KEY,
  code      VARCHAR(20) UNIQUE NOT NULL,
  libelle   VARCHAR(80) NOT NULL,
  icone     VARCHAR(20),
  actif     BOOLEAN DEFAULT TRUE,
  ordre     SMALLINT DEFAULT 0
);

INSERT INTO canaux_notification (code, libelle, icone, ordre) VALUES
  ('sms', 'SMS', 'message-square', 1),
  ('whatsapp', 'WhatsApp', 'send', 2),
  ('email', 'Email', 'mail', 3)
ON CONFLICT DO NOTHING;

-- 8. Statuts de notification
CREATE TABLE IF NOT EXISTS statuts_notification (
  id        SERIAL PRIMARY KEY,
  code      VARCHAR(20) UNIQUE NOT NULL,
  libelle   VARCHAR(80) NOT NULL,
  couleur   VARCHAR(10) DEFAULT 'gray',
  actif     BOOLEAN DEFAULT TRUE,
  ordre     SMALLINT DEFAULT 0
);

INSERT INTO statuts_notification (code, libelle, couleur, ordre) VALUES
  ('envoye', 'Envoyé', 'green', 1),
  ('echec', 'Échec', 'red', 2),
  ('en_attente', 'En attente', 'yellow', 3)
ON CONFLICT DO NOTHING;

-- 9. Statuts de devis
CREATE TABLE IF NOT EXISTS statuts_devis (
  id        SERIAL PRIMARY KEY,
  code      VARCHAR(20) UNIQUE NOT NULL,
  libelle   VARCHAR(80) NOT NULL,
  couleur   VARCHAR(10) DEFAULT 'gray',
  actif     BOOLEAN DEFAULT TRUE,
  ordre     SMALLINT DEFAULT 0
);

INSERT INTO statuts_devis (code, libelle, couleur, ordre) VALUES
  ('brouillon', 'Brouillon', 'gray', 1),
  ('envoye', 'Envoyé', 'blue', 2),
  ('accepte', 'Accepté', 'green', 3),
  ('refuse', 'Refusé', 'red', 4),
  ('expire', 'Expiré', 'orange', 5),
  ('converti', 'Converti', 'purple', 6)
ON CONFLICT DO NOTHING;

-- 10. Types d'avoir
CREATE TABLE IF NOT EXISTS types_avoir (
  id        SERIAL PRIMARY KEY,
  code      VARCHAR(20) UNIQUE NOT NULL,
  libelle   VARCHAR(80) NOT NULL,
  actif     BOOLEAN DEFAULT TRUE,
  ordre     SMALLINT DEFAULT 0
);

INSERT INTO types_avoir (code, libelle, ordre) VALUES
  ('avoir', 'Avoir', 1),
  ('remboursement', 'Remboursement', 2),
  ('echange', 'Échange', 3)
ON CONFLICT DO NOTHING;

-- 11. Statuts d'avoir
CREATE TABLE IF NOT EXISTS statuts_avoir (
  id        SERIAL PRIMARY KEY,
  code      VARCHAR(20) UNIQUE NOT NULL,
  libelle   VARCHAR(80) NOT NULL,
  couleur   VARCHAR(10) DEFAULT 'gray',
  actif     BOOLEAN DEFAULT TRUE,
  ordre     SMALLINT DEFAULT 0
);

INSERT INTO statuts_avoir (code, libelle, couleur, ordre) VALUES
  ('en_attente', 'En attente', 'yellow', 1),
  ('traite', 'Traité', 'green', 2),
  ('annule', 'Annulé', 'red', 3)
ON CONFLICT DO NOTHING;

-- 12. Statuts de réception
CREATE TABLE IF NOT EXISTS statuts_reception (
  id        SERIAL PRIMARY KEY,
  code      VARCHAR(20) UNIQUE NOT NULL,
  libelle   VARCHAR(80) NOT NULL,
  couleur   VARCHAR(10) DEFAULT 'gray',
  actif     BOOLEAN DEFAULT TRUE,
  ordre     SMALLINT DEFAULT 0
);

INSERT INTO statuts_reception (code, libelle, couleur, ordre) VALUES
  ('brouillon', 'Brouillon', 'gray', 1),
  ('envoye', 'Envoyé', 'blue', 2),
  ('confirme', 'Confirmé', 'blue', 3),
  ('receptionne', 'Réceptionné', 'green', 4),
  ('annule', 'Annulé', 'red', 5)
ON CONFLICT DO NOTHING;

-- 13. Types de paiement
CREATE TABLE IF NOT EXISTS types_paiement (
  id        SERIAL PRIMARY KEY,
  code      VARCHAR(20) UNIQUE NOT NULL,
  libelle   VARCHAR(80) NOT NULL,
  actif     BOOLEAN DEFAULT TRUE,
  ordre     SMALLINT DEFAULT 0
);

INSERT INTO types_paiement (code, libelle, ordre) VALUES
  ('encaissement', 'Encaissement', 1),
  ('decaissement', 'Décaissement', 2)
ON CONFLICT DO NOTHING;
