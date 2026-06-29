import { describe, it, expect, vi } from 'vitest';
import { ok, fail, wrap }          from '../../lib/helpers';

// ── Mocks Response ────────────────────────────────────────────────────────────

function mockRes() {
  const res: any = {};
  res.status  = vi.fn().mockReturnValue(res);
  res.json    = vi.fn().mockReturnValue(res);
  return res;
}

// ── ok() ─────────────────────────────────────────────────────────────────────

describe('ok()', () => {
  it('envoie success:true avec la donnée', () => {
    const res = mockRes();
    ok(res, { id: 1, nom: 'test' });
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: 1, nom: 'test' } });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('accepte null comme donnée', () => {
    const res = mockRes();
    ok(res, null);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: null });
  });

  it('accepte un tableau vide', () => {
    const res = mockRes();
    ok(res, []);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
  });
});

// ── fail() ────────────────────────────────────────────────────────────────────

describe('fail()', () => {
  it('envoie success:false avec le message', () => {
    const res = mockRes();
    fail(res, 'Erreur test', 400);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Erreur test' });
  });

  it('utilise 500 par défaut si pas de status', () => {
    const res = mockRes();
    fail(res, 'Erreur interne');
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('404 pour not found', () => {
    const res = mockRes();
    fail(res, 'Introuvable', 404);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Introuvable' });
  });
});

// ── wrap() ────────────────────────────────────────────────────────────────────

describe('wrap()', () => {
  it('exécute le handler async normalement', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = wrap(handler);
    const [req, res, next] = [{} as any, {} as any, vi.fn()];
    await wrapped(req, res, next);
    expect(handler).toHaveBeenCalledWith(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('passe les erreurs à next()', async () => {
    const err     = new Error('boom');
    const handler = vi.fn().mockRejectedValue(err);
    const wrapped = wrap(handler);
    const next    = vi.fn();
    await wrapped({} as any, {} as any, next);
    expect(next).toHaveBeenCalledWith(err);
  });
});
