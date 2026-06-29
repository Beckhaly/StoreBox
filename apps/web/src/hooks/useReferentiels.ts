import { useEffect, useState } from 'react';
import { Referentiel, AllReferentiels } from '@storebox/shared';
import { api } from '../lib/api';

/**
 * Hook pour charger dynamiquement tous les référentiels
 * Utilise le point d'entrée /api/referentiels qui récupère tous les référentiels actifs
 */
export function useReferentiels() {
  const [data, setData] = useState<AllReferentiels | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await api.get('/referentiels');
        if (res.success) {
          setData(res.data as AllReferentiels);
          setError(null);
        } else {
          setError(res.error || 'Erreur lors du chargement des référentiels');
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
 * Hook pour charger un référentiel spécifique
 * @param type - Le type de référentiel à charger (ex: 'types_clients', 'statuts_clients')
 * @param version - Version clé pour forcer un reload
 */
export function useReferentielType(type: keyof AllReferentiels, version?: number) {
  const [items, setItems] = useState<Referentiel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/referentiels/${type}`);
      if (res.success) {
        setItems((res.data as Referentiel[]) || []);
        setError(null);
      } else {
        setError(res.error || `Erreur lors du chargement de ${type}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, [type, version]);

  return { items, loading, error, reload };
}

/**
 * Hook pour créer/modifier un référentiel
 */
export function useReferentielCRUD(type: keyof AllReferentiels, onSuccess?: () => void) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (code: string, libelle: string, couleur?: string, signe?: number, icone?: string, ordre?: number) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.post(`/referentiels/${type}`, {
        code,
        libelle,
        ...(couleur && { couleur }),
        ...(signe && { signe }),
        ...(icone && { icone }),
        ...(ordre !== undefined && { ordre }),
      });
      if (res.success) {
        onSuccess?.();
        return res.data;
      }
      setError(res.error || 'Erreur création');
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur réseau';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const update = async (id: number, updates: Partial<Referentiel>) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.put(`/referentiels/${type}/${id}`, updates);
      if (res.success) {
        onSuccess?.();
        return res.data;
      }
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

  const delete_ = async (id: number) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.delete(`/referentiels/${type}/${id}`);
      if (res.success) {
        onSuccess?.();
        return true;
      }
      setError(res.error || 'Erreur suppression');
      return false;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur réseau';
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { create, update, delete: delete_, loading, error };
}
