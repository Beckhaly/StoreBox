import { describe, it, expect, beforeAll } from 'vitest';
import { request, authHeader }            from '../../test/fixtures';
import { pool }                           from '../../lib/db';

let admin: { Authorization: string };
let viewer: { Authorization: string }; // commercial sans droits admin

beforeAll(async () => {
  [admin, viewer] = await Promise.all([
    authHeader({ role: 'admin', perms: { all: true } }),
    authHeader({ sub: 2, role: 'commercial', perms: { ventes: true } }),
  ]);
});

// ── GET /admin/utilisateurs ───────────────────────────────────────────────────

describe('GET /api/admin/utilisateurs', () => {
  it('retourne la liste des utilisateurs avec magasin_ids', async () => {
    const res = await request.get('/api/admin/utilisateurs').set(admin);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.utilisateurs)).toBe(true);
    const u = res.body.data.utilisateurs[0];
    expect(Array.isArray(u.magasin_ids)).toBe(true);
    expect(u).toHaveProperty('role_id');
    expect(u).toHaveProperty('email');
  });

  it('refuse un non-admin (403)', async () => {
    const res = await request.get('/api/admin/utilisateurs').set(viewer);
    expect(res.status).toBe(403);
  });

  it('refuse sans token (401)', async () => {
    const res = await request.get('/api/admin/utilisateurs');
    expect(res.status).toBe(401);
  });
});

// ── POST /admin/utilisateurs ──────────────────────────────────────────────────

describe('POST /api/admin/utilisateurs', () => {
  const payload = {
    code:        'TEST-001',
    prenom:      'Koné',
    nom:         'Test',
    email:       'test.integration@telepro.ci',
    telephone:   '+225 07 99 99 99',
    password:    'Password123!',
    role_id:     2,
    magasin_ids: [],
    actif:       true,
  };

  it('crée un utilisateur sans magasin (admin global)', async () => {
    const res = await request
      .post('/api/admin/utilisateurs')
      .set(admin)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
  });

  it('crée un utilisateur avec magasin(s)', async () => {
    const res = await request
      .post('/api/admin/utilisateurs')
      .set(admin)
      .send({ ...payload, code: 'TEST-002', email: 'test2@telepro.ci', magasin_ids: [1] });

    expect(res.status).toBe(200);
    // Vérifier que la liaison est bien créée
    const { rows } = await pool.query(
      `SELECT magasin_id FROM utilisateurs_magasins WHERE utilisateur_id=$1`,
      [res.body.data.id]
    );
    expect(rows.map((r: any) => r.magasin_id)).toContain(1);
  });

  it('crée un utilisateur avec plusieurs magasins', async () => {
    const res = await request
      .post('/api/admin/utilisateurs')
      .set(admin)
      .send({ ...payload, code: 'TEST-003', email: 'test3@telepro.ci', magasin_ids: [1, 2] });

    expect(res.status).toBe(200);
    const { rows } = await pool.query(
      `SELECT magasin_id FROM utilisateurs_magasins WHERE utilisateur_id=$1 ORDER BY magasin_id`,
      [res.body.data.id]
    );
    expect(rows.map((r: any) => r.magasin_id)).toEqual([1, 2]);
  });

  it('refuse un non-admin (403)', async () => {
    const res = await request
      .post('/api/admin/utilisateurs')
      .set(viewer)
      .send(payload);
    expect(res.status).toBe(403);
  });
});

// ── PUT /admin/utilisateurs/:id ───────────────────────────────────────────────

describe('PUT /api/admin/utilisateurs/:id', () => {
  let createdId: number;

  beforeAll(async () => {
    const res = await request
      .post('/api/admin/utilisateurs')
      .set(admin)
      .send({
        code: 'EDIT-001', prenom: 'Édit', nom: 'Able',
        email: 'editable@telepro.ci', password: 'Pass123!',
        role_id: 2, magasin_ids: [1], actif: true,
      });
    createdId = res.body.data.id;
  });

  it('met à jour les magasins de l\'utilisateur', async () => {
    const res = await request
      .put(`/api/admin/utilisateurs/${createdId}`)
      .set(admin)
      .send({
        prenom: 'Édit', nom: 'Able', email: 'editable@telepro.ci',
        role_id: 2, magasin_ids: [1, 2], actif: true,
      });
    expect(res.status).toBe(200);

    const { rows } = await pool.query(
      `SELECT magasin_id FROM utilisateurs_magasins WHERE utilisateur_id=$1 ORDER BY magasin_id`,
      [createdId]
    );
    expect(rows.map((r: any) => r.magasin_id)).toEqual([1, 2]);
  });

  it('retire tous les magasins (admin global)', async () => {
    const res = await request
      .put(`/api/admin/utilisateurs/${createdId}`)
      .set(admin)
      .send({
        prenom: 'Édit', nom: 'Able', email: 'editable@telepro.ci',
        role_id: 2, magasin_ids: [], actif: true,
      });
    expect(res.status).toBe(200);

    const { rows } = await pool.query(
      `SELECT COUNT(*) cnt FROM utilisateurs_magasins WHERE utilisateur_id=$1`,
      [createdId]
    );
    expect(Number(rows[0].cnt)).toBe(0);
  });

  it('désactive l\'utilisateur', async () => {
    const res = await request
      .put(`/api/admin/utilisateurs/${createdId}`)
      .set(admin)
      .send({
        prenom: 'Édit', nom: 'Able', email: 'editable@telepro.ci',
        role_id: 2, magasin_ids: [], actif: false,
      });
    expect(res.status).toBe(200);

    const { rows } = await pool.query(`SELECT actif FROM utilisateurs WHERE id=$1`, [createdId]);
    expect(rows[0].actif).toBe(false);
  });
});

// ── DELETE /admin/utilisateurs/:id ────────────────────────────────────────────

describe('DELETE /api/admin/utilisateurs/:id', () => {
  it('désactive l\'utilisateur (soft delete)', async () => {
    const create = await request
      .post('/api/admin/utilisateurs')
      .set(admin)
      .send({
        code: 'DEL-001', prenom: 'À', nom: 'Supprimer',
        email: 'todelete@telepro.ci', password: 'Pass123!',
        role_id: 2, magasin_ids: [], actif: true,
      });
    const id = create.body.data.id;

    const res = await request.delete(`/api/admin/utilisateurs/${id}`).set(admin);
    expect(res.status).toBe(200);

    const { rows } = await pool.query(`SELECT actif FROM utilisateurs WHERE id=$1`, [id]);
    expect(rows[0].actif).toBe(false);
  });
});
