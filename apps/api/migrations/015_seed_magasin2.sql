-- ============================================================
-- StoreBox — Migration 015 : Magasin 2 "Boutique Cocody"
-- Jeu de données complet : stock, utilisateurs, clients, ventes, achats
-- ============================================================

-- ─── 1. CRÉER LE MAGASIN ─────────────────────────────────────
INSERT INTO magasins (id, code, nom, adresse, telephone, email, actif)
VALUES (2, 'MG-COCODY', 'Boutique Cocody', 'Rue des Jardins, Cocody, Abidjan', '+22507111222', 'cocody@storebox.app', TRUE)
ON CONFLICT (id) DO UPDATE SET
  code      = EXCLUDED.code,
  nom       = EXCLUDED.nom,
  adresse   = EXCLUDED.adresse,
  telephone = EXCLUDED.telephone,
  email     = EXCLUDED.email,
  actif     = EXCLUDED.actif;

SELECT setval('magasins_id_seq', GREATEST((SELECT MAX(id) FROM magasins), 2));

-- ─── 2. UTILISATEURS DU MAGASIN 2 ────────────────────────────
-- Même hash bcrypt que les comptes existants (Storebox@123)
INSERT INTO utilisateurs (code, nom, prenom, email, telephone, password_hash, role_id, magasin_id, actif)
VALUES ('USR-006', 'Kouamé', 'Jean-Baptiste', 'commercial2@storebox.app', '+22507222333',
        '$2b$10$AbWmryQEkgfcRDnCoEigDu2hTLxZYiFmQ/wZNnqwNqQtuR7chPeKq', 2, 2, TRUE)
ON CONFLICT (email) DO UPDATE SET
  magasin_id    = EXCLUDED.magasin_id,
  password_hash = EXCLUDED.password_hash,
  actif         = EXCLUDED.actif;

INSERT INTO utilisateurs (code, nom, prenom, email, telephone, password_hash, role_id, magasin_id, actif)
VALUES ('USR-007', 'Traoré', 'Aminata', 'caisse2@storebox.app', '+22507333444',
        '$2b$10$AbWmryQEkgfcRDnCoEigDu2hTLxZYiFmQ/wZNnqwNqQtuR7chPeKq', 3, 2, TRUE)
ON CONFLICT (email) DO UPDATE SET
  magasin_id    = EXCLUDED.magasin_id,
  password_hash = EXCLUDED.password_hash,
  actif         = EXCLUDED.actif;

-- ─── 3. STOCK MAGASIN 2 ──────────────────────────────────────
INSERT INTO stocks (produit_id, magasin_id, quantite, stock_alerte) VALUES
  -- iPhones
  (6,  2, 8,  3),
  (7,  2, 5,  3),
  (8,  2, 10, 3),
  (9,  2, 6,  3),
  -- Samsung premium
  (4,  2, 12, 5),
  (5,  2, 8,  3),
  (3,  2, 15, 5),
  (2,  2, 10, 5),
  (1,  2, 20, 8),
  -- Tecno / Infinix
  (13, 2, 18, 8),
  (12, 2, 14, 6),
  (11, 2, 10, 5),
  (16, 2, 12, 5),
  (15, 2, 10, 5),
  -- Xiaomi
  (19, 2, 8,  4),
  (18, 2, 12, 5),
  (17, 2, 15, 6),
  -- Reconditionné
  (22, 2, 8,  3),
  (23, 2, 10, 4),
  -- Accessoires
  (24, 2, 100, 20),
  (25, 2, 60,  15),
  (26, 2, 25,  10),
  (27, 2, 50,  15),
  (29, 2, 40,  15),
  (31, 2, 80,  20),
  (33, 2, 120, 25),
  (35, 2, 20,  8),
  (36, 2, 15,  5)
ON CONFLICT (produit_id, magasin_id) DO UPDATE SET
  quantite     = EXCLUDED.quantite,
  stock_alerte = EXCLUDED.stock_alerte;

-- ─── 4. CLIENTS ───────────────────────────────────────────────
-- Les clients sont globaux (pas de magasin_id sur la table clients)
INSERT INTO clients (code, type_client, raison_sociale, contact_nom, telephone, email, adresse, ville, plafond_credit, delai_paiement, statut)
VALUES
  ('CLI-C01', 'grossiste',   'TechVision Cocody SARL',   'Konan Thierry',    '+22507444555', 'techvision@gmail.com', 'Cocody Riviera 2',   'Abidjan', 5000000, 30, 'actif'),
  ('CLI-C02', 'particulier', 'Brou Eugène',              'Brou Eugène',      '+22507555666', NULL,                   'Cocody Angré',       'Abidjan', 500000,   7, 'actif'),
  ('CLI-C03', 'detaillant',  'Prestige Mobile CI',       'Aya Adjoua',       '+22507666777', 'prestige@mobile.ci',  'Zone 4, Marcory',    'Abidjan', 3000000, 15, 'actif'),
  ('CLI-C04', 'particulier', 'Coulibaly Mariam',         'Coulibaly Mariam', '+22507777888', NULL,                   'Cocody II Plateaux', 'Abidjan', 0,        0, 'actif'),
  ('CLI-C05', 'grossiste',   'Électronique Plus Abidjan','Soro Drissa',      '+22507888999', 'elecplus@ci.com',     'Adjamé Commerce',    'Abidjan', 8000000, 45, 'actif')
ON CONFLICT (code) DO NOTHING;

-- ─── 5. VENTES ───────────────────────────────────────────────
DO $$
DECLARE
  v_cli_c01  INT := (SELECT id FROM clients WHERE code='CLI-C01');
  v_cli_c02  INT := (SELECT id FROM clients WHERE code='CLI-C02');
  v_cli_c03  INT := (SELECT id FROM clients WHERE code='CLI-C03');
  v_cli_c04  INT := (SELECT id FROM clients WHERE code='CLI-C04');
  v_cli_c05  INT := (SELECT id FROM clients WHERE code='CLI-C05');
  v_usr6     INT := (SELECT id FROM utilisateurs WHERE code='USR-006');
  v_mp_cash  INT := (SELECT id FROM moyens_paiement WHERE code='ESPECES'   LIMIT 1);
  v_mp_wave  INT := (SELECT id FROM moyens_paiement WHERE code='WAVE'      LIMIT 1);
  v_mp_momo  INT := (SELECT id FROM moyens_paiement WHERE code='MTNMOMO'   LIMIT 1);
  v_mp_vir   INT := (SELECT id FROM moyens_paiement WHERE code='VIREMENT'  LIMIT 1);
  v_vente_id INT;
BEGIN

  -- ── Vente 1 : TechVision — Gros crédit partiel — il y a 5 mois
  INSERT INTO ventes (numero, type_vente, client_id, date_vente, date_echeance, statut_paiement,
    sous_total, tva_montant, total_ttc, montant_paye, solde_restant, notes, created_by, magasin_id)
  VALUES ('VNT-C-001', 'gros', v_cli_c01,
    CURRENT_DATE - INTERVAL '5 months',
    CURRENT_DATE - INTERVAL '4 months' + INTERVAL '30 days',
    'partiel',
    ROUND((5*288000 + ROUND(5*235000*0.95::numeric)) / 1.18::numeric),
    ROUND((5*288000 + ROUND(5*235000*0.95::numeric)) - ROUND((5*288000 + ROUND(5*235000*0.95::numeric)) / 1.18::numeric)),
    5*288000 + ROUND(5*235000*0.95::numeric),
    800000,
    5*288000 + ROUND(5*235000*0.95::numeric) - 800000,
    'Commande initiale ouverture compte', v_usr6, 2)
  RETURNING id INTO v_vente_id;

  INSERT INTO ventes_lignes (vente_id, produit_id, quantite, prix_unitaire, remise_pct, total_ligne)
  VALUES
    (v_vente_id, 8, 5, 288000, 0,    1440000),
    (v_vente_id, 6, 5, 235000, 5, ROUND(5*235000*0.95::numeric));

  INSERT INTO paiements (vente_id, montant, date_paiement, moyen_paiement_id, type_paiement, notes, magasin_id)
  VALUES (v_vente_id, 800000, CURRENT_DATE - INTERVAL '5 months', v_mp_vir, 'encaissement', 'Acompte virement', 2);

  INSERT INTO mouvements_stock (produit_id, type, quantite, motif, ref_doc, magasin_id)
  VALUES
    (8, 'sortie', 5, 'Vente', 'VNT-C-001', 2),
    (6, 'sortie', 5, 'Vente', 'VNT-C-001', 2);


  -- ── Vente 2 : Brou Eugène — Détail Wave comptant — il y a 4 mois
  INSERT INTO ventes (numero, type_vente, client_id, date_vente, statut_paiement,
    sous_total, tva_montant, total_ttc, montant_paye, solde_restant, created_by, magasin_id)
  VALUES ('VNT-C-002', 'detail', v_cli_c02,
    CURRENT_DATE - INTERVAL '4 months',
    'paye',
    ROUND(399000 / 1.18::numeric), ROUND(399000 - 399000 / 1.18::numeric), 399000, 399000, 0,
    v_usr6, 2)
  RETURNING id INTO v_vente_id;

  INSERT INTO ventes_lignes (vente_id, produit_id, quantite, prix_unitaire, remise_pct, total_ligne)
  VALUES (v_vente_id, 9, 1, 399000, 0, 399000);

  INSERT INTO paiements (vente_id, montant, date_paiement, moyen_paiement_id, type_paiement, magasin_id)
  VALUES (v_vente_id, 399000, CURRENT_DATE - INTERVAL '4 months', v_mp_wave, 'encaissement', 2);

  INSERT INTO mouvements_stock (produit_id, type, quantite, motif, ref_doc, magasin_id)
  VALUES (9, 'sortie', 1, 'Vente', 'VNT-C-002', 2);


  -- ── Vente 3 : Prestige Mobile — Gros soldé — il y a 3 mois
  INSERT INTO ventes (numero, type_vente, client_id, date_vente, statut_paiement,
    sous_total, tva_montant, total_ttc, montant_paye, solde_restant, created_by, magasin_id)
  VALUES ('VNT-C-003', 'gros', v_cli_c03,
    CURRENT_DATE - INTERVAL '3 months',
    'paye',
    ROUND(2688000 / 1.18::numeric), ROUND(2688000 - 2688000 / 1.18::numeric), 2688000, 2688000, 0,
    v_usr6, 2)
  RETURNING id INTO v_vente_id;

  INSERT INTO ventes_lignes (vente_id, produit_id, quantite, prix_unitaire, remise_pct, total_ligne)
  VALUES
    (v_vente_id, 4,  8, 138000, 0, 1104000),
    (v_vente_id, 13, 8,  88000, 0,  704000),
    (v_vente_id, 17, 8,  50000, 0,  400000),
    (v_vente_id, 24, 8,   7500, 0,   60000),
    (v_vente_id, 33, 8,  12000, 0,   96000);

  INSERT INTO paiements (vente_id, montant, date_paiement, moyen_paiement_id, type_paiement, magasin_id)
  VALUES (v_vente_id, 2688000, CURRENT_DATE - INTERVAL '3 months', v_mp_vir, 'encaissement', 2);

  INSERT INTO mouvements_stock (produit_id, type, quantite, motif, ref_doc, magasin_id)
  VALUES
    (4,  'sortie', 8, 'Vente', 'VNT-C-003', 2),
    (13, 'sortie', 8, 'Vente', 'VNT-C-003', 2),
    (17, 'sortie', 8, 'Vente', 'VNT-C-003', 2),
    (24, 'sortie', 8, 'Vente', 'VNT-C-003', 2),
    (33, 'sortie', 8, 'Vente', 'VNT-C-003', 2);


  -- ── Vente 4 : Coulibaly Mariam — Détail espèces — il y a 2 mois
  INSERT INTO ventes (numero, type_vente, client_id, date_vente, statut_paiement,
    sous_total, tva_montant, total_ttc, montant_paye, solde_restant, created_by, magasin_id)
  VALUES ('VNT-C-004', 'detail', v_cli_c04,
    CURRENT_DATE - INTERVAL '2 months',
    'paye',
    ROUND(547500 / 1.18::numeric), ROUND(547500 - 547500 / 1.18::numeric), 547500, 547500, 0,
    v_usr6, 2)
  RETURNING id INTO v_vente_id;

  INSERT INTO ventes_lignes (vente_id, produit_id, quantite, prix_unitaire, remise_pct, total_ligne)
  VALUES
    (v_vente_id, 5,  1, 545000, 0, 545000),
    (v_vente_id, 31, 1,   2500, 0,   2500);

  INSERT INTO paiements (vente_id, montant, date_paiement, moyen_paiement_id, type_paiement, magasin_id)
  VALUES (v_vente_id, 547500, CURRENT_DATE - INTERVAL '2 months', v_mp_cash, 'encaissement', 2);

  INSERT INTO mouvements_stock (produit_id, type, quantite, motif, ref_doc, magasin_id)
  VALUES
    (5,  'sortie', 1, 'Vente', 'VNT-C-004', 2),
    (31, 'sortie', 1, 'Vente', 'VNT-C-004', 2);


  -- ── Vente 5 : Électronique Plus — Gros crédit partiel — il y a 6 semaines
  INSERT INTO ventes (numero, type_vente, client_id, date_vente, date_echeance, statut_paiement,
    sous_total, tva_montant, total_ttc, montant_paye, solde_restant, created_by, magasin_id)
  VALUES ('VNT-C-005', 'gros', v_cli_c05,
    CURRENT_DATE - INTERVAL '6 weeks',
    CURRENT_DATE + INTERVAL '9 days',
    'partiel',
    ROUND(3958000 / 1.18::numeric), ROUND(3958000 - 3958000 / 1.18::numeric), 3958000, 2000000, 1958000,
    v_usr6, 2)
  RETURNING id INTO v_vente_id;

  INSERT INTO ventes_lignes (vente_id, produit_id, quantite, prix_unitaire, remise_pct, total_ligne)
  VALUES
    (v_vente_id, 8,  8, 288000, 0, 2304000),
    (v_vente_id, 7,  5, 270000, 0, 1350000),
    (v_vente_id, 29, 8,  18000, 0,  144000),
    (v_vente_id, 35, 8,  20000, 0,  160000);

  INSERT INTO paiements (vente_id, montant, date_paiement, moyen_paiement_id, type_paiement, magasin_id)
  VALUES (v_vente_id, 2000000, CURRENT_DATE - INTERVAL '6 weeks', v_mp_momo, 'encaissement', 2);

  INSERT INTO mouvements_stock (produit_id, type, quantite, motif, ref_doc, magasin_id)
  VALUES
    (8,  'sortie', 8, 'Vente', 'VNT-C-005', 2),
    (7,  'sortie', 5, 'Vente', 'VNT-C-005', 2),
    (29, 'sortie', 8, 'Vente', 'VNT-C-005', 2),
    (35, 'sortie', 8, 'Vente', 'VNT-C-005', 2);


  -- ── Vente 6 : TechVision — Gros soldé — il y a 3 semaines
  INSERT INTO ventes (numero, type_vente, client_id, date_vente, statut_paiement,
    sous_total, tva_montant, total_ttc, montant_paye, solde_restant, created_by, magasin_id)
  VALUES ('VNT-C-006', 'gros', v_cli_c01,
    CURRENT_DATE - INTERVAL '3 weeks',
    'paye',
    ROUND(1942880 / 1.18::numeric), ROUND(1942880 - 1942880 / 1.18::numeric), 1942880, 1942880, 0,
    v_usr6, 2)
  RETURNING id INTO v_vente_id;

  INSERT INTO ventes_lignes (vente_id, produit_id, quantite, prix_unitaire, remise_pct, total_ligne)
  VALUES
    (v_vente_id, 9,  4, 330000, 0,    1320000),
    (v_vente_id, 22, 4, 130000, 0,     520000),
    (v_vente_id, 26, 4,  12000, 0,      48000),
    (v_vente_id, 34, 4,  14000, 2, ROUND(4*14000*0.98::numeric));

  INSERT INTO paiements (vente_id, montant, date_paiement, moyen_paiement_id, type_paiement, magasin_id)
  VALUES (v_vente_id, 1942880, CURRENT_DATE - INTERVAL '3 weeks', v_mp_vir, 'encaissement', 2);

  INSERT INTO mouvements_stock (produit_id, type, quantite, motif, ref_doc, magasin_id)
  VALUES
    (9,  'sortie', 4, 'Vente', 'VNT-C-006', 2),
    (22, 'sortie', 4, 'Vente', 'VNT-C-006', 2),
    (26, 'sortie', 4, 'Vente', 'VNT-C-006', 2),
    (34, 'sortie', 4, 'Vente', 'VNT-C-006', 2);


  -- ── Vente 7 : Brou Eugène — Détail Wave — il y a 10 jours
  INSERT INTO ventes (numero, type_vente, client_id, date_vente, statut_paiement,
    sous_total, tva_montant, total_ttc, montant_paye, solde_restant, created_by, magasin_id)
  VALUES ('VNT-C-007', 'detail', v_cli_c02,
    CURRENT_DATE - INTERVAL '10 days',
    'paye',
    ROUND(113500 / 1.18::numeric), ROUND(113500 - 113500 / 1.18::numeric), 113500, 113500, 0,
    v_usr6, 2)
  RETURNING id INTO v_vente_id;

  INSERT INTO ventes_lignes (vente_id, produit_id, quantite, prix_unitaire, remise_pct, total_ligne)
  VALUES
    (v_vente_id, 13, 1, 109000, 0, 109000),
    (v_vente_id, 29, 1,   4500, 0,   4500);

  INSERT INTO paiements (vente_id, montant, date_paiement, moyen_paiement_id, type_paiement, magasin_id)
  VALUES (v_vente_id, 113500, CURRENT_DATE - INTERVAL '10 days', v_mp_wave, 'encaissement', 2);

  INSERT INTO mouvements_stock (produit_id, type, quantite, motif, ref_doc, magasin_id)
  VALUES
    (13, 'sortie', 1, 'Vente', 'VNT-C-007', 2),
    (29, 'sortie', 1, 'Vente', 'VNT-C-007', 2);


  -- ── Vente 8 : Prestige Mobile — Gros impayé récent — il y a 5 jours
  INSERT INTO ventes (numero, type_vente, client_id, date_vente, date_echeance, statut_paiement,
    sous_total, tva_montant, total_ttc, montant_paye, solde_restant, created_by, magasin_id)
  VALUES ('VNT-C-008', 'gros', v_cli_c03,
    CURRENT_DATE - INTERVAL '5 days',
    CURRENT_DATE + INTERVAL '10 days',
    'non_paye',
    ROUND(2232000 / 1.18::numeric), ROUND(2232000 - 2232000 / 1.18::numeric), 2232000, 0, 2232000,
    v_usr6, 2)
  RETURNING id INTO v_vente_id;

  INSERT INTO ventes_lignes (vente_id, produit_id, quantite, prix_unitaire, remise_pct, total_ligne)
  VALUES
    (v_vente_id, 5,  2, 450000, 0,  900000),
    (v_vente_id, 4,  6, 138000, 0,  828000),
    (v_vente_id, 16, 6,  84000, 0,  504000);

  INSERT INTO mouvements_stock (produit_id, type, quantite, motif, ref_doc, magasin_id)
  VALUES
    (5,  'sortie', 2, 'Vente', 'VNT-C-008', 2),
    (4,  'sortie', 6, 'Vente', 'VNT-C-008', 2),
    (16, 'sortie', 6, 'Vente', 'VNT-C-008', 2);

END $$;

-- ─── 6. ACHATS FOURNISSEURS ───────────────────────────────────
DO $$
DECLARE
  v_fourn_id INT;
  v_mp_vir   INT := (SELECT id FROM moyens_paiement WHERE code='VIREMENT' LIMIT 1);
  v_achat_id INT;
BEGIN
  SELECT id INTO v_fourn_id FROM fournisseurs ORDER BY id LIMIT 1;
  IF v_fourn_id IS NULL THEN RETURN; END IF;

  -- ── Achat 1 : Appro initial — soldé
  INSERT INTO achats (numero, fournisseur_id, date_achat, statut_paiement,
    total_ht, tva_montant, total_ttc, montant_paye, solde_restant, notes, magasin_id)
  VALUES ('ACH-C-001', v_fourn_id,
    CURRENT_DATE - INTERVAL '5 months' - INTERVAL '15 days',
    'paye',
    ROUND(14515000 / 1.18::numeric), ROUND(14515000 - 14515000 / 1.18::numeric), 14515000, 14515000, 0,
    'Stock initial boutique Cocody', 2)
  RETURNING id INTO v_achat_id;

  INSERT INTO achats_lignes (achat_id, produit_id, quantite, prix_unitaire, total_ligne)
  VALUES
    (v_achat_id, 6,  15, 195000, 2925000),
    (v_achat_id, 8,  15, 240000, 3600000),
    (v_achat_id, 5,  10, 380000, 3800000),
    (v_achat_id, 4,  20, 115000, 2300000),
    (v_achat_id, 13, 25,  72000, 1800000),
    (v_achat_id, 24,100,    550,   55000),
    (v_achat_id, 33,150,    400,   60000);

  INSERT INTO paiements (achat_id, montant, date_paiement, moyen_paiement_id, type_paiement, magasin_id)
  VALUES (v_achat_id, 14515000,
    CURRENT_DATE - INTERVAL '5 months' - INTERVAL '15 days',
    v_mp_vir, 'decaissement', 2);

  -- ── Achat 2 : Réappro mensuel — partiel
  INSERT INTO achats (numero, fournisseur_id, date_achat, date_echeance, statut_paiement,
    total_ht, tva_montant, total_ttc, montant_paye, solde_restant, notes, magasin_id)
  VALUES ('ACH-C-002', v_fourn_id,
    CURRENT_DATE - INTERVAL '2 months',
    CURRENT_DATE + INTERVAL '15 days',
    'partiel',
    ROUND(7070000 / 1.18::numeric), ROUND(7070000 - 7070000 / 1.18::numeric), 7070000, 3500000, 3570000,
    'Réappro mensuel iPhone + accessoires', 2)
  RETURNING id INTO v_achat_id;

  INSERT INTO achats_lignes (achat_id, produit_id, quantite, prix_unitaire, total_ligne)
  VALUES
    (v_achat_id, 7,  10, 225000, 2250000),
    (v_achat_id, 9,  10, 275000, 2750000),
    (v_achat_id, 22, 10, 105000, 1050000),
    (v_achat_id, 29, 50,  12000,  600000),
    (v_achat_id, 35, 30,  14000,  420000);

  INSERT INTO paiements (achat_id, montant, date_paiement, moyen_paiement_id, type_paiement, magasin_id)
  VALUES (v_achat_id, 3500000, CURRENT_DATE - INTERVAL '2 months', v_mp_vir, 'decaissement', 2);

END $$;

-- ─── 7. RECALCUL DES SOLDES ──────────────────────────────────
UPDATE ventes SET
  montant_paye  = COALESCE((SELECT SUM(montant) FROM paiements WHERE vente_id = ventes.id), 0),
  solde_restant = total_ttc - COALESCE((SELECT SUM(montant) FROM paiements WHERE vente_id = ventes.id), 0)
WHERE magasin_id = 2;

UPDATE achats SET
  montant_paye  = COALESCE((SELECT SUM(montant) FROM paiements WHERE achat_id = achats.id), 0),
  solde_restant = total_ttc - COALESCE((SELECT SUM(montant) FROM paiements WHERE achat_id = achats.id), 0)
WHERE magasin_id = 2;

-- ─── 8. VÉRIFICATION ─────────────────────────────────────────
SELECT 'Magasin 2 créé'          AS info, nom, adresse FROM magasins WHERE id=2;
SELECT 'Utilisateurs magasin 2'  AS info, COUNT(*) nb FROM utilisateurs WHERE magasin_id=2;
SELECT 'Produits en stock mag 2' AS info, COUNT(*) nb, SUM(quantite) unites FROM stocks WHERE magasin_id=2;
SELECT 'Clients (globaux)'       AS info, COUNT(*) nb FROM clients WHERE code LIKE 'CLI-C%';
SELECT 'Ventes magasin 2'        AS info, COUNT(*) nb, SUM(total_ttc) ca_total FROM ventes WHERE magasin_id=2;
SELECT 'Achats magasin 2'        AS info, COUNT(*) nb, SUM(total_ttc) montant_total FROM achats WHERE magasin_id=2;
SELECT 'Créances mag 2'          AS info, SUM(solde_restant) total FROM ventes WHERE magasin_id=2 AND statut_paiement IN ('non_paye','partiel','en_retard');
SELECT 'Dettes mag 2'            AS info, SUM(solde_restant) total FROM achats WHERE magasin_id=2 AND statut_paiement IN ('non_paye','partiel');
