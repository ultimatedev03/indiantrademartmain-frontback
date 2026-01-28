const SUPERADMIN_TOKEN_KEY = 'itm_superadmin_token';
const SUPERADMIN_SESSION_KEY = 'itm_superadmin_session';

export function getSuperAdminToken() {
  try {
    return localStorage.getItem(SUPERADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setSuperAdminToken(token) {
  try {
    if (!token) localStorage.removeItem(SUPERADMIN_TOKEN_KEY);
    else localStorage.setItem(SUPERADMIN_TOKEN_KEY, token);
  } catch {
    // ignore storage errors
  }
}

export function clearSuperAdminSession() {
  try {
    localStorage.removeItem(SUPERADMIN_TOKEN_KEY);
    localStorage.removeItem(SUPERADMIN_SESSION_KEY);
  } catch {
    // ignore storage errors
  }
}

export function getSuperAdminBase() {
  const override = import.meta.env.VITE_SUPERADMIN_API_BASE;
  if (override && String(override).trim()) return String(override).trim();
  return '/api/superadmin';
}

export async function superAdminFetch(path, options = {}) {
  const token = getSuperAdminToken();
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const base = getSuperAdminBase();
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;

  return fetch(url, {
    ...options,
    headers,
  });
}

export const SUPERADMIN_KEYS = {
  token: SUPERADMIN_TOKEN_KEY,
  session: SUPERADMIN_SESSION_KEY,
};

