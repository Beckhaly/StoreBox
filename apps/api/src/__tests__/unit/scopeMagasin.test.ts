import { describe, it, expect } from 'vitest';
import { scopeMagasin }         from '../../middleware/auth';

function makeReq(magasin_ids: number[], queryMagasinId?: string) {
  return {
    user:  { magasin_ids },
    query: queryMagasinId !== undefined ? { magasin_id: queryMagasinId } : {},
  } as any;
}

describe('scopeMagasin()', () => {
  describe('utilisateur mono-magasin', () => {
    it('retourne le seul magasin, ignore le query param', () => {
      expect(scopeMagasin(makeReq([1], '2'))).toBe(1);
    });

    it('retourne le seul magasin même sans query param', () => {
      expect(scopeMagasin(makeReq([3]))).toBe(3);
    });
  });

  describe('admin (magasin_ids vide)', () => {
    it('retourne null quand pas de query param', () => {
      expect(scopeMagasin(makeReq([]))).toBeNull();
    });

    it('retourne le magasin du query param', () => {
      expect(scopeMagasin(makeReq([], '2'))).toBe(2);
    });

    it('retourne null si query param invalide', () => {
      expect(scopeMagasin(makeReq([], 'abc'))).toBeNull();
    });

    it('retourne null si query param vide', () => {
      expect(scopeMagasin(makeReq([], ''))).toBeNull();
    });
  });

  describe('utilisateur multi-magasin', () => {
    it('retourne le query param si dans son périmètre', () => {
      expect(scopeMagasin(makeReq([1, 2], '2'))).toBe(2);
    });

    it('retourne le premier magasin si query param hors périmètre', () => {
      expect(scopeMagasin(makeReq([1, 2], '5'))).toBe(1);
    });

    it('retourne null si aucun query param', () => {
      expect(scopeMagasin(makeReq([1, 2]))).toBeNull();
    });
  });
});
