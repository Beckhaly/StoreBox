import { useEffect, useState } from 'react';
import { SocieteParametres } from '@storebox/shared';
import { api } from '../lib/api';

/**
 * Hook pour charger les paramètres de la société
 * Accessible à tous (pas de restriction)
 */
export function useSociete() {
  const [data, setData] = useState<SocieteParametres | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await api.get('/societe');
        if (res.success) {
          setData(res.data as SocieteParametres);
          setError(null);
        } else {
          setError(res.error || 'Erreur lors du chargement des paramètres');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur réseau');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { data, loading, error };
}

/**
 * Hook pour mettre à jour les paramètres de la société (admin only)
 */
export function useSocieteUpdate() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = async (updates: Partial<SocieteParametres>) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.put('/societe', updates);
      if (res.success) return res.data as SocieteParametres;
      setError(res.error || 'Erreur mise à jour');
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur réseau';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { update, loading, error };
}
