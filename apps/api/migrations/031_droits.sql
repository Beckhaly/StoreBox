-- Migration 031 : Gestion des droits enrichie
--  * roles.systeme  → protège les 5 rôles de base (non supprimables)
--  * utilisateurs.permissions_override → surcharges individuelles (JSONB)
--  * enrichit les droits des rôles système pour couvrir les nouveaux modules
--    (fusion JSONB additive : ne verrouille aucun accès existant)

ALTER TABLE roles        ADD COLUMN IF NOT EXISTS systeme BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS permissions_override JSONB;

UPDATE roles SET systeme = TRUE
 WHERE code IN ('admin', 'commercial', 'caissier', 'comptable', 'magasinier');

-- Droits par défaut étendus (|| = fusion, la droite gagne mais on part de l'existant)
UPDATE roles SET permissions = permissions || '{
  "ventes":"write","clients":"write","produits":"read","dashboard":"write",
  "devis":"write","retours":"write","creances":"read","fournisseurs":"read","rapports":"read"
}'::jsonb WHERE code = 'commercial';

UPDATE roles SET permissions = permissions || '{
  "ventes":"write","paiements":"write","caisse":"write","dashboard":"read",
  "clients":"read","produits":"read"
}'::jsonb WHERE code = 'caissier';

UPDATE roles SET permissions = permissions || '{
  "creances":"write","dettes":"write","paiements":"write","rapports":"write",
  "depenses":"write","echeances":"write","dashboard":"read","achats":"read","fournisseurs":"read"
}'::jsonb WHERE code = 'comptable';

UPDATE roles SET permissions = permissions || '{
  "produits":"write","stock":"write","achats":"write","fournisseurs":"write",
  "commandes":"write","dashboard":"read","retours":"read"
}'::jsonb WHERE code = 'magasinier';
