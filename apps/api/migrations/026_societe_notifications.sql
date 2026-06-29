-- ═══════════════════════════════════════════════════════════════════
-- Migration 026 — Paramètres d'envoi SMS / WhatsApp dans la société
-- Permet de gérer les identifiants des fournisseurs (Twilio, Orange CI,
-- Infobip) depuis l'interface, au lieu des seules variables d'env.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE societe_parametres
  -- Activation + choix des fournisseurs
  ADD COLUMN IF NOT EXISTS sms_actif        BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS wa_actif         BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS sms_provider     VARCHAR(20),   -- twilio | orange_ci | infobip
  ADD COLUMN IF NOT EXISTS wa_provider      VARCHAR(20),   -- twilio | infobip
  ADD COLUMN IF NOT EXISTS gerant_tel       VARCHAR(20),   -- destinataire des alertes internes
  -- Twilio
  ADD COLUMN IF NOT EXISTS twilio_account_sid VARCHAR(64),
  ADD COLUMN IF NOT EXISTS twilio_auth_token  VARCHAR(64),
  ADD COLUMN IF NOT EXISTS twilio_from        VARCHAR(32),
  ADD COLUMN IF NOT EXISTS twilio_wa_from     VARCHAR(32),
  -- Orange CI
  ADD COLUMN IF NOT EXISTS orange_sms_api_key VARCHAR(255),
  ADD COLUMN IF NOT EXISTS orange_sender      VARCHAR(32),
  -- Infobip
  ADD COLUMN IF NOT EXISTS infobip_api_key    VARCHAR(255),
  ADD COLUMN IF NOT EXISTS infobip_base_url   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS infobip_from       VARCHAR(32),
  ADD COLUMN IF NOT EXISTS infobip_wa_from    VARCHAR(32);
