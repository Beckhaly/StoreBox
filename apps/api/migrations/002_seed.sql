-- ============================================================
-- TéléPro CI — Jeu de données de démonstration
-- Secteur : vente téléphones & accessoires (gros + détail)
-- ============================================================

-- ─── RÉFÉRENTIELS ───────────────────────────────────────────

INSERT INTO categories (code, libelle) VALUES
  ('TELE',   'Téléphones portables'),
  ('ACCESS', 'Accessoires'),
  ('PIECES', 'Pièces détachées'),
  ('RECON',  'Reconditionnés');

INSERT INTO categories (code, libelle, parent_id) VALUES
  ('TELE-AND',  'Android',           1),
  ('TELE-IOS',  'iOS / iPhone',      1),
  ('TELE-RECON','Reconditionnés',    1),
  ('ACC-COQUE', 'Coques & protections', 2),
  ('ACC-CHARGE', 'Chargeurs',        2),
  ('ACC-AUDIO', 'Audio & écouteurs', 2),
  ('ACC-VERRE', 'Verres trempés',    2),
  ('ACC-CABLE', 'Câbles',            2),
  ('ACC-BATTERIE','Batteries',       2);

INSERT INTO marques (nom, pays) VALUES
  ('Samsung',  'Corée du Sud'),
  ('Apple',    'États-Unis'),
  ('Tecno',    'Chine / Afrique'),
  ('Infinix',  'Chine / Afrique'),
  ('Xiaomi',   'Chine'),
  ('ITEL',     'Chine / Afrique'),
  ('Huawei',   'Chine'),
  ('Nokia',    'Finlande'),
  ('Divers',   'Divers');

INSERT INTO moyens_paiement (code, nom) VALUES
  ('ESPECES',   'Espèces'),
  ('OMONEY',    'Orange Money'),
  ('MTNMOMO',   'MTN Mobile Money'),
  ('WAVE',      'Wave'),
  ('VIREMENT',  'Virement bancaire'),
  ('CHEQUE',    'Chèque'),
  ('CB',        'Carte bancaire'),
  ('CREDIT',    'Crédit client');

-- ─── PRODUITS ────────────────────────────────────────────────

INSERT INTO produits (reference, designation, marque_id, categorie_id, prix_achat, prix_gros, prix_detail, qte_min_gros, stock, stock_alerte, stock_max) VALUES
-- Samsung
('SAM-A15-128',    'Samsung Galaxy A15 128Go',          1, 5,  52000,  65000,  79000, 5, 145, 30, 300),
('SAM-A25-128',    'Samsung Galaxy A25 128Go',          1, 5,  70000,  85000, 105000, 5,  88, 20, 200),
('SAM-A35-256',    'Samsung Galaxy A35 256Go',          1, 5,  95000, 115000, 139000, 5,  54, 15, 150),
('SAM-A55-256',    'Samsung Galaxy A55 256Go',          1, 5, 115000, 138000, 168000, 5,  63, 15, 120),
('SAM-S24-256',    'Samsung Galaxy S24 256Go',          1, 5, 380000, 450000, 545000, 2,  12,  5,  40),
-- Apple
('APL-I14-128',    'iPhone 14 128Go',                   2, 6, 195000, 235000, 285000, 2,   0,  5,  50),
('APL-I14-256',    'iPhone 14 256Go',                   2, 6, 225000, 270000, 325000, 2,   4,  5,  40),
('APL-I15-128',    'iPhone 15 128Go',                   2, 6, 240000, 288000, 349000, 2,  12,  5,  50),
('APL-I15-256',    'iPhone 15 256Go',                   2, 6, 275000, 330000, 399000, 2,   7,  3,  30),
-- Tecno
('TEC-SP20-128',   'Tecno Spark 20 128Go',              3, 5,  36000,  46000,  58000,10, 102, 40, 400),
('TEC-SP20P-128',  'Tecno Spark 20 Pro 128Go',          3, 5,  42000,  53000,  66000,10,  67, 30, 300),
('TEC-CAM20-256',  'Tecno Camon 20 256Go',              3, 5,  58000,  72000,  88000, 5,  52, 20, 200),
('TEC-CAM30-256',  'Tecno Camon 30 256Go',              3, 5,  72000,  88000, 109000, 5,  38, 20, 150),
-- Infinix
('INF-HOT40-128',  'Infinix Hot 40 128Go',              4, 5,  34000,  43000,  54000,10,   7, 30, 350),
('INF-HOT40P-256', 'Infinix Hot 40 Pro 256Go',          4, 5,  48000,  60000,  75000, 5,  44, 20, 200),
('INF-NOTE40-256', 'Infinix Note 40 256Go',             4, 5,  68000,  84000, 102000, 5,  29, 15, 120),
-- Xiaomi
('XIA-RED13C-128', 'Xiaomi Redmi 13C 128Go',            5, 5,  38000,  50000,  62000,10,  88, 25, 300),
('XIA-RED13-256',  'Xiaomi Redmi 13 256Go',             5, 5,  55000,  68000,  85000, 5,  46, 15, 200),
('XIA-NOTE12-256', 'Xiaomi Note 12 256Go',              5, 5,  75000,  92000, 115000, 5,  21, 10, 100),
-- ITEL
('ITE-P40-64',     'ITEL P40 64Go',                     6, 5,  22000,  28000,  36000,10, 160, 50, 500),
('ITE-A70-128',    'ITEL A70 128Go',                    6, 5,  28000,  36000,  46000,10, 124, 40, 400),
-- Reconditionnés
('REC-I12-64',     'iPhone 12 64Go Reconditionné A+',   2, 7, 105000, 130000, 158000, 2,  15,  5,  60),
('REC-SAM-A52',    'Samsung A52 5G Reconditionné',      1, 7,  58000,  72000,  89000, 5,  22, 10, 80),
-- Accessoires — Coques
('ACC-COQUE-UNIV', 'Coque silicone universelle (lot 10)',9, 8,  5500,   7500,   1200, 10, 320, 50, 1000),
('ACC-COQUE-PREM', 'Coque premium renforcée (lot 5)',   9, 8,  8000,  11000,   2800,  5, 180, 30,  500),
-- Chargeurs
('ACC-CHG-65W',    'Chargeur rapide 65W USB-C',         9, 9, 8500,  12000,   2500,  5,  18, 40,  300),
('ACC-CHG-20W',    'Chargeur 20W USB-C (lot 10)',       9, 9, 9000,  13000,   1800, 10, 120, 30,  500),
('ACC-CHG-SOLAR',  'Chargeur solaire portable 10000mAh',9, 9,15000,  22000,  28000,  2,  34, 10,  100),
-- Audio
('ACC-AUD-BT',     'Écouteurs Bluetooth TWS (lot 5)',   9,10,12000,  18000,   4500,  5,  74, 20,  300),
('ACC-AUD-WIRED',  'Écouteurs filaires jack (lot 20)',  9,10, 6000,  10000,    800, 10, 200, 40,  800),
-- Verres trempés
('ACC-VERRE-UNI',  'Verre trempé universel (lot 10)',   9,11, 3500,   5000,    800, 10, 210, 30,  800),
('ACC-VERRE-PRIV', 'Verre confidentialité (lot 5)',     9,11, 6000,   9000,   2200,  5,  85, 15,  300),
-- Câbles
('ACC-CABLE-TYPE', 'Câble USB-C 1m renforcé (lot 20)', 9,12, 8000,  12000,    900, 10, 350, 50, 1000),
('ACC-CABLE-LIGHT','Câble Lightning Apple (lot 10)',    9,12, 9000,  14000,   1800,  5, 140, 30,  400),
-- Batteries
('ACC-BAT-UNIV',   'Batterie externe 20000mAh',        9,13,14000,  20000,  26000,  2,  45, 15,  200),
('ACC-BAT-ULTRA',  'Batterie externe ultra-fine 10000mAh',9,13,10000,16000, 21000,  2,  28, 10,  150);

-- ─── CLIENTS ─────────────────────────────────────────────────

INSERT INTO clients (code, type_client, raison_sociale, contact_nom, telephone, email, adresse, ville, plafond_credit, delai_paiement, note_risque) VALUES
-- Grossistes
('CLI-G001', 'grossiste', 'Ahouman Telecom SARL',     'Ahouman Koffi',   '+225 07 01 23 45', 'contact@ahoumantelecom.ci',   'Zone Industrielle de Yopougon',   'Yopougon',  6000000, 30, 4),
('CLI-G002', 'grossiste', 'Diallo Mobile CI',          'Diallo Seydou',   '+225 05 48 71 20', 'diallo.mobile@gmail.com',     'Marché Adjamé, Bloc C',           'Adjamé',    4000000, 30, 4),
('CLI-G003', 'grossiste', 'GS Phone Bouaké SARL',      'Gnagné Simon',    '+225 01 55 98 44', 'gs.phone@yahoo.fr',           'Quartier Commerce, Bouaké',       'Bouaké',    3000000, 45, 3),
('CLI-G004', 'grossiste', 'CI Phones SARL',            'Coulibaly Inza',  '+225 07 77 12 90', 'ciphonesarl@gmail.com',       'Plateau, Avenue Nogues',          'Plateau',   5000000, 30, 2),
('CLI-G005', 'grossiste', 'TéléZone Yopougon',         'Touré Mariame',   '+225 05 12 36 78', 'telezone.ypg@gmail.com',      'Yopougon Siporex',                'Yopougon',  2500000, 30, 3),
('CLI-G006', 'grossiste', 'Phone Market Adjamé',       'Ouattara Daouda', '+225 07 34 56 89', 'phonemarket.adj@gmail.com',   'Marché Adjamé, Rue 12',           'Adjamé',    2000000, 30, 3),
('CLI-G007', 'grossiste', 'AbidjanTech Distribution',  'N''Goran Brice',  '+225 01 88 45 67', 'abidjantech@gmail.com',       'Zone 4, Boulevard Latrille',      'Zone 4',    4500000, 60, 4),
('CLI-G008', 'grossiste', 'SanPedro Phones Export',   'Bamba Moussa',    '+225 05 66 33 11', 'sppexport@yahoo.fr',           'San-Pédro Port',                  'San-Pédro', 3500000, 45, 3),
-- Détaillants
('CLI-D001', 'detaillant','Boutique Koko Telecom',     'Koné Mariam',     '+225 07 09 87 65', null,                          'Cocody Angré, Rue des Jardins',   'Cocody',    500000,  15, 4),
('CLI-D002', 'detaillant','Phone Shop Koumassi',       'Akissi Bénédicte','+225 05 32 44 78', null,                          'Koumassi, Marché Central',        'Koumassi',  300000,  15, 3),
('CLI-D003', 'detaillant','Yao Électronique',          'Yao Fernand',     '+225 07 56 12 34', 'yao.elec@gmail.com',          'Marcory, Centre Commercial',      'Marcory',   400000,  15, 4),
('CLI-D004', 'detaillant','Treichville Mobile',        'Adou Serge',      '+225 01 23 78 90', null,                          'Treichville, Marché',             'Treichville',200000, 7,  3),
-- Particuliers (retail)
('CLI-P001', 'particulier','Kouassi Aya',              'Kouassi Aya',     '+225 07 41 22 33', null,                          'Cocody',                          'Cocody',         0,  0, 5),
('CLI-P002', 'particulier','Koné Ibrahim',             'Koné Ibrahim',    '+225 05 87 65 43', null,                          'Yopougon',                        'Yopougon',        0,  0, 5),
('CLI-P003', 'particulier','Traoré Oumar',             'Traoré Oumar',    '+225 01 76 54 32', null,                          'Adjamé',                          'Adjamé',          0,  0, 5),
('CLI-P004', 'particulier','Konan Séverin',            'Konan Séverin',   '+225 07 99 11 22', null,                          'Plateau',                         'Plateau',         0,  0, 2);

-- ─── FOURNISSEURS ─────────────────────────────────────────────

INSERT INTO fournisseurs (code, raison_sociale, contact_nom, telephone, email, pays, delai_paiement) VALUES
('FRS-001', 'Samsung Electronics CI / Dist. Officiel', 'Park Jae-won',     '+225 20 20 15 00', 'b2b@samsung.ci',          'Côte d''Ivoire',  60),
('FRS-002', 'Tecno Mobile Côte d''Ivoire',             'Chen Wei',          '+225 27 24 80 00', 'trade@tecno-mobile.ci',   'Côte d''Ivoire',  45),
('FRS-003', 'Apple Premium Reseller Abidjan',          'Mbeki François',    '+225 20 31 45 67', 'pro@applersl-abi.ci',     'Côte d''Ivoire',  30),
('FRS-004', 'Infinix Mobility Abidjan',                'Liu Xiang',         '+225 27 55 33 00', 'sales@infinix-ci.com',    'Côte d''Ivoire',  45),
('FRS-005', 'Xiaomi Distributeur Officiel CI',         'Wang Fang',         '+225 27 66 88 00', 'ci@xiaomi-distrib.com',   'Côte d''Ivoire',  45),
('FRS-006', 'ITEL Afrique Distribution',               'Ouédraogo Paul',    '+225 20 22 44 00', 'itel.afrique@gmail.com',  'Burkina Faso',    30),
('FRS-007', 'AccessPro CI (accessoires)',              'Touré Lacina',      '+225 07 88 99 00', 'accesspro@gmail.com',     'Côte d''Ivoire',  30),
('FRS-008', 'Hong Kong Mobile Imports',                'Wong Siu-Kei',      '+852 9123 4567',   'sales@hkmobile.hk',       'Hong Kong',       60);

-- ─── VENTES (historique 3 mois) ──────────────────────────────

-- Ventes gros — Janvier 2026
INSERT INTO ventes (numero, client_id, type_vente, date_vente, date_echeance, sous_total, tva_pct, tva_montant, total_ttc, montant_paye, solde_restant, statut_paiement, moyen_paiement_id) VALUES
('VTE-1001', 1, 'gros', '2026-01-05', '2026-02-04', 5423729, 18, 976271, 6400000, 6400000, 0, 'paye',     5),
('VTE-1002', 2, 'gros', '2026-01-08', '2026-02-07', 1694915, 18, 305085, 2000000, 2000000, 0, 'paye',     1),
('VTE-1003', 3, 'gros', '2026-01-12', '2026-02-26', 2118644, 18, 381356, 2500000, 2500000, 0, 'paye',     5),
('VTE-1004', 7, 'gros', '2026-01-15', '2026-02-14', 3389831, 18, 610169, 4000000, 4000000, 0, 'paye',     5),
('VTE-1005', 5, 'gros', '2026-01-20', '2026-02-19', 1271186, 18, 228814, 1500000, 1500000, 0, 'paye',     2),
-- Ventes détail — Janvier
('VTE-1006', 13,'detail','2026-01-07', null,          288136, 18,  51864,  340000,  340000, 0, 'paye',    1),
('VTE-1007', 14,'detail','2026-01-14', null,          110169, 18,  19831,  130000,  130000, 0, 'paye',    2),
('VTE-1008', 15,'detail','2026-01-21', null,          389831, 18,  70169,  460000,  460000, 0, 'paye',    7),
-- Ventes gros — Février 2026
('VTE-1020', 1, 'gros', '2026-02-03', '2026-03-05', 4576271, 18, 823729, 5400000, 5400000, 0, 'paye',    5),
('VTE-1021', 4, 'gros', '2026-02-06', '2026-03-08', 3728814, 18, 671186, 4400000, 4400000, 0, 'paye',    5),
('VTE-1022', 2, 'gros', '2026-02-10', '2026-03-12', 1694915, 18, 305085, 2000000, 2000000, 0, 'paye',    1),
('VTE-1023', 6, 'gros', '2026-02-14', '2026-03-16', 1186441, 18, 213559, 1400000, 1400000, 0, 'paye',    2),
('VTE-1024', 8, 'gros', '2026-02-20', '2026-04-05', 2966102, 18, 533898, 3500000, 1750000, 1750000,'partiel',5),
-- Ventes détail — Février
('VTE-1025', 13,'detail','2026-02-11', null,          296610, 18,  53390,  350000,  350000, 0, 'paye',    1),
('VTE-1026', 15,'detail','2026-02-18', null,          194915, 18,  35085,  230000,  230000, 0, 'paye',    2),
-- Ventes gros — Mars 2026
('VTE-1060', 4, 'gros', '2026-03-01', '2026-04-01', 4661017, 18, 838983, 5500000,  550000, 4950000,'en_retard',8),
('VTE-1061', 1, 'gros', '2026-03-05', '2026-04-04', 5084746, 18, 915254, 6000000, 6000000, 0, 'paye',    5),
('VTE-1062', 7, 'gros', '2026-03-08', '2026-04-07', 3728814, 18, 671186, 4400000, 4400000, 0, 'paye',    5),
('VTE-1063', 6, 'gros', '2026-03-15', '2026-04-02', 1186441, 18, 213559, 1400000,  840000,  560000,'en_retard',2),
('VTE-1064', 5, 'gros', '2026-03-18', '2026-05-01', 1864407, 18, 335593, 2200000, 2200000, 0, 'paye',    5),
('VTE-1065', 3, 'gros', '2026-03-22', '2026-05-05', 2542373, 18, 457627, 3000000, 3000000, 0, 'paye',    5),
-- Ventes détail — Mars
('VTE-1066', 13,'detail','2026-03-10', null,          338983, 18,  61017,  400000,  400000, 0, 'paye',    1),
('VTE-1067', 15,'detail','2026-03-25', null,          423729, 18,  76271,  500000,  500000, 0, 'paye',    7),
('VTE-1068', 16,'detail','2026-03-28', '2026-04-15',  677966, 18, 122034,  800000,  400000,  400000,'en_retard',8),
-- Ventes gros — Avril 2026
('VTE-1100', 1, 'gros', '2026-04-01', '2026-05-01', 2881356, 18, 518644, 3400000, 3400000, 0, 'paye',    5),
('VTE-1101', 4, 'gros', '2026-04-03', '2026-05-03', 3728814, 18, 671186, 4400000,       0, 4400000,'non_paye',8),
('VTE-1102', 2, 'gros', '2026-04-05', '2026-05-05', 2372881, 18, 427119, 2800000, 2800000, 0, 'paye',    1),
('VTE-1103', 7, 'gros', '2026-04-07', '2026-06-06', 3389831, 18, 610169, 4000000,       0, 4000000,'non_paye',8),
('VTE-1104', 3, 'gros', '2026-04-09', '2026-05-24', 1271186, 18, 228814, 1500000, 1500000, 0, 'paye',    5),
('VTE-1105', 8, 'gros', '2026-04-10', '2026-05-10', 2542373, 18, 457627, 3000000,       0, 3000000,'non_paye',8),
-- Ventes détail — Avril
('VTE-1106', 13,'detail','2026-04-02', null,          194915, 18,  35085,  230000,  230000, 0, 'paye',    1),
('VTE-1107', 14,'detail','2026-04-04', null,           74576, 18,  13424,   88000,   88000, 0, 'paye',    2),
('VTE-1108', 13,'detail','2026-04-06', null,          296610, 18,  53390,  350000,  350000, 0, 'paye',    7),
('VTE-1109', 15,'detail','2026-04-08', null,          338983, 18,  61017,  400000,  400000, 0, 'paye',    2),
('VTE-1110', 16,'detail','2026-04-10', null,           49153, 18,   8847,   58000,   58000, 0, 'paye',    1),
('VTE-1111', 14,'detail','2026-04-11', null,          296610, 18,  53390,  350000,  350000, 0, 'paye',    2);

-- Lignes de vente (exemples clés)
INSERT INTO ventes_lignes (vente_id, produit_id, quantite, prix_unitaire, total_ligne) VALUES
-- VTE-1100 : Ahouman — 50x A15 gros
(25, 1, 50, 65000, 3250000),
-- VTE-1101 : CI Phones — 30x A55 + 10x iPhone15 gros
(26, 4, 30, 138000, 4140000),
-- VTE-1102 : Diallo — 50x Xiaomi 13C + access gros
(27, 17, 50, 50000, 2500000),
(27, 24, 10, 7500,    75000),
-- VTE-1103 : AbidjanTech — mix gros
(28, 10, 40, 46000, 1840000),
(28, 11, 20, 53000, 1060000),
(28, 17, 20, 50000, 1000000),
-- VTE-1107 : Retail Tecno
(32, 11, 1, 66000, 66000),
-- VTE-1109 : Retail Samsung A15
(34, 1, 1, 79000, 79000),
(34, 24, 5, 1200,  6000),
-- VTE-1110 : Retail Spark 20
(35, 10, 1, 58000, 58000),
-- VTE-1111 : Retail multi-articles
(36, 26, 2, 2500, 5000),
(36, 31, 3, 800,  2400),
(36, 29, 1, 4500, 4500);

-- ─── ACHATS FOURNISSEURS ─────────────────────────────────────

INSERT INTO achats (numero, fournisseur_id, date_achat, date_echeance, total_ht, tva_montant, total_ttc, montant_paye, solde_restant, statut_paiement, reference_frs) VALUES
-- Achats payés — historique
('ACH-2001', 1, '2026-01-10', '2026-03-11', 11525424, 2074576, 13600000, 13600000, 0, 'paye',    'SAM-ORD-2601'),
('ACH-2002', 2, '2026-01-15', '2026-02-28', 7932203,  1427797,  9360000,  9360000, 0, 'paye',    'TEC-PO-2601'),
('ACH-2003', 6, '2026-01-20', '2026-02-20', 2457627,   442373,  2900000,  2900000, 0, 'paye',    'ITEL-2601'),
('ACH-2004', 7, '2026-02-05', '2026-03-07', 1779661,   320339,  2100000,  2100000, 0, 'paye',    'APRO-2602'),
('ACH-2005', 1, '2026-02-15', '2026-04-16', 11525424, 2074576, 13600000,  6800000, 6800000,'partiel','SAM-ORD-2602'),
('ACH-2006', 2, '2026-03-01', '2026-04-15', 7932203,  1427797,  9360000,  7020000, 2340000,'partiel','TEC-PO-2602'),
('ACH-2007', 3, '2026-03-10', '2026-04-20', 4915254,   884746,  5800000,  4060000, 1740000,'partiel','APL-RSL-2603'),
('ACH-2008', 4, '2026-03-20', '2026-04-25', 3050847,   549153,  3600000,  1800000, 1800000,'partiel','INF-2603'),
('ACH-2009', 5, '2026-04-01', '2026-05-08', 5288136,   951864,  6240000,        0, 6240000,'non_paye','XIAO-2604'),
('ACH-2010', 7, '2026-04-03', '2026-05-05', 1779661,   320339,  2100000,        0, 2100000,'non_paye','APRO-2604'),
('ACH-2011', 6, '2026-04-08', '2026-05-08', 2457627,   442373,  2900000,        0, 2900000,'non_paye','ITEL-2604');

-- Lignes d'achats
INSERT INTO achats_lignes (achat_id, produit_id, quantite, prix_unitaire, total_ligne) VALUES
(5, 1, 100, 52000, 5200000), (5, 2, 50, 70000, 3500000), (5, 4, 30, 115000, 3450000), (5, 5, 5, 380000, 1900000),
(6, 10, 100, 36000, 3600000),(6, 11, 60, 42000, 2520000),(6, 12, 50, 58000, 2900000),
(7, 8, 10, 240000, 2400000),(7, 9, 8, 275000, 2200000),(7, 7, 5, 225000, 1125000),
(9, 17, 120, 38000, 4560000),(9, 18, 30, 55000, 1650000),
(10, 24, 300, 5500, 1650000),(10, 27, 50, 9000,  450000),
(11, 20, 150, 22000, 3300000),(11, 21, 80, 28000, 2240000);

-- ─── PAIEMENTS (règlements) ──────────────────────────────────

INSERT INTO paiements (type_paiement, vente_id, client_id, montant, date_paiement, moyen_paiement_id, reference) VALUES
-- Règlement partiel VTE-1024 (SanPedro)
('encaissement', 14, 8, 1750000, '2026-02-20', 5, 'VIR-2602-001'),
-- Règlement partiel VTE-1060 (CI Phones en retard)
('encaissement', 16, 4, 550000, '2026-03-10', 1, null),
-- Règlement partiel VTE-1063 (TéléZone en retard)
('encaissement', 19, 5, 840000, '2026-03-20', 2, 'OM-2603-774'),
-- Acompte VTE-1068 (Konan Séverin)
('encaissement', 25, 16, 400000, '2026-03-29', 1, null);

INSERT INTO paiements (type_paiement, achat_id, fournisseur_id, montant, date_paiement, moyen_paiement_id, reference) VALUES
-- 1er acompte Samsung ACH-2005
('decaissement', 5, 1, 6800000, '2026-02-15', 5, 'VIR-SAM-0215'),
-- Règlement partiel Tecno ACH-2006
('decaissement', 6, 2, 7020000, '2026-03-05', 5, 'VIR-TEC-0305'),
-- Règlement partiel Apple ACH-2007
('decaissement', 7, 3, 4060000, '2026-03-12', 5, 'VIR-APL-0312'),
-- Acompte Infinix ACH-2008
('decaissement', 8, 4, 1800000, '2026-03-25', 5, 'VIR-INF-0325');

-- ─── MOUVEMENTS STOCK (cohérence) ────────────────────────────

INSERT INTO mouvements_stock (produit_id, type, quantite, motif, ref_doc) VALUES
(1,  'entree',  200, 'Réception commande fournisseur', 'ACH-2001'),
(2,  'entree',  100, 'Réception commande fournisseur', 'ACH-2001'),
(4,  'entree',   50, 'Réception commande fournisseur', 'ACH-2001'),
(10, 'entree',  100, 'Réception Tecno', 'ACH-2002'),
(11, 'entree',   80, 'Réception Tecno', 'ACH-2002'),
(17, 'entree',  120, 'Réception Xiaomi', 'ACH-2009'),
(14, 'ajustement', -5, 'Produit défectueux retourné', null),
(7,  'entree',   10, 'Réception Apple RSL', 'ACH-2007');
