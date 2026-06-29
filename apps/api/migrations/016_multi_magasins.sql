-- Migration 016 : Un utilisateur peut avoir plusieurs magasins
-- Remplace la colonne utilisateurs.magasin_id par une table de liaison

-- 1. Table de liaison
CREATE TABLE IF NOT EXISTS utilisateurs_magasins (
  utilisateur_id INT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  magasin_id     INT NOT NULL REFERENCES magasins(id)     ON DELETE CASCADE,
  PRIMARY KEY (utilisateur_id, magasin_id)
);

-- 2. Migrer les associations existantes
INSERT INTO utilisateurs_magasins (utilisateur_id, magasin_id)
SELECT id, magasin_id FROM utilisateurs WHERE magasin_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Supprimer l'ancienne colonne
ALTER TABLE utilisateurs DROP COLUMN IF EXISTS magasin_id;

-- 4. Vue pratique pour les requêtes
DROP VIEW IF EXISTS v_utilisateurs_magasins;
CREATE VIEW v_utilisateurs_magasins AS
  SELECT u.id AS utilisateur_id,
         COALESCE(array_agg(um.magasin_id ORDER BY um.magasin_id) FILTER (WHERE um.magasin_id IS NOT NULL), '{}'::int[]) AS magasin_ids,
         COALESCE(array_agg(mg.nom ORDER BY um.magasin_id) FILTER (WHERE mg.nom IS NOT NULL), '{}'::text[]) AS magasin_noms
  FROM utilisateurs u
  LEFT JOIN utilisateurs_magasins um ON um.utilisateur_id = u.id
  LEFT JOIN magasins mg ON mg.id = um.magasin_id
  GROUP BY u.id;
