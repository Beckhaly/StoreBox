import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAuth } from './useAuth';

interface MagasinState {
  magasinActif: number | null;
  setMagasin:   (id: number | null) => void;
}

export const useMagasinStore = create<MagasinState>()(
  persist(
    (set) => ({
      magasinActif: null,
      setMagasin:   (id) => set({ magasinActif: id }),
    }),
    { name: 'storebox-magasin' }
  )
);

export function useMagasin() {
  const user = useAuth(s => s.user);
  const { magasinActif, setMagasin } = useMagasinStore();

  const magasinIds: number[] = user?.magasin_ids ?? [];

  // Utilisateur rattaché à un seul magasin → pas de choix possible
  if (magasinIds.length === 1) {
    return {
      magasinActif:   magasinIds[0],
      magasinNom:     user?.magasin_noms?.[0] ?? null,
      magasinIds,
      isAdmin:        false,
      peutChoisir:    false,
      setMagasin:     (_: number | null) => {},
    };
  }

  // Admin (magasinIds vide) ou multi-magasin → peut choisir
  // Pour multi-magasin : s'assurer que la sélection est dans son périmètre
  const actif = magasinIds.length > 0 && magasinActif !== null && !magasinIds.includes(magasinActif)
    ? magasinIds[0]
    : magasinActif;

  return {
    magasinActif:   actif,
    magasinNom:     null,
    magasinIds,
    isAdmin:        magasinIds.length === 0,
    peutChoisir:    true,
    setMagasin,
  };
}

export function useMagasinParams(extra: Record<string, unknown> = {}) {
  const { magasinActif } = useMagasin();
  return magasinActif ? { magasin_id: magasinActif, ...extra } : extra;
}
