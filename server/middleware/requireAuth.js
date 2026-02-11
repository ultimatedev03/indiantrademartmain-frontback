import {
  getAuthCookieNames,
  getCookie,
  normalizeRole,
  verifyAuthToken,
} from '../lib/auth.js';

function parseBearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (!header || typeof header !== 'string') return null;
  if (!header.startsWith('Bearer ')) return null;
  return header.replace('Bearer ', '').trim();
}

function isSafeMethod(method) {
  const m = String(method || '').toUpperCase();
  return m === 'GET' || m === 'HEAD' || m === 'OPTIONS';
}

export function requireAuth({ roles = [] } = {}) {
  const allowedRoles = (roles || []).map(normalizeRole).filter(Boolean);

  return (req, res, next) => {
    try {
      if (String(req.method || '').toUpperCase() === 'OPTIONS') {
        return next();
      }
      const { AUTH_COOKIE_NAME, CSRF_COOKIE_NAME } = getAuthCookieNames();
      const token = getCookie(req, AUTH_COOKIE_NAME) || parseBearerToken(req);

      if (!token) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      const decoded = verifyAuthToken(token);
      if (!decoded?.sub) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      // CSRF check for mutating requests
      if (!isSafeMethod(req.method)) {
        const csrfCookie = getCookie(req, CSRF_COOKIE_NAME);
        const csrfHeader =
          req.headers['x-csrf-token'] ||
          req.headers['x-xsrf-token'] ||
          req.headers['csrf-token'];

        if (!csrfCookie || !csrfHeader || String(csrfCookie) !== String(csrfHeader)) {
          return res.status(403).json({ success: false, error: 'CSRF token mismatch' });
        }
      }

      const role = normalizeRole(decoded.role || 'USER');
      if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }

      req.user = {
        id: decoded.sub,
        email: decoded.email || null,
        role,
        type: decoded.type || 'USER',
      };

      req.actor = {
        id: decoded.sub,
        type: decoded.type || 'USER',
        role,
        email: decoded.email || null,
      };

      return next();
    } catch (error) {
      console.error('[Auth] requireAuth failed:', error?.message || error);
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
  };
}
