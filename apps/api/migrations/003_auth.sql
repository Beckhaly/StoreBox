-- ============================================================
-- StoreBox — Authentification & Rôles
-- ============================================================

-- ─── RÔLES ───────────────────────────────────────────────────
CREATE TABLE roles (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(30) UNIQUE NOT NULL,
  libelle     VARCHAR(80) NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{}'
);

INSERT INTO roles (code, libelle, permissions) VALUES
('admin',       'Administrateur',    '{"all": true}'),
('commercial',  'Commercial',        '{"ventes": true, "clients": true, "produits": "read", "dashboard": true}'),
('caissier',    'Caissier',          '{"ventes": true, "paiements": true, "dashboard": "read"}'),
('comptable',   'Comptable',         '{"creances": true, "dettes": true, "rapports": true, "paiements": true}'),
('magasinier',  'Magasinier',        '{"produits": true, "stock": true}');

-- ─── UTILISATEURS ────────────────────────────────────────────
CREATE TABLE utilisateurs (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(20) UNIQUE NOT NULL,
  nom             VARCHAR(100) NOT NULL,
  prenom          VARCHAR(100),
  email           VARCHAR(150) UNIQUE NOT NULL,
  telephone       VARCHAR(30),
  password_hash   VARCHAR(255) NOT NULL,
  role_id         INT NOT NULL REFERENCES roles(id),
  actif           BOOLEAN DEFAULT TRUE,
  derniere_cnx    TIMESTAMPTZ,
  tentatives_echec INT DEFAULT 0,
  bloque_jusqu    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SESSIONS JWT (révocation) ────────────────────────────────
CREATE TABLE sessions (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES utilisateurs(id),
  token_jti   VARCHAR(100) UNIQUE NOT NULL,  -- JWT ID pour révocation
  ip_address  VARCHAR(45),
  user_agent  TEXT,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_jti ON sessions(token_jti);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- ─── LOG D'ACTIVITÉ ──────────────────────────────────────────
CREATE TABLE audit_logs (
  id          SERIAL PRIMARY KEY,
  user_id     INT REFERENCES utilisateurs(id),
  action      VARCHAR(100) NOT NULL,
  resource    VARCHAR(50),
  resource_id INT,
  details     JSONB,
  ip_address  VARCHAR(45),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at);

-- ─── COMPTES DÉMO (password: Storebox@123) ──────────────────
-- Les hash bcrypt sont pré-calculés pour "Storebox@123"
INSERT INTO utilisateurs (code, nom, prenom, email, telephone, password_hash, role_id) VALUES
('USR-001', 'Koné',    'Amadou',   'admin@storebox.app',      '+225 07 00 00 01', '$2b$10$AbWmryQEkgfcRDnCoEigDu2hTLxZYiFmQ/wZNnqwNqQtuR7chPeKq', 1),
('USR-002', 'Diallo',  'Fatoumata','commercial@storebox.app', '+225 07 00 00 02', '$2b$10$AbWmryQEkgfcRDnCoEigDu2hTLxZYiFmQ/wZNnqwNqQtuR7chPeKq', 2),
('USR-003', 'Yao',     'Brice',    'caisse@storebox.app',     '+225 07 00 00 03', '$2b$10$AbWmryQEkgfcRDnCoEigDu2hTLxZYiFmQ/wZNnqwNqQtuR7chPeKq', 3),
('USR-004', 'Ouattara','Mariam',   'compta@storebox.app',     '+225 07 00 00 04', '$2b$10$AbWmryQEkgfcRDnCoEigDu2hTLxZYiFmQ/wZNnqwNqQtuR7chPeKq', 4),
('USR-005', 'Gbagbo',  'Serge',    'stock@storebox.app',      '+225 07 00 00 05', '$2b$10$AbWmryQEkgfcRDnCoEigDu2hTLxZYiFmQ/wZNnqwNqQtuR7chPeKq', 5);

-- Fonction de mise à jour updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_utilisateurs_updated
BEFORE UPDATE ON utilisateurs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
