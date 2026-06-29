// ============================================================
// StoreBox — Client API typé
// ============================================================
import { ApiResponse } from '@storebox/shared';

const BASE = '/api';
const TOKEN_KEY   = 'storebox_token';
const REFRESH_KEY = 'storebox_refresh';
const USER_KEY    = 'storebox_user';

export const storage = {
  getToken:   ()    => localStorage.getItem(TOKEN_KEY),
  setToken:   (t: string) => localStorage.setItem(TOKEN_KEY, t),
  getRefresh: ()    => localStorage.getItem(REFRESH_KEY),
  getUser:    ()    => { try { return JSON.parse(localStorage.getItem(USER_KEY)!); } catch { return null; } },
  setAuth:    (token: string, refresh: string, user: object) => {
    localStorage.setItem(TOKEN_KEY,   token);
    localStorage.setItem(REFRESH_KEY, refresh);
    localStorage.setItem(USER_KEY,    JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

// Refresh silencieux
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

async function doRefresh(): Promise<string | null> {
  const refresh = storage.getRefresh();
  if (!refresh) return null;
  try {
    const r = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    const j: ApiResponse<{ token: string }> = await r.json();
    if (j.success && j.data) {
      storage.setToken(j.data.token);
      return j.data.token;
    }
  } catch {}
  return null;
}

// Fetch principal
export async function apiFetch<T = unknown>(
  path: string,
  opts: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = storage.getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res = await fetch(BASE + path, { ...opts, headers });

  // Auto-refresh si 401 TOKEN_EXPIRED
  if (res.status === 401) {
    const body = await res.clone().json().catch(() => ({}));
    if (body.code === 'TOKEN_EXPIRED') {
      if (!isRefreshing) {
        isRefreshing = true;
        const newToken = await doRefresh();
        isRefreshing = false;
        refreshQueue.forEach(cb => cb(newToken ?? ''));
        refreshQueue = [];

        if (newToken) {
          headers['Authorization'] = `Bearer ${newToken}`;
          res = await fetch(BASE + path, { ...opts, headers });
        } else {
          storage.clear();
          window.location.href = '/login';
          return { success: false, error: 'Session expirée' };
        }
      } else {
        // Attendre que le refresh en cours finisse
        const newToken = await new Promise<string>(resolve => {
          refreshQueue.push(resolve);
        });
        if (newToken) {
          headers['Authorization'] = `Bearer ${newToken}`;
          res = await fetch(BASE + path, { ...opts, headers });
        }
      }
    }
  }

  return res.json();
}

// Helpers typés
export const api = {
  get:    <T>(path: string) =>
    apiFetch<T>(path),

  post:   <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),

  put:    <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) }),

  delete: <T>(path: string) =>
    apiFetch<T>(path, { method: 'DELETE' }),

  // PDF : retourne un Blob pour ouverture dans un onglet
  pdf: async (path: string): Promise<Blob | null> => {
    const token = storage.getToken();
    const res = await fetch(BASE + path, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    return res.blob();
  },

  openPdf: async (path: string) => {
    const blob = await api.pdf(path);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },
};
