-- Migration 032 : Génération automatique des codes / références
-- Clients, fournisseurs, produits et utilisateurs reçoivent un code auto
-- (préfixe + numéro séquentiel sur 5 chiffres) si aucun n'est fourni.
-- Format 5 chiffres → aucune collision avec les codes existants (lettre + 3 chiffres).

CREATE SEQUENCE IF NOT EXISTS seq_code_client;
CREATE SEQUENCE IF NOT EXISTS seq_code_fournisseur;
CREATE SEQUENCE IF NOT EXISTS seq_code_produit;
CREATE SEQUENCE IF NOT EXISTS seq_code_utilisateur;

-- Clients : CLI-00001
CREATE OR REPLACE FUNCTION sb_code_client() RETURNS trigger AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'CLI-' || lpad(nextval('seq_code_client')::text, 5, '0');
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_code_client ON clients;
CREATE TRIGGER trg_code_client BEFORE INSERT ON clients
  FOR EACH ROW EXECUTE FUNCTION sb_code_client();

-- Fournisseurs : FRN-00001
CREATE OR REPLACE FUNCTION sb_code_fournisseur() RETURNS trigger AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'FRN-' || lpad(nextval('seq_code_fournisseur')::text, 5, '0');
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_code_fournisseur ON fournisseurs;
CREATE TRIGGER trg_code_fournisseur BEFORE INSERT ON fournisseurs
  FOR EACH ROW EXECUTE FUNCTION sb_code_fournisseur();

-- Produits : PRD-00001 (colonne reference)
CREATE OR REPLACE FUNCTION sb_code_produit() RETURNS trigger AS $$
BEGIN
  IF NEW.reference IS NULL OR NEW.reference = '' THEN
    NEW.reference := 'PRD-' || lpad(nextval('seq_code_produit')::text, 5, '0');
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_code_produit ON produits;
CREATE TRIGGER trg_code_produit BEFORE INSERT ON produits
  FOR EACH ROW EXECUTE FUNCTION sb_code_produit();

-- Utilisateurs : USR-00001
CREATE OR REPLACE FUNCTION sb_code_utilisateur() RETURNS trigger AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'USR-' || lpad(nextval('seq_code_utilisateur')::text, 5, '0');
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_code_utilisateur ON utilisateurs;
CREATE TRIGGER trg_code_utilisateur BEFORE INSERT ON utilisateurs
  FOR EACH ROW EXECUTE FUNCTION sb_code_utilisateur();
