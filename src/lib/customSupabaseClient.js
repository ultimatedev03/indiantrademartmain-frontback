import { createClient } from '@supabase/supabase-js';
import { apiUrl } from '@/lib/apiBase';

// NOTE:
// - Supabase client is used ONLY for database queries (no auth).
// - Auth is handled by backend JWT + httpOnly cookies.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error(
    '[Supabase] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Check your .env.local and restart the dev server.'
  );
}

const baseClient = createClient(supabaseUrl || '', supabaseAnonKey || '');

let cachedUser = null;
let refreshPromise = null;
let lastRefreshAt = 0;
let refreshCooldownUntil = 0;
const listeners = new Set();

const SESSION_TTL_MS = 30 * 1000;
const REFRESH_COOLDOWN_MS = 15 * 1000;

const getCsrfToken = () => {
  if (typeof document === 'undefined') return '';
  const token = document.cookie
    .split('; ')
    .find((row) => row.startsWith('itm_csrf='))
    ?.split('=')[1];
  return token ? decodeURIComponent(token) : '';
};

const emit = (event, session) => {
  listeners.forEach((cb) => {
    try {
      cb(event, session);
    } catch (e) {
      // ignore listener errors
    }
  });
};

const fetchJson = async (path, options = {}) => {
  const method = String(options.method || 'GET').toUpperCase();
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...options.headers,
  };

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = getCsrfToken();
    if (csrf && !headers['X-CSRF-Token']) {
      headers['X-CSRF-Token'] = csrf;
    }
  }

  const res = await fetch(apiUrl(path), {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data?.error || data?.message || 'Request failed');
    error.status = res.status;
    error.payload = data;
    throw error;
  }

  return data;
};

const buildSession = (user) => (user ? { user } : null);

const refreshSession = async (force = false) => {
  const now = Date.now();
  if (!force) {
    if (refreshCooldownUntil && now < refreshCooldownUntil) {
      return buildSession(cachedUser);
    }
    if (cachedUser && now - lastRefreshAt < SESSION_TTL_MS) {
      return buildSession(cachedUser);
    }
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const hadUser = !!cachedUser;
    try {
      const data = await fetchJson('/api/auth/me');
      cachedUser = data?.user || null;
      lastRefreshAt = Date.now();
      return buildSession(cachedUser);
    } catch (error) {
      if (error?.status === 429) {
        refreshCooldownUntil = Date.now() + REFRESH_COOLDOWN_MS;
      }
      if (!hadUser) {
        cachedUser = null;
      }
      return buildSession(cachedUser);
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

const authShim = {
  getSession: async () => {
    const session = await refreshSession();
    return { data: { session }, error: null };
  },
  getUser: async () => {
    if (!cachedUser) {
      await refreshSession();
    }
    return { data: { user: cachedUser }, error: null };
  },
  signInWithPassword: async ({ email, password }) => {
    try {
      const data = await fetchJson('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      cachedUser = data?.user || null;
      const session = buildSession(cachedUser);
      emit('SIGNED_IN', session);
      return { data: { user: cachedUser, session }, error: null };
    } catch (error) {
      return { data: { user: null, session: null }, error };
    }
  },
  signUp: async ({ email, password, options = {} }) => {
    try {
      const payload = {
        email,
        password,
        full_name: options?.data?.full_name,
        role: options?.data?.role,
        phone: options?.data?.phone,
      };
      const data = await fetchJson('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      cachedUser = data?.user || null;
      const session = buildSession(cachedUser);
      emit('SIGNED_IN', session);
      return { data: { user: cachedUser, session }, error: null };
    } catch (error) {
      return { data: { user: null, session: null }, error };
    }
  },
  signOut: async () => {
    try {
      await fetchJson('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      cachedUser = null;
      emit('SIGNED_OUT', null);
    }
    return { error: null };
  },
  updateUser: async ({ password, data } = {}) => {
    try {
      if (password) {
        await fetchJson('/api/auth/password', {
          method: 'PATCH',
          body: JSON.stringify({ new_password: password }),
        });
      }
      if (!cachedUser) {
        await refreshSession();
      }
      return { data: { user: cachedUser }, error: null };
    } catch (error) {
      return { data: { user: cachedUser }, error };
    }
  },
  setSession: async () => {
    const session = await refreshSession();
    emit('TOKEN_REFRESHED', session);
    return { data: { session }, error: null };
  },
  onAuthStateChange: (callback) => {
    listeners.add(callback);
    return {
      data: {
        subscription: {
          unsubscribe: () => listeners.delete(callback),
        },
      },
    };
  },
};

const customSupabaseClient = baseClient;
customSupabaseClient.auth = authShim;

export default customSupabaseClient;

export {
  customSupabaseClient,
  customSupabaseClient as supabase,
};
