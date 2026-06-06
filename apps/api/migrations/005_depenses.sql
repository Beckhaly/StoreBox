-- Migration: support des dépenses
-- Ajoute le type 'depense' aux paiements + colonnes catégorie

-- Élargir le CHECK constraint pour accepter 'depense'
ALTER TABLE paiements DROP CONSTRAINT IF EXISTS paiements_type_paiement_check;
ALTER TABLE paiements ADD CONSTRAINT paiements_type_paiement_check
  CHECK (type_paiement IN ('encaissement','decaissement','depense'));

-- Catégorie de dépense (loyer, transport, salaires, etc.)
ALTER TABLE paiements ADD COLUMN IF NOT EXISTS categorie_depense VARCHAR(50);

-- Table des catégories de dépenses (référentiel)
CREATE TABLE IF NOT EXISTS categories_depenses (
  id       SERIAL PRIMARY KEY,
  libelle  VARCHAR(60) NOT NULL UNIQUE,
  actif    BOOLEAN DEFAULT TRUE
);

INSERT INTO categories_depenses (libelle) VALUES
  ('Loyer & charges'),
  ('Transport & livraison'),
  ('Salaires & charges sociales'),
  ('Fournitures de bureau'),
  ('Télécom & internet'),
  ('Marketing & publicité'),
  ('Entretien & réparations'),
  ('Impôts & taxes'),
  ('Frais bancaires'),
  ('Divers')
ON CONFLICT (libelle) DO NOTHING;

-- Quelques dépenses de démo
INSERT INTO paiements (type_paiement, montant, date_paiement, categorie_depense, notes, moyen_paiement_id)
VALUES
  ('depense', 350000, '2026-04-01', 'Loyer & charges', 'Loyer local principal avril 2026', 1),
  ('depense', 75000, '2026-04-03', 'Transport & livraison', 'Livraison commande Samsung mars', 1),
  ('depense', 45000, '2026-04-05', 'Télécom & internet', 'Abonnement internet + forfaits', 1),
  ('depense', 1200000, '2026-04-01', 'Salaires & charges sociales', 'Salaires équipe avril', 2),
  ('depense', 25000, '2026-04-08', 'Fournitures de bureau', 'Papier, toner imprimante', 1),
  ('depense', 15000, '2026-03-28', 'Frais bancaires', 'Frais tenue de compte mars', 2),
  ('depense', 80000, '2026-03-15', 'Marketing & publicité', 'Flyers promo Ramadan', 1),
  ('depense', 120000, '2026-03-01', 'Loyer & charges', 'Loyer local principal mars 2026', 1);
