-- Migration: données enrichies de dépenses
-- Ajoute des jeux de données d'exemple pour les dépenses

-- Données supplémentaires de dépenses (avril 2026)
INSERT INTO paiements (type_paiement, montant, date_paiement, categorie_depense, notes, moyen_paiement_id, recurrence)
VALUES
  -- Avril 2026
  ('depense', 45000, '2026-04-10', 'Entretien & réparations', 'Maintenance climatisation', 1, NULL),
  ('depense', 18000, '2026-04-12', 'Fournitures de bureau', 'Stock de sachets plastiques', 1, NULL),
  ('depense', 65000, '2026-04-14', 'Transport & livraison', 'Essence + carburant véhicules', 1, 'mensuelle'),
  ('depense', 32000, '2026-04-15', 'Frais bancaires', 'Frais transaction + commission', 2, NULL),
  ('depense', 125000, '2026-04-20', 'Marketing & publicité', 'Annonce Facebook + Google Ads', 1, NULL),
  ('depense', 22000, '2026-04-22', 'Télécom & internet', 'Abonnement décodeur + forfait', 2, NULL),
  ('depense', 88000, '2026-04-25', 'Impôts & taxes', 'Taxe professionnelle avril', 2, NULL),
  ('depense', 15000, '2026-04-28', 'Divers', 'Nettoyage local + produits', 1, NULL),
  
  -- Mars 2026 (données historiques)
  ('depense', 350000, '2026-03-01', 'Loyer & charges', 'Loyer local principal mars 2026', 1, 'mensuelle'),
  ('depense', 52000, '2026-03-05', 'Transport & livraison', 'Livraison commande Apple février', 1, NULL),
  ('depense', 1200000, '2026-03-01', 'Salaires & charges sociales', 'Salaires équipe mars', 2, 'mensuelle'),
  ('depense', 38000, '2026-03-08', 'Fournitures de bureau', 'Papier A4 + cartouches', 1, NULL),
  ('depense', 95000, '2026-03-12', 'Marketing & publicité', 'Bandeaux boutique + brochures', 1, NULL),
  ('depense', 19000, '2026-03-14', 'Frais bancaires', 'Frais tenue compte', 2, NULL),
  ('depense', 61000, '2026-03-18', 'Entretien & réparations', 'Réparation caisse enregistreuse', 1, NULL),
  ('depense', 27000, '2026-03-20', 'Télécom & internet', 'Connexion internet + téléphonie', 2, NULL),
  
  -- Février 2026
  ('depense', 350000, '2026-02-01', 'Loyer & charges', 'Loyer local principal février 2026', 1, 'mensuelle'),
  ('depense', 1200000, '2026-02-01', 'Salaires & charges sociales', 'Salaires équipe février', 2, 'mensuelle'),
  ('depense', 71000, '2026-02-06', 'Transport & livraison', 'Livraison stocks février', 1, NULL),
  ('depense', 42000, '2026-02-10', 'Fournitures de bureau', 'Étiquettes + emballages', 1, NULL),
  ('depense', 108000, '2026-02-12', 'Marketing & publicité', 'Spots radio + affichage', 1, NULL),
  ('depense', 16000, '2026-02-14', 'Frais bancaires', 'Frais de compte février', 2, NULL),
  ('depense', 73000, '2026-02-17', 'Impôts & taxes', 'Paiement à-compte IR février', 2, NULL),
  
  -- Janvier 2026
  ('depense', 350000, '2026-01-01', 'Loyer & charges', 'Loyer local principal janvier 2026', 1, 'mensuelle'),
  ('depense', 1200000, '2026-01-01', 'Salaires & charges sociales', 'Salaires équipe janvier', 2, 'mensuelle'),
  ('depense', 58000, '2026-01-05', 'Transport & livraison', 'Livraison stocks janvier', 1, NULL),
  ('depense', 35000, '2026-01-08', 'Fournitures de bureau', 'Papier de caisse + cartons', 1, NULL),
  ('depense', 118000, '2026-01-15', 'Marketing & publicité', 'Campagne nouvel an', 1, NULL),
  ('depense', 21000, '2026-01-18', 'Frais bancaires', 'Frais tenue de compte janvier', 2, NULL),
  ('depense', 85000, '2026-01-20', 'Entretien & réparations', 'Révision équipement de caisse', 1, NULL),
  ('depense', 28500, '2026-01-25', 'Télécom & internet', 'Abonnement internet', 2, NULL),
  ('depense', 12000, '2026-01-28', 'Divers', 'Formation sécurité équipe', 1, NULL);

-- Ajouter des dépenses avec récurrence
UPDATE paiements 
SET recurrence = 'mensuelle' 
WHERE type_paiement = 'depense' 
  AND categorie_depense IN ('Loyer & charges', 'Salaires & charges sociales')
  AND recurrence IS NULL;
