-- ═══════════════════════════════════════════════════════════════════
-- Seed 022 — Jeu de donnees TEST : Fruits & Legumes
-- Demontre le module produits universel : vente au poids (kg),
-- prix variable a la caisse, peremption + lots (FIFO).
-- Idempotent (ON CONFLICT). NE PAS inclure dans les tests d'integration.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Categories ─────────────────────────────────────────────────
INSERT INTO categories (code, libelle) VALUES
  ('FRUITS',  'Fruits'),
  ('LEGUMES', 'Legumes')
ON CONFLICT (code) DO NOTHING;

-- ── 2. Donnees produits (prix FCFA / unite ; stock par magasin) ───
-- poids=true  -> vendu au kg, prix modifiable a la caisse (pesee)
-- poids=false -> vendu a la piece, prix fixe
-- dlc_jours   -> jours avant peremption du lot seede (NULL = pas de lot)
WITH data(ref, designation, cat, unite, achat, gros, detail, poids, stock1, stock2, dlc_jours) AS (
  VALUES
    -- Fruits au kg
    ('FL-MANGUE',   'Mangue Kent',          'FRUITS',  'kg',  300,  600,  800, true,  40, 25,  7),
    ('FL-BANANE',   'Banane douce',         'FRUITS',  'kg',  200,  350,  500, true,  60, 30,  5),
    ('FL-ORANGE',   'Orange de table',      'FRUITS',  'kg',  150,  300,  400, true,  50, 20, 10),
    ('FL-CITRON',   'Citron vert',          'FRUITS',  'kg',  250,  500,  700, true,  20, 10, 12),
    ('FL-PAPAYE',   'Papaye solo',          'FRUITS',  'kg',  200,  400,  550, true,  30, 15,  6),
    ('FL-AVOCAT',   'Avocat',               'FRUITS',  'kg',  500,  900, 1200, true,  18, 12,  5),
    -- Fruits a la piece
    ('FL-ANANAS',   'Ananas (piece)',       'FRUITS',  'pcs', 400,  700, 1000, false, 45, 20,  8),
    ('FL-PASTEQUE', 'Pasteque (piece)',     'FRUITS',  'pcs', 800, 1300, 1800, false, 25, 12,  9),
    -- Legumes au kg
    ('FL-TOMATE',   'Tomate fraiche',       'LEGUMES', 'kg',  300,  600,  900, true,  35, 20,  4),
    ('FL-OIGNON',   'Oignon violet',        'LEGUMES', 'kg',  250,  500,  700, true,  80, 40, 21),
    ('FL-POMTERRE', 'Pomme de terre',       'LEGUMES', 'kg',  350,  600,  800, true, 100, 50, 30),
    ('FL-CAROTTE',  'Carotte',              'LEGUMES', 'kg',  300,  550,  750, true,  40, 20, 14),
    ('FL-AUBERG',   'Aubergine',            'LEGUMES', 'kg',  200,  400,  600, true,  25, 15,  7),
    ('FL-PIMENT',   'Piment frais',         'LEGUMES', 'kg',  500, 1000, 1500, true,  12,  8,  6),
    ('FL-GOMBO',    'Gombo',                'LEGUMES', 'kg',  400,  700, 1000, true,  20, 10,  5),
    -- Legumes a la piece
    ('FL-CHOU',     'Chou pomme (piece)',   'LEGUMES', 'pcs', 300,  500,  700, false, 30, 18, 12),
    ('FL-SALADE',   'Salade laitue (piece)','LEGUMES', 'pcs', 200,  350,  500, false, 40, 22,  4)
)

-- ── 3. Produits ───────────────────────────────────────────────────
, ins_prod AS (
  INSERT INTO produits (
    reference, designation, categorie_id, marque_id,
    prix_achat, prix_gros, prix_detail,
    unite_id, vendu_au_poids, prix_modifiable, gere_peremption, gere_lot,
    stock, stock_alerte, stock_max, actif
  )
  SELECT
    d.ref, d.designation, c.id, NULL,
    d.achat, d.gros, d.detail,
    u.id, d.poids, d.poids, TRUE, TRUE,
    0, 5, 1000, TRUE
  FROM data d
  JOIN categories    c ON c.code = d.cat
  JOIN unites_mesure u ON u.code = d.unite
  ON CONFLICT (reference) DO NOTHING
  RETURNING id, reference
)
SELECT 1;

-- ── 4. Stocks par magasin ─────────────────────────────────────────
WITH data(ref, stock1, stock2) AS (
  VALUES
    ('FL-MANGUE',40,25),('FL-BANANE',60,30),('FL-ORANGE',50,20),('FL-CITRON',20,10),
    ('FL-PAPAYE',30,15),('FL-AVOCAT',18,12),('FL-ANANAS',45,20),('FL-PASTEQUE',25,12),
    ('FL-TOMATE',35,20),('FL-OIGNON',80,40),('FL-POMTERRE',100,50),('FL-CAROTTE',40,20),
    ('FL-AUBERG',25,15),('FL-PIMENT',12,8),('FL-GOMBO',20,10),('FL-CHOU',30,18),('FL-SALADE',40,22)
)
INSERT INTO stocks (produit_id, magasin_id, quantite, stock_alerte)
SELECT p.id, m.magasin_id, m.qte, 5
FROM data d
JOIN produits p ON p.reference = d.ref
CROSS JOIN LATERAL (VALUES (1, d.stock1), (2, d.stock2)) AS m(magasin_id, qte)
ON CONFLICT (produit_id, magasin_id)
DO UPDATE SET quantite = EXCLUDED.quantite;

-- Aligner produits.stock (heritage) sur le stock du magasin principal
UPDATE produits p SET stock = s.quantite
FROM stocks s
WHERE s.produit_id = p.id AND s.magasin_id = 1 AND p.reference LIKE 'FL-%';

-- ── 5. Lots avec peremption (magasin principal, FIFO) ─────────────
WITH data(ref, stock1, dlc_jours, achat) AS (
  VALUES
    ('FL-MANGUE',40,7,300),('FL-BANANE',60,5,200),('FL-ORANGE',50,10,150),('FL-CITRON',20,12,250),
    ('FL-PAPAYE',30,6,200),('FL-AVOCAT',18,5,500),('FL-ANANAS',45,8,400),('FL-PASTEQUE',25,9,800),
    ('FL-TOMATE',35,4,300),('FL-OIGNON',80,21,250),('FL-POMTERRE',100,30,350),('FL-CAROTTE',40,14,300),
    ('FL-AUBERG',25,7,200),('FL-PIMENT',12,6,500),('FL-GOMBO',20,5,400),('FL-CHOU',30,12,300),('FL-SALADE',40,4,200)
)
INSERT INTO lots (produit_id, magasin_id, numero_lot, date_entree, date_peremption, quantite, prix_achat)
SELECT p.id, 1, 'LOT-' || d.ref, CURRENT_DATE, CURRENT_DATE + (d.dlc_jours || ' days')::interval, d.stock1, d.achat
FROM data d
JOIN produits p ON p.reference = d.ref
WHERE NOT EXISTS (
  SELECT 1 FROM lots l WHERE l.produit_id = p.id AND l.numero_lot = 'LOT-' || d.ref
);
