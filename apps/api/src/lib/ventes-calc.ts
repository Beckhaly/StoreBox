// ============================================================
// Calculs de totaux de vente (logique pure, testable)
// Les prix de vente sont TTC (prix affiché = prix encaissé).
// La TVA est extraite « en dedans » pour rester cohérent avec
// l'affichage de la caisse et le montant réellement encaissé.
// Quantités décimales supportées (vente au poids/volume).
// Montants en FCFA → toujours arrondis à l'entier.
// ============================================================

export interface LigneCalc {
  quantite:      number;
  prix_unitaire: number;
  remise_pct?:   number;   // remise par ligne (%)
}

export interface OptionsCalc {
  remise_pct?: number;     // remise globale (%)
  tva_pct?:    number;     // taux TVA (défaut 18)
}

export interface TotauxVente {
  brut:           number;  // somme des lignes avant remise globale
  remise_montant: number;  // montant de la remise globale
  total_ttc:      number;  // total TTC (= prix encaissé)
  sous_total:     number;  // base HT (TVA extraite en dedans)
  tva_montant:    number;  // TVA incluse dans le TTC
}

/**
 * Calcule les totaux d'une vente à partir de ses lignes.
 * @throws si une quantité ou un prix est négatif.
 */
export function calculerTotauxVente(
  lignes: LigneCalc[],
  { remise_pct = 0, tva_pct = 18 }: OptionsCalc = {}
): TotauxVente {
  const brut = lignes.reduce((s, l) => {
    const q  = Number(l.quantite);
    const pu = Number(l.prix_unitaire);
    if (q < 0 || pu < 0) throw new Error('Quantité et prix doivent être positifs');
    const remiseLigne = (l.remise_pct ?? 0) / 100;
    return s + Math.round(q * pu * (1 - remiseLigne));
  }, 0);

  const remise_montant = Math.round(brut * remise_pct / 100);
  const total_ttc      = brut - remise_montant;
  const sous_total     = Math.round(total_ttc / (1 + tva_pct / 100)); // HT
  const tva_montant    = total_ttc - sous_total;                       // TVA incluse

  return { brut, remise_montant, total_ttc, sous_total, tva_montant };
}
