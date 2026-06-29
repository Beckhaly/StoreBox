import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act }                       from '@testing-library/react';

// Mock useAuth avant tout import du hook
vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

import { useAuth }                            from '../hooks/useAuth';
import { useMagasin, useMagasinStore, useMagasinParams } from '../hooks/useMagasin';

const mockUseAuth = vi.mocked(useAuth);

function setUser(magasin_ids: number[], magasin_noms: string[] = []) {
  mockUseAuth.mockImplementation((selector: any) =>
    selector({ user: { magasin_ids, magasin_noms, role: 'commercial' } })
  );
}

function setAdmin() {
  mockUseAuth.mockImplementation((selector: any) =>
    selector({ user: { magasin_ids: [], magasin_noms: [], role: 'admin' } })
  );
}

function setNoUser() {
  mockUseAuth.mockImplementation((selector: any) => selector({ user: null }));
}

beforeEach(() => {
  // Reset du store Zustand entre chaque test
  act(() => { useMagasinStore.getState().setMagasin(null); });
});

// ── Cas mono-magasin ──────────────────────────────────────────────────────────

describe('useMagasin — mono-magasin', () => {
  it('magasinActif est fixé au magasin de l\'utilisateur', () => {
    setUser([1], ['Boutique Centre']);
    const { result } = renderHook(() => useMagasin());
    expect(result.current.magasinActif).toBe(1);
  });

  it('peutChoisir = false', () => {
    setUser([1]);
    const { result } = renderHook(() => useMagasin());
    expect(result.current.peutChoisir).toBe(false);
  });

  it('isAdmin = false', () => {
    setUser([1]);
    const { result } = renderHook(() => useMagasin());
    expect(result.current.isAdmin).toBe(false);
  });

  it('magasinNom = premier nom', () => {
    setUser([2], ['Boutique Cocody']);
    const { result } = renderHook(() => useMagasin());
    expect(result.current.magasinNom).toBe('Boutique Cocody');
  });

  it('setMagasin est un no-op (ne change pas l\'actif)', () => {
    setUser([1]);
    const { result } = renderHook(() => useMagasin());
    act(() => result.current.setMagasin(2));
    expect(result.current.magasinActif).toBe(1);
  });

  it('ignore le query param du store (isolation JWT)', () => {
    act(() => { useMagasinStore.getState().setMagasin(99); });
    setUser([1]);
    const { result } = renderHook(() => useMagasin());
    expect(result.current.magasinActif).toBe(1);
  });
});

// ── Cas admin (magasin_ids vide) ──────────────────────────────────────────────

describe('useMagasin — admin', () => {
  it('peutChoisir = true', () => {
    setAdmin();
    const { result } = renderHook(() => useMagasin());
    expect(result.current.peutChoisir).toBe(true);
  });

  it('isAdmin = true', () => {
    setAdmin();
    const { result } = renderHook(() => useMagasin());
    expect(result.current.isAdmin).toBe(true);
  });

  it('magasinActif = null par défaut', () => {
    setAdmin();
    const { result } = renderHook(() => useMagasin());
    expect(result.current.magasinActif).toBeNull();
  });

  it('setMagasin met à jour le store', () => {
    setAdmin();
    const { result } = renderHook(() => useMagasin());
    act(() => result.current.setMagasin(2));
    expect(result.current.magasinActif).toBe(2);
  });

  it('setMagasin(null) remet à null', () => {
    setAdmin();
    const { result } = renderHook(() => useMagasin());
    act(() => result.current.setMagasin(1));
    act(() => result.current.setMagasin(null));
    expect(result.current.magasinActif).toBeNull();
  });
});

// ── Cas multi-magasin ─────────────────────────────────────────────────────────

describe('useMagasin — multi-magasin', () => {
  it('peutChoisir = true', () => {
    setUser([1, 2]);
    const { result } = renderHook(() => useMagasin());
    expect(result.current.peutChoisir).toBe(true);
  });

  it('isAdmin = false', () => {
    setUser([1, 2]);
    const { result } = renderHook(() => useMagasin());
    expect(result.current.isAdmin).toBe(false);
  });

  it('magasinActif = null si aucun choix dans le store', () => {
    setUser([1, 2]);
    const { result } = renderHook(() => useMagasin());
    expect(result.current.magasinActif).toBeNull();
  });

  it('magasinActif = valeur du store si dans le périmètre', () => {
    setUser([1, 2]);
    act(() => { useMagasinStore.getState().setMagasin(2); });
    const { result } = renderHook(() => useMagasin());
    expect(result.current.magasinActif).toBe(2);
  });

  it('repli sur premier magasin si store hors périmètre', () => {
    setUser([1, 2]);
    act(() => { useMagasinStore.getState().setMagasin(99); });
    const { result } = renderHook(() => useMagasin());
    expect(result.current.magasinActif).toBe(1);
  });
});

// ── Cas utilisateur non connecté ──────────────────────────────────────────────

describe('useMagasin — sans user', () => {
  it('se comporte comme admin (magasin_ids vide)', () => {
    setNoUser();
    const { result } = renderHook(() => useMagasin());
    expect(result.current.peutChoisir).toBe(true);
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.magasinActif).toBeNull();
  });
});

// ── useMagasinParams() ────────────────────────────────────────────────────────

describe('useMagasinParams()', () => {
  it('ajoute magasin_id quand actif', () => {
    setAdmin();
    act(() => { useMagasinStore.getState().setMagasin(1); });
    const { result } = renderHook(() => useMagasinParams({ page: 1 }));
    expect(result.current).toEqual({ magasin_id: 1, page: 1 });
  });

  it('n\'ajoute pas magasin_id si null', () => {
    setAdmin();
    act(() => { useMagasinStore.getState().setMagasin(null); });
    const { result } = renderHook(() => useMagasinParams({ page: 1 }));
    expect(result.current).toEqual({ page: 1 });
  });
});
