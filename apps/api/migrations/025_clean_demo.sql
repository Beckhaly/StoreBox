-- ═══════════════════════════════════════════════════════════════════
-- Migration 025 — Nettoyage des données de DÉMO (production)
-- Appliquée UNIQUEMENT en production (SEED_DEMO != true), UNE SEULE FOIS
-- (tracée dans schema_migrations) → ne touchera jamais les vraies
-- données saisies ensuite par le client.
--
-- Vide : transactions, catalogue, 2e magasin, marques/catégories démo.
-- Garde : référentiels, unités, moyens de paiement, magasin principal,
--         Caisse 1, client POS, rôles + comptes, société.
-- ═══════════════════════════════════════════════════════════════════

-- 1. Données transactionnelles + catalogue (CASCADE gère les dépendances)
TRUNCATE TABLE
  ventes_reglements, ventes_lignes, ventes,
  achats_lignes, achats,
  paiements,
  devis_lignes, devis,
  retours_lignes, retours_client,
  bons_commande_lignes, bons_commande,
  lots, mouvements_stock, transferts_stock, stocks,
  produits,
  sessions_caisse,
  audit_logs, notifications_log,
  echeances_manuelles, objectifs,
  fournisseurs
RESTART IDENTITY CASCADE;

-- 2. Clients : ne garder que les clients POS (vente au comptoir)
DELETE FROM clients WHERE code NOT LIKE 'POS%';

-- 3. Supprimer le 2e magasin de démo et ses utilisateurs dédiés.
--    (utilisateurs.magasin_id n'existe plus → via la table de jonction)
--    On supprime les comptes liés à un autre magasin que le principal
--    ET non liés au principal (ex. caisse2/commercial2) ; l'admin reste.
DELETE FROM utilisateurs u
 WHERE EXISTS     (SELECT 1 FROM utilisateurs_magasins m WHERE m.utilisateur_id=u.id AND m.magasin_id <> 1)
   AND NOT EXISTS (SELECT 1 FROM utilisateurs_magasins m WHERE m.utilisateur_id=u.id AND m.magasin_id = 1);
DELETE FROM utilisateurs_magasins WHERE magasin_id <> 1;
DELETE FROM caisses               WHERE magasin_id <> 1;
DELETE FROM magasins              WHERE id <> 1;

-- 4. Vider le catalogue de référence démo (le client crée les siens)
DELETE FROM marques;
DELETE FROM categories;
