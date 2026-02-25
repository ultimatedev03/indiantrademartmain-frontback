import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'itm_access';
const CSRF_COOKIE_NAME = process.env.AUTH_CSRF_COOKIE || 'itm_csrf';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  // eslint-disable-next-line no-console
  console.error(
    '[Notifications] Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
  );
}

const supabase = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_ROLE_KEY || '', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const BUYER_NOTIF_PREFIX = 'buyer_notif:';
const AUTH_LOOKUP_CACHE_TTL_MS = 60 * 1000;

const toBuyerNotifId = (id) => `${BUYER_NOTIF_PREFIX}${id}`;
const isBuyerNotifId = (id) => String(id || '').startsWith(BUYER_NOTIF_PREFIX);
const fromBuyerNotifId = (id) => String(id || '').replace(BUYER_NOTIF_PREFIX, '');
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizeId = (value) => String(value || '').trim();

let authLookupCacheAt = 0;
let authLookupByEmail = new Map();
let warnedMissingJwtSecret = false;

const getOrigin = (event) => event?.headers?.origin || event?.headers?.Origin || '*';

const baseHeaders = (event) => ({
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': getOrigin(event),
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, X-XSRF-Token, csrf-token',
  'Access-Control-Allow-Methods': 'GET,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  Vary: 'Origin',
});

const json = (event, statusCode, body) => ({
  statusCode,
  headers: baseHeaders(event),
  body: JSON.stringify(body),
});

const ok = (event, body) => json(event, 200, body);
const bad = (event, msg, details = null, statusCode = 400) =>
  json(event, statusCode, { success: false, error: msg, details });
const unauthorized = (event, msg = 'Unauthorized') => bad(event, msg, null, 401);

const parseTail = (eventPath) => {
  const parts = String(eventPath || '').split('/').filter(Boolean);
  const idx = parts.lastIndexOf('notifications');
  return idx >= 0 ? parts.slice(idx + 1) : parts;
};

const readBody = (event) => {
  if (!event?.body) return {};
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const toValuesArray = (value) => {
  if (Array.isArray(value)) return value.flatMap((entry) => toValuesArray(entry));
  if (value === null || value === undefined) return [];
  return [value];
};

const parseIdValues = (value) =>
  toValuesArray(value)
    .flatMap((entry) => String(entry || '').split(','))
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);

const resolveIdsFromEvent = (event) => {
  const body = readBody(event);
  const query = event?.queryStringParameters || {};
  const multiQuery = event?.multiValueQueryStringParameters || {};

  const bodyIds = Array.isArray(body?.ids) ? body.ids : parseIdValues(body?.id);
  const queryIds = [
    ...parseIdValues(query?.ids),
    ...parseIdValues(query?.id),
    ...parseIdValues(multiQuery?.ids),
    ...parseIdValues(multiQuery?.id),
  ];

  return Array.from(
    new Set(
      [...bodyIds, ...queryIds]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  );
};

const parseCookies = (cookieHeader = '') => {
  const out = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return out;
  cookieHeader.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx < 0) return;
    const key = decodeURIComponent(part.slice(0, idx).trim());
    const value = decodeURIComponent(part.slice(idx + 1).trim());
    if (key) out[key] = value;
  });
  return out;
};

const getCookie = (event, name) => {
  const header = event?.headers?.cookie || event?.headers?.Cookie || '';
  const cookies = parseCookies(header);
  return cookies[name];
};

const parseBearerToken = (headers = {}) => {
  const header = headers.Authorization || headers.authorization;
  if (!header || typeof header !== 'string') return null;
  if (!header.startsWith('Bearer ')) return null;
  return header.replace('Bearer ', '').trim();
};

const isSafeMethod = (method) => {
  const m = String(method || '').toUpperCase();
  return m === 'GET' || m === 'HEAD' || m === 'OPTIONS';
};

const getJwtSecret = () => {
  const secret =
    process.env.JWT_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    throw new Error('Missing JWT_SECRET (or fallback secret) in environment');
  }

  if (!process.env.JWT_SECRET && !warnedMissingJwtSecret) {
    // eslint-disable-next-line no-console
    console.warn(
      '[Notifications] JWT_SECRET missing. Falling back to another secret. Configure a dedicated JWT_SECRET.'
    );
    warnedMissingJwtSecret = true;
  }

  return secret;
};

const verifyAuthToken = (token) => {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch {
    return null;
  }
};

const requireAuth = (event) => {
  const tokenFromBearer = parseBearerToken(event?.headers || {});
  const tokenFromCookie = getCookie(event, AUTH_COOKIE_NAME);
  const token = tokenFromBearer || tokenFromCookie;
  const tokenSource = tokenFromBearer ? 'bearer' : tokenFromCookie ? 'cookie' : null;

  if (!token) return { error: unauthorized(event) };

  const decoded = verifyAuthToken(token);
  if (!decoded?.sub) return { error: unauthorized(event) };

  if (!isSafeMethod(event?.httpMethod) && tokenSource !== 'bearer') {
    const csrfCookie = getCookie(event, CSRF_COOKIE_NAME);
    const csrfHeader =
      event?.headers?.['x-csrf-token'] ||
      event?.headers?.['x-xsrf-token'] ||
      event?.headers?.['csrf-token'];

    if (!csrfCookie || !csrfHeader || String(csrfCookie) !== String(csrfHeader)) {
      return { error: bad(event, 'CSRF token mismatch', null, 403) };
    }
  }

  return {
    user: {
      id: decoded.sub,
      email: decoded.email || null,
      role: decoded.role || 'USER',
      type: decoded.type || 'USER',
    },
  };
};

const resolveBuyerNotificationLink = (row = {}) => {
  const type = String(row?.type || '').trim().toUpperCase();
  const referenceId = String(row?.reference_id || '').trim();

  if (type === 'PROPOSAL_MESSAGE') {
    return referenceId ? `/buyer/messages?proposal=${referenceId}` : '/buyer/messages';
  }

  if (type === 'SUPPORT_MESSAGE' || type.startsWith('SUPPORT_')) {
    return '/buyer/tickets';
  }

  if (referenceId) {
    return `/buyer/proposals/${referenceId}`;
  }

  return '/buyer/proposals';
};

const mapBuyerNotificationRow = (row = {}) => ({
  ...row,
  id: toBuyerNotifId(row.id),
  link: resolveBuyerNotificationLink(row),
});

const loadAuthLookupByEmail = async ({ force = false } = {}) => {
  const now = Date.now();
  if (
    !force &&
    authLookupByEmail.size > 0 &&
    now - authLookupCacheAt <= AUTH_LOOKUP_CACHE_TTL_MS
  ) {
    return authLookupByEmail;
  }

  const emailMap = new Map();

  try {
    let page = 1;
    const perPage = 50;
    let errorPages = 0;

    while (true) {
      const paged = await supabase.auth.admin.listUsers({ page, perPage });
      const pagedError = paged?.error || null;
      const pagedUsers = Array.isArray(paged?.data?.users) ? paged.data.users : [];

      if (pagedError) {
        errorPages += 1;

        if (page === 1) {
          const fallback = await supabase.auth.admin.listUsers();
          if (!fallback?.error && Array.isArray(fallback?.data?.users)) {
            fallback.data.users.forEach((user) => {
              const email = normalizeEmail(user?.email);
              const id = normalizeId(user?.id);
              if (email && id) emailMap.set(email, id);
            });
          }
          break;
        }

        if (errorPages >= 5) break;
        page += 1;
        if (page > 50) break;
        continue;
      }

      errorPages = 0;
      pagedUsers.forEach((user) => {
        const email = normalizeEmail(user?.email);
        const id = normalizeId(user?.id);
        if (email && id) emailMap.set(email, id);
      });

      if (pagedUsers.length < perPage) break;
      page += 1;
      if (page > 50) break;
    }
  } catch {
    // keep previous cache on refresh failure
  }

  if (emailMap.size > 0) {
    authLookupByEmail = emailMap;
    authLookupCacheAt = now;
  } else if (force) {
    authLookupCacheAt = now;
  }

  return authLookupByEmail;
};

const resolveAuthUserIdByEmail = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const cached = await loadAuthLookupByEmail();
  if (cached.has(normalizedEmail)) {
    return cached.get(normalizedEmail);
  }

  const refreshed = await loadAuthLookupByEmail({ force: true });
  return refreshed.get(normalizedEmail) || null;
};

const resolveCurrentUserIds = async (reqUser = {}) => {
  const authUserId = normalizeId(reqUser?.id);
  const email = normalizeEmail(reqUser?.email || '');
  const idSet = new Set();
  const emailSet = new Set();

  if (authUserId) {
    idSet.add(authUserId);

    const { data: byId } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', authUserId)
      .maybeSingle();

    if (byId?.id) idSet.add(normalizeId(byId.id));
    const mappedEmail = normalizeEmail(byId?.email);
    if (mappedEmail) emailSet.add(mappedEmail);
  }

  if (email) {
    emailSet.add(email);

    const { data: byEmail } = await supabase
      .from('users')
      .select('id, email')
      .ilike('email', email)
      .order('updated_at', { ascending: false })
      .limit(5);

    (byEmail || []).forEach((row) => {
      const rowId = normalizeId(row?.id);
      if (rowId) idSet.add(rowId);
      const rowEmail = normalizeEmail(row?.email);
      if (rowEmail) emailSet.add(rowEmail);
    });
  }

  const profileFilters = [];
  if (authUserId) profileFilters.push(`user_id.eq.${authUserId}`);
  if (email) profileFilters.push(`email.eq.${email}`);
  const profileFilter = profileFilters.join(',');

  if (profileFilter) {
    const profileQueries = ['employees', 'vendors', 'buyers'].map((table) =>
      supabase.from(table).select('user_id, email').or(profileFilter).limit(5)
    );

    const profileResults = await Promise.all(profileQueries);
    profileResults.forEach((result) => {
      (result?.data || []).forEach((row) => {
        const profileUserId = normalizeId(row?.user_id);
        if (profileUserId) idSet.add(profileUserId);
        const profileEmail = normalizeEmail(row?.email);
        if (profileEmail) emailSet.add(profileEmail);
      });
    });
  }

  const authIds = await Promise.all(
    Array.from(emailSet).map((targetEmail) => resolveAuthUserIdByEmail(targetEmail))
  );
  authIds.forEach((id) => {
    const normalizedId = normalizeId(id);
    if (normalizedId) idSet.add(normalizedId);
  });

  return Array.from(idSet);
};

const resolveBuyerIdForUser = async (reqUser = {}, candidateUserIds = []) => {
  const email = normalizeEmail(reqUser?.email || '');
  const ids = Array.from(
    new Set((candidateUserIds || []).map((v) => String(v || '').trim()).filter(Boolean))
  );

  if (ids.length > 0) {
    const { data: rows } = await supabase
      .from('buyers')
      .select('id')
      .in('user_id', ids)
      .order('created_at', { ascending: false })
      .limit(1);

    if (Array.isArray(rows) && rows[0]?.id) return rows[0].id;
  }

  if (email) {
    const { data: byEmailRows } = await supabase
      .from('buyers')
      .select('id')
      .ilike('email', email)
      .order('created_at', { ascending: false })
      .limit(1);

    if (Array.isArray(byEmailRows) && byEmailRows[0]?.id) return byEmailRows[0].id;
  }

  return null;
};

const listNotifications = async (event, user) => {
  const requestedLimit = Number(event?.queryStringParameters?.limit || 100);
  const limit =
    Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(200, Math.floor(requestedLimit))
      : 100;

  const userIds = await resolveCurrentUserIds(user);
  if (!userIds.length) return ok(event, { success: true, notifications: [] });

  let query = supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (userIds.length === 1) {
    query = query.eq('user_id', userIds[0]);
  } else {
    query = query.in('user_id', userIds);
  }

  const { data: systemRows, error: systemError } = await query;
  if (systemError) {
    return bad(
      event,
      systemError.message || 'Failed to load notifications',
      null,
      500
    );
  }

  let merged = Array.isArray(systemRows) ? [...systemRows] : [];
  const buyerId = await resolveBuyerIdForUser(user, userIds);

  if (buyerId) {
    const { data: buyerRows, error: buyerError } = await supabase
      .from('buyer_notifications')
      .select('*')
      .eq('buyer_id', buyerId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (buyerError) {
      return bad(
        event,
        buyerError.message || 'Failed to load buyer notifications',
        null,
        500
      );
    }

    merged = [...merged, ...(buyerRows || []).map(mapBuyerNotificationRow)];
  }

  merged.sort(
    (a, b) =>
      new Date(b?.created_at || 0).getTime() -
      new Date(a?.created_at || 0).getTime()
  );

  return ok(event, { success: true, notifications: merged });
};

const markRead = async (event, user) => {
  const normalizedIds = resolveIdsFromEvent(event);

  if (normalizedIds.length === 0) return ok(event, { success: true });

  const userIds = await resolveCurrentUserIds(user);
  const buyerId = await resolveBuyerIdForUser(user, userIds);

  const buyerIds = normalizedIds
    .filter((id) => isBuyerNotifId(id))
    .map((id) => fromBuyerNotifId(id));
  const normalIds = normalizedIds.filter((id) => !isBuyerNotifId(id));

  if (normalIds.length > 0) {
    let query = supabase.from('notifications').update({ is_read: true }).in('id', normalIds);

    if (userIds.length === 1) {
      query = query.eq('user_id', userIds[0]);
    } else if (userIds.length > 1) {
      query = query.in('user_id', userIds);
    }

    const { error } = await query;
    if (error) {
      return bad(
        event,
        error.message || 'Failed to mark notifications as read',
        null,
        500
      );
    }
  }

  if (buyerIds.length > 0 && buyerId) {
    const { error } = await supabase
      .from('buyer_notifications')
      .update({ is_read: true })
      .eq('buyer_id', buyerId)
      .in('id', buyerIds);

    if (error) {
      return bad(
        event,
        error.message || 'Failed to mark buyer notifications as read',
        null,
        500
      );
    }
  }

  return ok(event, { success: true });
};

const deleteNotifications = async (event, user) => {
  const normalizedIds = resolveIdsFromEvent(event);

  if (normalizedIds.length === 0) return ok(event, { success: true });

  const userIds = await resolveCurrentUserIds(user);
  const buyerId = await resolveBuyerIdForUser(user, userIds);

  const buyerIds = normalizedIds
    .filter((id) => isBuyerNotifId(id))
    .map((id) => fromBuyerNotifId(id));
  const normalIds = normalizedIds.filter((id) => !isBuyerNotifId(id));

  if (normalIds.length > 0) {
    let query = supabase.from('notifications').delete().in('id', normalIds);

    if (userIds.length === 1) {
      query = query.eq('user_id', userIds[0]);
    } else if (userIds.length > 1) {
      query = query.in('user_id', userIds);
    }

    const { error } = await query;
    if (error) {
      return bad(event, error.message || 'Failed to delete notifications', null, 500);
    }
  }

  if (buyerIds.length > 0 && buyerId) {
    const { error } = await supabase
      .from('buyer_notifications')
      .delete()
      .eq('buyer_id', buyerId)
      .in('id', buyerIds);

    if (error) {
      return bad(
        event,
        error.message || 'Failed to delete buyer notifications',
        null,
        500
      );
    }
  }

  return ok(event, { success: true });
};

export const handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') return ok(event, { ok: true });

    const tail = parseTail(event.path);
    const auth = requireAuth(event);
    if (auth.error) return auth.error;

    if (event.httpMethod === 'GET' && tail.length === 1 && tail[0] === 'list') {
      return listNotifications(event, auth.user);
    }

    if (event.httpMethod === 'PATCH' && tail.length === 1 && tail[0] === 'read') {
      return markRead(event, auth.user);
    }

    if (event.httpMethod === 'DELETE' && tail.length === 0) {
      return deleteNotifications(event, auth.user);
    }

    if (!['GET', 'PATCH', 'DELETE'].includes(event.httpMethod)) {
      return bad(event, 'Method not allowed', null, 405);
    }

    return bad(event, 'Not found', null, 404);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Notifications] Function failed:', error?.message || error);
    return bad(
      event,
      error?.message || 'Failed to handle notifications',
      null,
      500
    );
  }
};
