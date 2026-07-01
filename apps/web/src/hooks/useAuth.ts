import { create } from 'zustand';
import { Utilisateur, LoginPayload, LoginResponse, PermissionModule, hasPerm } from '@storebox/shared';
import { api, storage } from '../lib/api';

interface AuthState {
  user:     Utilisateur | null;
  token:    string | null;
  loading:  boolean;
  error:    string | null;
  login:    (payload: LoginPayload) => Promise<boolean>;
  logout:   () => Promise<void>;
  init:     () => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  user:    null,
  token:   null,
  loading: false,
  error:   null,

  init: () => {
    const user  = storage.getUser() as Utilisateur | null;
    const token = storage.getToken();
    if (user && token) set({ user, token });
  },

  login: async ({ email, password }) => {
    set({ loading: true, error: null });
    try {
      const res = await api.post<LoginResponse>('/auth/login', { email, password });
      if (!res.success || !res.data) {
        set({ loading: false, error: res.error ?? 'Erreur de connexion' });
        return false;
      }
      const { token, refreshToken, user } = res.data;
      storage.setAuth(token, refreshToken, user);
      set({ user, token, loading: false, error: null });
      return true;
    } catch (e: any) {
      set({ loading: false, error: e.message });
      return false;
    }
  },

  logout: async () => {
    const token = get().token;
    if (token) {
      await api.post('/auth/logout', {}).catch(() => {});
    }
    storage.clear();
    set({ user: null, token: null });
  },
}));

// Hook de vérification de droit : can('ventes'), can('paiements','write')…
export function useCan() {
  const user = useAuth(s => s.user);
  return (mod: PermissionModule | 'admin', level: 'read' | 'write' = 'read') =>
    hasPerm(user?.permissions, mod, level);
}
