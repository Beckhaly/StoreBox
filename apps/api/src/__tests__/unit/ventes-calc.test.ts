import { describe, it, expect } from 'vitest';
import { calculerTotauxVente } from '../../lib/ventes-calc';

describe('calculerTotauxVente — produits universels', () => {
  // ── Vente unitaire classique (pièce) ──────────────────────────
  it('vente unitaire simple, TVA incluse', () => {
    const t = calculerTotauxVente([{ quantite: 1, prix_unitaire: 1180 }]);
    expect(t.total_ttc).toBe(1180);
    expect(t.sous_total).toBe(1000);   // 1180 / 1.18
    expect(t.tva_montant).toBe(180);
  });

  // ── Vente au poids (quantité décimale) ────────────────────────
  it('vente au poids 2,5 kg × 800 = 2000 TTC', () => {
    const t = calculerTotauxVente([{ quantite: 2.5, prix_unitaire: 800 }]);
    expect(t.brut).toBe(2000);
    expect(t.total_ttc).toBe(2000);
    expect(t.sous_total).toBe(1695);   // round(2000 / 1.18)
    expect(t.tva_montant).toBe(305);   // 2000 - 1695
    expect(t.sous_total + t.tva_montant).toBe(t.total_ttc);
  });

  it('vente au poids 1,5 kg × 800 = 1200 TTC', () => {
    const t = calculerTotauxVente([{ quantite: 1.5, prix_unitaire: 800 }]);
    expect(t.total_ttc).toBe(1200);
    expect(t.sous_total + t.tva_montant).toBe(1200);
  });

  it('quantité décimale fine (0,125 kg)', () => {
    const t = calculerTotauxVente([{ quantite: 0.125, prix_unitaire: 8000 }]);
    expect(t.total_ttc).toBe(1000);    // 0.125 * 8000
  });

  // ── Le prix est TTC : le total encaissé == prix affiché ───────
  it('le total TTC ne gonfle jamais le prix (pas de TVA ajoutée)', () => {
    const t = calculerTotauxVente([{ quantite: 1, prix_unitaire: 2000 }], { tva_pct: 18 });
    expect(t.total_ttc).toBe(2000);    // et NON 2360
  });

  // ── Remise globale ────────────────────────────────────────────
  it('applique une remise globale de 10%', () => {
    const t = calculerTotauxVente([{ quantite: 2, prix_unitaire: 5000 }], { remise_pct: 10 });
    expect(t.brut).toBe(10000);
    expect(t.remise_montant).toBe(1000);
    expect(t.total_ttc).toBe(9000);
  });

  // ── Remise par ligne ──────────────────────────────────────────
  it('applique une remise par ligne', () => {
    const t = calculerTotauxVente([{ quantite: 1, prix_unitaire: 1000, remise_pct: 50 }]);
    expect(t.brut).toBe(500);
    expect(t.total_ttc).toBe(500);
  });

  // ── Multi-lignes (mix pièce + poids) ──────────────────────────
  it('additionne plusieurs lignes hétérogènes', () => {
    const t = calculerTotauxVente([
      { quantite: 2,   prix_unitaire: 1500 },   // 3000
      { quantite: 1.5, prix_unitaire: 800 },    // 1200
      { quantite: 3,   prix_unitaire: 250 },    // 750
    ]);
    expect(t.brut).toBe(4950);
    expect(t.total_ttc).toBe(4950);
  });

  // ── TVA personnalisée ─────────────────────────────────────────
  it('supporte un taux de TVA différent (0%)', () => {
    const t = calculerTotauxVente([{ quantite: 1, prix_unitaire: 1000 }], { tva_pct: 0 });
    expect(t.total_ttc).toBe(1000);
    expect(t.sous_total).toBe(1000);
    expect(t.tva_montant).toBe(0);
  });

  // ── Garde-fous ────────────────────────────────────────────────
  it('rejette une quantité négative', () => {
    expect(() => calculerTotauxVente([{ quantite: -1, prix_unitaire: 1000 }])).toThrow();
  });

  it('panier vide → tout à zéro', () => {
    const t = calculerTotauxVente([]);
    expect(t).toEqual({ brut: 0, remise_montant: 0, total_ttc: 0, sous_total: 0, tva_montant: 0 });
  });
});
