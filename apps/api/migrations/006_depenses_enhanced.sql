-- Migration: dépenses améliorées — récurrence
-- Ajoute le support des dépenses récurrentes

ALTER TABLE paiements ADD COLUMN IF NOT EXISTS recurrence VARCHAR(20)
  CHECK (recurrence IS NULL OR recurrence IN ('mensuelle','trimestrielle','annuelle'));
