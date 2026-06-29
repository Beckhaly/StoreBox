import { describe, it, expect, beforeAll } from 'vitest';
import { request, makeToken }             from '../../test/fixtures';
import { pool }                           from '../../lib/db';

const ADMIN_EMAIL = 'admin@storebox.app';
const ADMIN_PASS  = 'Storebox@123';

// ── Login ─────────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  it('retourne token + user avec magasin_ids sur credentials valides', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASS });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.email).toBe(ADMIN_EMAIL);
    expect(Array.isArray(res.body.data.user.magasin_ids)).toBe(true);
    expect(Array.isArray(res.body.data.user.magasin_noms)).toBe(true);
  });

  it('échoue sur mauvais mot de passe (401)', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: 'mauvais' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('échoue sur email inconnu (401)', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ email: 'inconnu@test.ci', password: 'anything' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('échoue si champs manquants (400)', async () => {
    const res = await request.post('/api/auth/login').send({ email: ADMIN_EMAIL });
    expect(res.status).toBe(400);
  });

  it('magasin_ids=[2] pour commercial2', async () => {
    const res = await request
      .post('/api/auth/login')
      .send({ email: 'commercial2@storebox.app', password: ADMIN_PASS });
    expect(res.status).toBe(200);
    expect(res.body.data.user.magasin_ids).toEqual([2]);
  });
});

// ── /me ──────────────────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  it('retourne le profil utilisateur avec token valide', async () => {
    const token = await makeToken({ role: 'admin', perms: { all: true } });
    const res   = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBeDefined();
    expect(Array.isArray(res.body.data.magasin_ids)).toBe(true);
  });

  it('retourne 401 sans token', async () => {
    const res = await request.get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('retourne 401 avec token invalide', async () => {
    const res = await request
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });
});

// ── Refresh ───────────────────────────────────────────────────────────────────

describe('POST /api/auth/refresh', () => {
  it('échange un refreshToken valide contre un nouveau token', async () => {
    const login = await request
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASS });

    const { refreshToken } = login.body.data;
    const res = await request
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
  });

  it('échoue sans refreshToken (400)', async () => {
    const res = await request.post('/api/auth/refresh').send({});
    expect(res.status).toBe(400);
  });
});
