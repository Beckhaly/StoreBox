import { describe, it, expect, beforeAll } from 'vitest';
import { request, authHeader }            from '../../test/fixtures';

let admin:   { Authorization: string };
let viewer:  { Authorization: string };

beforeAll(async () => {
  [admin, viewer] = await Promise.all([
    authHeader({ role: 'admin', perms: { all: true } }),
    authHeader({ sub: 2, role: 'commercial', perms: { ventes: true } }),
  ]);
});

// ── GET /magasins ─────────────────────────────────────────────────────────────

describe('GET /api/magasins', () => {
  it('retourne la liste des magasins avec nb_utilisateurs et valeur_stock', async () => {
    const res = await request.get('/api/magasins').set(admin);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    const mg = res.body.data[0];
    expect(mg).toHaveProperty('code');
    expect(mg).toHaveProperty('nom');
    expect(mg).toHaveProperty('nb_utilisateurs');
    expect(mg).toHaveProperty('valeur_stock');
  });

  it('est accessible à tous les utilisateurs authentifiés', async () => {
    const res = await request.get('/api/magasins').set(viewer);
    expect(res.status).toBe(200);
  });

  it('refuse sans authentification (401)', async () => {
    const res = await request.get('/api/magasins');
    expect(res.status).toBe(401);
  });
});

// ── GET /magasins/:id ─────────────────────────────────────────────────────────

describe('GET /api/magasins/:id', () => {
  it('retourne le détail avec utilisateurs et stock', async () => {
    const res = await request.get('/api/magasins/1').set(admin);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('code');
    expect(Array.isArray(res.body.data.utilisateurs)).toBe(true);
    expect(Array.isArray(res.body.data.stock)).toBe(true);
  });

  it('retourne 404 sur un id inexistant', async () => {
    const res = await request.get('/api/magasins/99999').set(admin);
    expect(res.status).toBe(404);
  });
});

// ── POST /magasins ────────────────────────────────────────────────────────────

describe('POST /api/magasins', () => {
  it('crée un magasin (admin)', async () => {
    const res = await request
      .post('/api/magasins')
      .set(admin)
      .send({ code: 'MG-TEST', nom: 'Boutique Test', adresse: 'Abidjan', telephone: null, email: null });

    expect(res.status).toBe(200);
    expect(res.body.data.code).toBe('MG-TEST');
    expect(res.body.data.nom).toBe('Boutique Test');
    expect(res.body.data.actif).toBe(true);
  });

  it('refuse code/nom manquant (400)', async () => {
    const res = await request
      .post('/api/magasins')
      .set(admin)
      .send({ code: '', nom: '' });
    expect(res.status).toBe(400);
  });

  it('refuse un non-admin (403)', async () => {
    const res = await request
      .post('/api/magasins')
      .set(viewer)
      .send({ code: 'MG-X', nom: 'Test' });
    expect(res.status).toBe(403);
  });
});

// ── PUT /magasins/:id ─────────────────────────────────────────────────────────

describe('PUT /api/magasins/:id', () => {
  let createdId: number;

  beforeAll(async () => {
    const res = await request
      .post('/api/magasins')
      .set(admin)
      .send({ code: 'MG-EDIT', nom: 'Magasin Éditable', adresse: null, telephone: null, email: null });
    createdId = res.body.data.id;
  });

  it('met à jour nom, adresse, statut', async () => {
    const res = await request
      .put(`/api/magasins/${createdId}`)
      .set(admin)
      .send({ nom: 'Magasin Modifié', adresse: 'Zone 4', telephone: '+225 01 02 03 04', email: null, actif: true });

    expect(res.status).toBe(200);
    expect(res.body.data.nom).toBe('Magasin Modifié');
    expect(res.body.data.adresse).toBe('Zone 4');
  });

  it('peut désactiver un magasin', async () => {
    const res = await request
      .put(`/api/magasins/${createdId}`)
      .set(admin)
      .send({ nom: 'Magasin Modifié', adresse: null, telephone: null, email: null, actif: false });

    expect(res.status).toBe(200);
    expect(res.body.data.actif).toBe(false);
  });

  it('refuse un non-admin (403)', async () => {
    const res = await request
      .put(`/api/magasins/${createdId}`)
      .set(viewer)
      .send({ nom: 'Hack', adresse: null, telephone: null, email: null, actif: true });
    expect(res.status).toBe(403);
  });
});
