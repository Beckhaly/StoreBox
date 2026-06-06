-- ============================================================
-- 012_societe_parametres.sql
-- Table pour stocker les informations de la société
-- ============================================================

CREATE TABLE IF NOT EXISTS societe_parametres (
  id SERIAL PRIMARY KEY,
  
  -- Infos générales
  nom VARCHAR(255) NOT NULL DEFAULT 'StoreBox',
  raison_sociale VARCHAR(255),
  slogan VARCHAR(255),
  description TEXT,
  
  -- Contact
  telephone VARCHAR(20),
  telephone2 VARCHAR(20),
  email VARCHAR(255),
  email_facturation VARCHAR(255),
  
  -- Adresse
  adresse VARCHAR(255),
  adresse2 VARCHAR(255),
  ville VARCHAR(100),
  code_postal VARCHAR(20),
  pays VARCHAR(100) DEFAULT 'Côte d''Ivoire',
  
  -- Identification
  rccm VARCHAR(50),    -- Registre du Commerce et du Crédit Mobilier
  numero_impot VARCHAR(50),
  numero_compte_bancaire VARCHAR(50),
  iban VARCHAR(34),
  swift VARCHAR(11),
  
  -- Banque
  nom_banque VARCHAR(255),
  adresse_banque VARCHAR(255),
  telephone_banque VARCHAR(20),
  
  -- Paramètres commerciaux
  devise VARCHAR(3) DEFAULT 'XOF',
  tva_defaut DECIMAL(5,2) DEFAULT 18.00,
  langue VARCHAR(5) DEFAULT 'fr',
  format_date VARCHAR(20) DEFAULT 'DD/MM/YYYY',
  
  -- Logo & branding
  logo_url VARCHAR(500),
  couleur_primaire VARCHAR(7) DEFAULT '#0066CC',
  couleur_secondaire VARCHAR(7) DEFAULT '#00CC66',
  
  -- Signature numérique
  signature_dirigeant TEXT,
  signature_comptable TEXT,
  
  -- Métadonnées
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER REFERENCES utilisateurs(id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_societe_parametres_updated_at ON societe_parametres(updated_at);

-- Données initiales
INSERT INTO societe_parametres (
  nom, raison_sociale, slogan, email, telephone,
  adresse, ville, pays, devise, tva_defaut
) VALUES (
  'StoreBox',
  'TéléPro Côte d''Ivoire SARL',
  'Votre plateforme de gestion commerciale',
  'info@storebox.app',
  '+225 27 22 XX XX XX',
  '123 Rue du Commerce',
  'Abidjan',
  'Côte d''Ivoire',
  'XOF',
  18.00
) ON CONFLICT DO NOTHING;

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_societe_parametres_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_societe_parametres_timestamp ON societe_parametres;
CREATE TRIGGER trigger_societe_parametres_timestamp
BEFORE UPDATE ON societe_parametres
FOR EACH ROW
EXECUTE FUNCTION update_societe_parametres_timestamp();
