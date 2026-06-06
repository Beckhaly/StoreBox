-- ============================================================
-- TéléPro CI — Log notifications SMS/WhatsApp
-- ============================================================

CREATE TABLE notifications_log (
  id           SERIAL PRIMARY KEY,
  type         VARCHAR(50) NOT NULL,
  canal        VARCHAR(20) NOT NULL CHECK (canal IN ('sms','whatsapp','email')),
  destinataire VARCHAR(30) NOT NULL,
  message      TEXT NOT NULL,
  statut       VARCHAR(20) DEFAULT 'envoye' CHECK (statut IN ('envoye','echec','en_attente')),
  ref_doc      VARCHAR(50),
  provider     VARCHAR(30),
  provider_id  VARCHAR(100),
  error_msg    TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notif_type    ON notifications_log(type, created_at);
CREATE INDEX idx_notif_dest    ON notifications_log(destinataire);
CREATE INDEX idx_notif_refdoc  ON notifications_log(ref_doc);
