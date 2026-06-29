import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useMagasinStore } from './useMagasin';

interface UseApiState<T> {
  data:     T | null;
  loading:  boolean;
  error:    string | null;
  refresh:  () => void;
}

export function useApi<T>(path: string | null): UseApiState<T> {
  const magasinActif = useMagasinStore(s => s.magasinActif);
  const [data,    setData]    = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [tick,    setTick]    = useState(0);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    if (!path) return;
    const fullPath = magasinActif
      ? `${path}${path.includes('?') ? '&' : '?'}magasin_id=${magasinActif}`
      : path;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.get<T>(fullPath).then(res => {
      if (cancelled) return;
      if (res.success) setData(res.data ?? null);
      else setError(res.error ?? 'Erreur');
      setLoading(false);
    }).catch(e => {
      if (!cancelled) { setError(e.message); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [path, tick, magasinActif]);

  return { data, loading, error, refresh };
}

// Hook avec paramètres dynamiques
export function useApiLazy<T>() {
  const [data,    setData]    = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const fetch = useCallback(async (path: string): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<T>(path);
      if (res.success) {
        const value = res.data ?? null;
        setData(value);
        return value;
      } else {
        setError(res.error ?? 'Erreur');
        return null;
      }
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, fetch };
}
