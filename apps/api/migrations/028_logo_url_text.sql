-- Migration 028 : logo_url en TEXT (la valeur base64 dépasse VARCHAR(500))
ALTER TABLE societe_parametres ALTER COLUMN logo_url TYPE TEXT;
