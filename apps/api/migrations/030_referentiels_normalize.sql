-- Migration 030 : Normaliser marques, categories et categories_depenses
-- en référentiels standard (colonnes code/libelle/ordre/actif) pour une
-- gestion uniforme via l'admin « Référentiels ».
-- 100% additive + triggers de compatibilité → aucune requête existante cassée.

-- Fonction slug réutilisable (code technique à partir d'un libellé)
CREATE OR REPLACE FUNCTION sb_slug(txt TEXT) RETURNS TEXT AS $$
  SELECT trim(both '_' FROM lower(regexp_replace(COALESCE(txt, ''), '[^a-zA-Z0-9]+', '_', 'g')));
$$ LANGUAGE sql IMMUTABLE;

-- ── 1. categories (produits) : + ordre, actif ───────────────────────
ALTER TABLE categories ADD COLUMN IF NOT EXISTS ordre INT     NOT NULL DEFAULT 0;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS actif BOOLEAN NOT NULL DEFAULT TRUE;

-- ── 2. categories_depenses : + code, ordre (auto-code via trigger) ──
ALTER TABLE categories_depenses ADD COLUMN IF NOT EXISTS code  VARCHAR(50);
ALTER TABLE categories_depenses ADD COLUMN IF NOT EXISTS ordre INT NOT NULL DEFAULT 0;
UPDATE categories_depenses SET code = sb_slug(libelle) || '_' || id WHERE code IS NULL;

CREATE OR REPLACE FUNCTION sb_categories_depenses_code() RETURNS trigger AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := sb_slug(NEW.libelle) || '_' || NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cat_dep_code ON categories_depenses;
CREATE TRIGGER trg_cat_dep_code BEFORE INSERT ON categories_depenses
  FOR EACH ROW EXECUTE FUNCTION sb_categories_depenses_code();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_depenses_code_key') THEN
    ALTER TABLE categories_depenses ADD CONSTRAINT categories_depenses_code_key UNIQUE (code);
  END IF;
END $$;

-- ── 3. marques : + code, libelle, ordre, actif (nom gardé synchro) ──
ALTER TABLE marques ADD COLUMN IF NOT EXISTS code    VARCHAR(50);
ALTER TABLE marques ADD COLUMN IF NOT EXISTS libelle VARCHAR(80);
ALTER TABLE marques ADD COLUMN IF NOT EXISTS ordre   INT     NOT NULL DEFAULT 0;
ALTER TABLE marques ADD COLUMN IF NOT EXISTS actif   BOOLEAN NOT NULL DEFAULT TRUE;
UPDATE marques SET libelle = nom                     WHERE libelle IS NULL;
UPDATE marques SET code    = sb_slug(nom) || '_' || id WHERE code IS NULL;

-- Trigger : produits utilise m.nom → on garde nom = libelle en permanence,
-- on remplit libelle depuis nom pour les INSERT legacy (seeds), et code auto.
CREATE OR REPLACE FUNCTION sb_marques_sync() RETURNS trigger AS $$
BEGIN
  IF NEW.libelle IS NULL OR NEW.libelle = '' THEN NEW.libelle := NEW.nom; END IF;
  IF NEW.libelle IS NOT NULL                 THEN NEW.nom     := NEW.libelle; END IF;
  IF NEW.code IS NULL OR NEW.code = ''       THEN NEW.code    := sb_slug(NEW.libelle) || '_' || NEW.id; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_marques_sync ON marques;
CREATE TRIGGER trg_marques_sync BEFORE INSERT OR UPDATE ON marques
  FOR EACH ROW EXECUTE FUNCTION sb_marques_sync();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marques_code_key') THEN
    ALTER TABLE marques ADD CONSTRAINT marques_code_key UNIQUE (code);
  END IF;
END $$;
