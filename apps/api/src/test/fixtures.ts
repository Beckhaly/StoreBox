import jwt        from 'jsonwebtoken';
import supertest  from 'supertest';
import app        from '../index';

const JWT_SECRET = process.env.JWT_SECRET!;
export const request = supertest(app);

// Génère un token JWT valide + session en DB pour les tests
export async function makeToken(overrides: {
  sub?:         number;
  role?:        string;
  perms?:       object;
  magasin_ids?: number[];
} = {}) {
  const { pool } = await import('../lib/db');

  const sub         = overrides.sub         ?? 1;  // admin seed = id 1
  const role        = overrides.role        ?? 'admin';
  const perms       = overrides.perms       ?? { all: true };
  const magasin_ids = overrides.magasin_ids ?? [];
  const jti         = `test-jti-${Date.now()}-${Math.random()}`;

  const token = jwt.sign(
    { sub, email: 'test@telepro.ci', nom: 'Test', prenom: 'User', role, perms, magasin_ids, jti },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  // Enregistrer la session pour que requireAuth l'accepte
  await pool.query(
    `INSERT INTO sessions (user_id, token_jti, expires_at, ip_address, user_agent)
     VALUES ($1, $2, NOW() + INTERVAL '8 hours', '127.0.0.1', 'vitest')`,
    [sub, jti]
  );

  return token;
}

// Raccourci : header Authorization prêt à l'emploi
export async function authHeader(overrides = {}) {
  const token = await makeToken(overrides);
  return { Authorization: `Bearer ${token}` };
}
