import { describe, it, expect } from 'vitest';
import { fcfa, fcfaM, fdate, fdateLong, STATUT_BADGE } from '../lib/formatters';
// ── fcfa() ────────────────────────────────────────────────────────────────────
describe('fcfa()', () => {
    it('formate un entier avec séparateurs de milliers', () => {
        expect(fcfa(1000000)).toBe('1 000 000 F');
    });
    it('formate un petit montant sans séparateur', () => {
        expect(fcfa(500)).toBe('500 F');
    });
    it('arrondit les décimales', () => {
        expect(fcfa(1500.7)).toBe('1 501 F');
        expect(fcfa(1500.2)).toBe('1 500 F');
    });
    it('retourne "—" pour null', () => {
        expect(fcfa(null)).toBe('—');
    });
    it('retourne "—" pour undefined', () => {
        expect(fcfa(undefined)).toBe('—');
    });
    it('gère zéro', () => {
        expect(fcfa(0)).toBe('0 F');
    });
    it('gère les grands montants (millions)', () => {
        expect(fcfa(10000000)).toBe('10 000 000 F');
    });
});
// ── fcfaM() ───────────────────────────────────────────────────────────────────
describe('fcfaM()', () => {
    it('exprime en millions avec 1 décimale', () => {
        expect(fcfaM(5000000)).toBe('5.0 M F');
    });
    it('arrondit correctement', () => {
        expect(fcfaM(1500000)).toBe('1.5 M F');
        expect(fcfaM(2750000)).toBe('2.8 M F');
    });
    it('retourne "—" pour null', () => {
        expect(fcfaM(null)).toBe('—');
    });
});
// ── fdate() ───────────────────────────────────────────────────────────────────
describe('fdate()', () => {
    it('formate une date ISO en DD/MM/YY', () => {
        const result = fdate('2026-01-15T00:00:00.000Z');
        expect(result).toMatch(/^\d{2}\/\d{2}\/\d{2}$/);
        expect(result).toContain('01');
    });
    it('retourne "—" pour null', () => {
        expect(fdate(null)).toBe('—');
    });
    it('retourne "—" pour undefined', () => {
        expect(fdate(undefined)).toBe('—');
    });
    it('accepte un objet Date', () => {
        const d = new Date('2026-04-19');
        expect(fdate(d)).toMatch(/^\d{2}\/\d{2}\/\d{2}$/);
    });
});
// ── fdateLong() ───────────────────────────────────────────────────────────────
describe('fdateLong()', () => {
    it('formate en format long (ex: 15 janvier 2026)', () => {
        const result = fdateLong('2026-01-15');
        expect(result).toContain('2026');
        expect(result.length).toBeGreaterThan(8);
    });
    it('retourne "—" pour null', () => {
        expect(fdateLong(null)).toBe('—');
    });
});
// ── STATUT_BADGE ──────────────────────────────────────────────────────────────
describe('STATUT_BADGE', () => {
    it('contient les statuts de paiement essentiels', () => {
        expect(STATUT_BADGE.paye.variant).toBe('green');
        expect(STATUT_BADGE.non_paye.variant).toBe('gray');
        expect(STATUT_BADGE.partiel.variant).toBe('blue');
    });
    it('contient les rôles utilisateurs', () => {
        expect(STATUT_BADGE.admin.label).toBe('Admin');
        expect(STATUT_BADGE.commercial.label).toBe('Commercial');
        expect(STATUT_BADGE.caissier.label).toBe('Caissier');
    });
    it('contient les types client', () => {
        expect(STATUT_BADGE.grossiste.variant).toBe('blue');
        expect(STATUT_BADGE.detaillant.variant).toBe('purple');
    });
});
