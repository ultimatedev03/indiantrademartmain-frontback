import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'crypto';

const ENABLE_SUPABASE_AUTH_MIGRATION =
  String(process.env.ENABLE_SUPABASE_AUTH_MIGRATION || 'true').toLowerCase() !== 'false';

const ENABLE_SUPABASE_AUTH_SIGNUP =
  String(process.env.ENABLE_SUPABASE_AUTH_SIGNUP || 'true').toLowerCase() !== 'false';

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'itm_access';
const CSRF_COOKIE_NAME = process.env.AUTH_CSRF_COOKIE || 'itm_csrf';
const AUTH_COOKIE_DOMAIN = process.env.AUTH_COOKIE_DOMAIN || '';
const AUTH_TOKEN_TTL = process.env.AUTH_TOKEN_TTL || '7d';
const AUTH_COOKIE_MAX_AGE_DAYS = Number(process.env.AUTH_COOKIE_MAX_AGE_DAYS || 7);

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  // eslint-disable-next-line no-console
  console.error('[Auth] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_ROLE_KEY || '', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const supabaseAnon = SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL || '', SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  : null;

const isValidEmail = (email) => !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const normalizeRole = (role) => {
  const raw = String(role || '').trim().toUpperCase();
  if (!raw) return '';
  if (raw === 'DATAENTRY') return 'DATA_ENTRY';
  if (raw === 'FINACE') return 'FINANCE';
  return raw;
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
  const cookies = parseCookies(event?.headers?.cookie || event?.headers?.Cookie || '');
  return cookies[name];
};

const createCsrfToken = () => randomBytes(24).toString('hex');

let warnedMissingJwtSecret = false;

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
      '[Auth] JWT_SECRET missing. Falling back to another secret. Configure a dedicated JWT_SECRET.'
    );
    warnedMissingJwtSecret = true;
  }

  return secret;
};

const signAuthToken = (payload) => jwt.sign(payload, getJwtSecret(), { expiresIn: AUTH_TOKEN_TTL });

const verifyAuthToken = (token) => {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch {
    return null;
  }
};

const isBcryptHash = (value) => typeof value === 'string' && value.startsWith('$2');

const hashPassword = async (password) => {
  if (!password) return '';
  return bcrypt.hash(String(password), 10);
};

const verifyPassword = async (password, storedHash) => {
  if (!password || !storedHash) return false;
  if (isBcryptHash(storedHash)) {
    return bcrypt.compare(String(password), storedHash);
  }
  return String(password) === String(storedHash);
};

const serializeCookie = (name, value, options = {}) => {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value || '')}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  if (options.expires instanceof Date) parts.push(`Expires=${options.expires.toUTCString()}`);
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  return parts.join('; ');
};

const cookieOptions = ({ httpOnly }) => {
  const isProd = process.env.NODE_ENV === 'production';
  const opts = {
    httpOnly,
    secure: isProd,
    sameSite: 'Lax',
    path: '/',
  };
  if (AUTH_COOKIE_DOMAIN) opts.domain = AUTH_COOKIE_DOMAIN;
  return opts;
};

const setAuthCookies = (token, csrfToken) => {
  const maxAgeSec = Math.max(1, AUTH_COOKIE_MAX_AGE_DAYS) * 24 * 60 * 60;
  return [
    serializeCookie(AUTH_COOKIE_NAME, token, {
      ...cookieOptions({ httpOnly: true }),
      maxAge: maxAgeSec,
    }),
    serializeCookie(CSRF_COOKIE_NAME, csrfToken, {
      ...cookieOptions({ httpOnly: false }),
      maxAge: maxAgeSec,
    }),
  ];
};

const clearAuthCookies = () => {
  const base = { ...cookieOptions({ httpOnly: true }), maxAge: 0, expires: new Date(0) };
  const baseCsrf = { ...cookieOptions({ httpOnly: false }), maxAge: 0, expires: new Date(0) };
  return [
    serializeCookie(AUTH_COOKIE_NAME, '', base),
    serializeCookie(CSRF_COOKIE_NAME, '', baseCsrf),
  ];
};

const buildAuthUserPayload = (user) => {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    role: normalizeRole(user.role || 'USER'),
    full_name: user.full_name || user.email?.split('@')[0],
    user_metadata: {
      full_name: user.full_name || user.email?.split('@')[0],
      role: normalizeRole(user.role || 'USER'),
    },
    app_metadata: {
      role: normalizeRole(user.role || 'USER'),
    },
  };
};

const getOrigin = (event) =>
  event?.headers?.origin ||
  event?.headers?.Origin ||
  '*';

const baseHeaders = (event) => ({
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': getOrigin(event),
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Vary': 'Origin',
});

const json = (event, statusCode, body, cookies = []) => {
  const response = {
    statusCode,
    headers: baseHeaders(event),
    body: JSON.stringify(body),
  };
  if (cookies.length > 0) {
    response.multiValueHeaders = { 'Set-Cookie': cookies };
  }
  return response;
};

const ok = (event, body, cookies) => json(event, 200, body, cookies);
const bad = (event, msg, details, statusCode = 400) =>
  json(event, statusCode, { success: false, error: msg, details });
const unauthorized = (event, msg) => bad(event, msg || 'Unauthorized', null, 401);
const forbidden = (event, msg) => bad(event, msg || 'Forbidden', null, 403);
const fail = (event, msg, details) => json(event, 500, { success: false, error: msg, details });

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

const parseTail = (eventPath) => {
  const parts = String(eventPath || '').split('/').filter(Boolean);
  const fnIndex = parts.indexOf('auth');
  if (fnIndex >= 0) return parts.slice(fnIndex + 1);
  return parts;
};

const ensureUserRole = async (user) => {
  if (!user?.id) return user;
  const resolvedRole = await resolveRoleForUser({
    userId: user.id,
    email: user.email,
    fallbackRole: user.role,
  });

  if (resolvedRole && normalizeRole(user.role) !== normalizeRole(resolvedRole)) {
    return upsertPublicUser({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: resolvedRole,
      phone: user.phone,
      password_hash: user.password_hash,
      allowPasswordUpdate: false,
    });
  }

  return user;
};

const resolveRoleForUser = async ({ userId, email, fallbackRole }) => {
  const fallback = normalizeRole(fallbackRole);
  if (fallback) return fallback;

  const targetEmail = normalizeEmail(email);

  if (userId || targetEmail) {
    const { data: emp } = await supabase
      .from('employees')
      .select('role')
      .or(
        [
          userId ? `user_id.eq.${userId}` : null,
          targetEmail ? `email.eq.${targetEmail}` : null,
        ]
          .filter(Boolean)
          .join(',')
      )
      .maybeSingle();

    if (emp?.role) return normalizeRole(emp.role);
  }

  if (userId || targetEmail) {
    const { data: vendor } = await supabase
      .from('vendors')
      .select('id')
      .or(
        [
          userId ? `user_id.eq.${userId}` : null,
          targetEmail ? `email.eq.${targetEmail}` : null,
        ]
          .filter(Boolean)
          .join(',')
      )
      .maybeSingle();

    if (vendor?.id) return 'VENDOR';
  }

  if (userId || targetEmail) {
    const { data: buyer } = await supabase
      .from('buyers')
      .select('id')
      .or(
        [
          userId ? `user_id.eq.${userId}` : null,
          targetEmail ? `email.eq.${targetEmail}` : null,
        ]
          .filter(Boolean)
          .join(',')
      )
      .maybeSingle();

    if (buyer?.id) return 'BUYER';
  }

  return 'USER';
};

const getPublicUserByEmail = async (email) => {
  const target = normalizeEmail(email);
  if (!target) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', target)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data || null;
};

const getPublicUserById = async (userId) => {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
};

const upsertPublicUser = async ({
  id,
  email,
  full_name,
  role,
  phone,
  password_hash,
  allowPasswordUpdate = false,
}) => {
  const nowIso = new Date().toISOString();
  const targetEmail = normalizeEmail(email);
  if (!targetEmail) throw new Error('Email is required');

  const existing = await getPublicUserByEmail(targetEmail);
  if (existing) {
    const updates = { updated_at: nowIso };
    if (full_name && full_name !== existing.full_name) updates.full_name = full_name;
    if (role && normalizeRole(role) !== normalizeRole(existing.role)) updates.role = normalizeRole(role);
    if (phone && phone !== existing.phone) updates.phone = phone;
    if (password_hash && (allowPasswordUpdate || !existing.password_hash)) {
      updates.password_hash = password_hash;
    }

    if (Object.keys(updates).length > 1) {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', existing.id)
        .select('*')
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data || { ...existing, ...updates };
    }
    return existing;
  }

  const newId = id || randomUUID();
  const payload = {
    id: newId,
    email: targetEmail,
    full_name: full_name || targetEmail.split('@')[0],
    role: normalizeRole(role) || 'USER',
    phone: phone || null,
    password_hash: password_hash || null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const { data, error } = await supabase
    .from('users')
    .insert([payload])
    .select('*')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || payload;
};

const setPublicUserPassword = async (userId, password) => {
  if (!userId) throw new Error('Missing user id');
  const password_hash = await hashPassword(password);
  const { data, error } = await supabase
    .from('users')
    .update({
      password_hash,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select('*')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
};

const syncProfileUserId = async (userId, email) => {
  if (!userId || !email) return;
  const targetEmail = normalizeEmail(email);

  await supabase.from('employees').update({ user_id: userId }).eq('email', targetEmail).is('user_id', null);
  await supabase.from('vendors').update({ user_id: userId }).eq('email', targetEmail).is('user_id', null);
  await supabase.from('buyers').update({ user_id: userId }).eq('email', targetEmail).is('user_id', null);
};

const assertUserActive = async (user) => {
  if (!user?.id) return { ok: false, error: 'User not found' };
  const role = normalizeRole(user.role || 'USER');

  if (role === 'VENDOR') {
    const { data: vendor } = await supabase
      .from('vendors')
      .select('is_active')
      .or(
        [
          `user_id.eq.${user.id}`,
          user.email ? `email.eq.${user.email}` : null,
        ]
          .filter(Boolean)
          .join(',')
      )
      .maybeSingle();
    if (!vendor) {
      return { ok: false, error: 'Vendor profile not found' };
    }
    if (vendor && vendor.is_active === false) {
      return { ok: false, error: 'Vendor account is inactive' };
    }
  }

  if (role === 'BUYER') {
    const { data: buyer } = await supabase
      .from('buyers')
      .select('is_active')
      .or(
        [
          `user_id.eq.${user.id}`,
          user.email ? `email.eq.${user.email}` : null,
        ]
          .filter(Boolean)
          .join(',')
      )
      .maybeSingle();
    if (buyer && buyer.is_active === false) {
      return { ok: false, error: 'Buyer account is inactive' };
    }
  }

  if (['ADMIN', 'HR', 'DATA_ENTRY', 'SUPPORT', 'SALES', 'FINANCE', 'SUPERADMIN'].includes(role)) {
    const { data: emp } = await supabase
      .from('employees')
      .select('status')
      .or(
        [
          `user_id.eq.${user.id}`,
          user.email ? `email.eq.${user.email}` : null,
        ]
          .filter(Boolean)
          .join(',')
      )
      .maybeSingle();
    const status = String(emp?.status || 'ACTIVE').toUpperCase();
    if (emp && status !== 'ACTIVE') {
      return { ok: false, error: 'Employee account is inactive' };
    }
  }

  return { ok: true };
};

const verifyViaSupabase = async (email, password) => {
  if (!supabaseAnon?.auth?.signInWithPassword) {
    return { user: null, error: 'Supabase anon client not available' };
  }
  const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
  if (error || !data?.user) {
    return { user: null, error: error?.message || 'Invalid credentials' };
  }
  return { user: data.user, error: null };
};

const issueSession = (user) => {
  const token = signAuthToken({
    sub: user.id,
    email: user.email,
    role: normalizeRole(user.role || 'USER'),
    type: 'USER',
  });
  const csrfToken = createCsrfToken();
  return { token, csrfToken };
};

const isSafeMethod = (method) => {
  const m = String(method || '').toUpperCase();
  return m === 'GET' || m === 'HEAD' || m === 'OPTIONS';
};

const ensureCsrfValid = (event) => {
  const cookieToken = getCookie(event, CSRF_COOKIE_NAME);
  const header =
    event.headers?.['x-csrf-token'] ||
    event.headers?.['x-xsrf-token'] ||
    event.headers?.['csrf-token'];
  return !!cookieToken && !!header && String(cookieToken) === String(header);
};

export const handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') return ok(event, { ok: true });

    const tail = parseTail(event.path);

    if (event.httpMethod === 'POST' && tail[0] === 'login') {
      const body = readBody(event);
      const email = normalizeEmail(body?.email);
      const password = String(body?.password || '');

      if (!email || !password) return bad(event, 'Email and password are required');
      if (!isValidEmail(email)) return bad(event, 'Invalid email format');

      let user = await getPublicUserByEmail(email);

      if (user?.password_hash) {
        const okPassword = await verifyPassword(password, user.password_hash);
        if (!okPassword) return unauthorized(event, 'Invalid credentials');

        if (!isBcryptHash(user.password_hash)) {
          const upgraded = await hashPassword(password);
          user = await upsertPublicUser({
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
            phone: user.phone,
            password_hash: upgraded,
            allowPasswordUpdate: true,
          });
        }
      } else if (ENABLE_SUPABASE_AUTH_MIGRATION) {
        const { user: authUser, error } = await verifyViaSupabase(email, password);
        if (!authUser) {
          return unauthorized(event, error || 'Invalid credentials');
        }

        const resolvedRole = await resolveRoleForUser({
          userId: authUser.id,
          email,
          fallbackRole: authUser?.user_metadata?.role,
        });

        const password_hash = await hashPassword(password);
        user = await upsertPublicUser({
          id: authUser.id,
          email,
          full_name: authUser?.user_metadata?.full_name,
          role: resolvedRole,
          phone: authUser?.user_metadata?.phone,
          password_hash,
          allowPasswordUpdate: true,
        });

        await syncProfileUserId(authUser.id, email);
      } else {
        return unauthorized(event, 'Invalid credentials');
      }

      user = await ensureUserRole(user);

      const activeCheck = await assertUserActive(user);
      if (!activeCheck.ok) {
        return forbidden(event, activeCheck.error || 'Account inactive');
      }

      const payload = buildAuthUserPayload(user);
      const { token, csrfToken } = issueSession(user);
      const cookies = setAuthCookies(token, csrfToken);

      return ok(event, { success: true, user: payload }, cookies);
    }

    if (event.httpMethod === 'POST' && tail[0] === 'register') {
      const body = readBody(event);
      const email = normalizeEmail(body?.email);
      const password = String(body?.password || '');
      const full_name = String(body?.full_name || '').trim() || undefined;
      const role = normalizeRole(body?.role || 'USER');
      const phone = String(body?.phone || '').trim() || undefined;

      if (!email || !password) return bad(event, 'Email and password are required');
      if (!isValidEmail(email)) return bad(event, 'Invalid email format');
      if (password.length < 6) {
        return bad(event, 'Password must be at least 6 characters long');
      }

      const existing = await getPublicUserByEmail(email);
      if (existing?.id) return bad(event, 'Email already registered', null, 409);

      let userId = null;
      if (ENABLE_SUPABASE_AUTH_SIGNUP && supabase?.auth?.admin?.createUser) {
        const { data, error } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name, role, phone },
          app_metadata: { role },
        });
        if (error || !data?.user) {
          return bad(event, error?.message || 'Auth signup failed');
        }
        userId = data.user.id;
      }

      const password_hash = await hashPassword(password);
      const user = await upsertPublicUser({
        id: userId || undefined,
        email,
        full_name,
        role,
        phone,
        password_hash,
        allowPasswordUpdate: true,
      });

      await syncProfileUserId(user.id, email);

      const payload = buildAuthUserPayload(user);
      const { token, csrfToken } = issueSession(user);
      const cookies = setAuthCookies(token, csrfToken);

      return ok(event, { success: true, user: payload }, cookies);
    }

    if (event.httpMethod === 'GET' && tail[0] === 'me') {
      const token = getCookie(event, AUTH_COOKIE_NAME);
      if (!token) return ok(event, { user: null });

      const decoded = verifyAuthToken(token);
      if (!decoded?.sub) {
        const cookies = clearAuthCookies();
        return ok(event, { user: null }, cookies);
      }

      let user = await getPublicUserById(decoded.sub);
      if (!user && decoded?.email) {
        user = await getPublicUserByEmail(decoded.email);
      }
      if (!user) return ok(event, { user: null });

      user = await ensureUserRole(user);

      const csrfExisting = getCookie(event, CSRF_COOKIE_NAME);
      if (!csrfExisting) {
        const csrfToken = createCsrfToken();
        const cookies = setAuthCookies(token, csrfToken);
        return ok(event, { user: buildAuthUserPayload(user) }, cookies);
      }

      return ok(event, { user: buildAuthUserPayload(user) });
    }

    if (event.httpMethod === 'POST' && tail[0] === 'logout') {
      const cookies = clearAuthCookies();
      return ok(event, { success: true }, cookies);
    }

    if (event.httpMethod === 'PATCH' && tail[0] === 'password') {
      if (!isSafeMethod(event.httpMethod) && !ensureCsrfValid(event)) {
        return forbidden(event, 'CSRF token mismatch');
      }

      const token = getCookie(event, AUTH_COOKIE_NAME);
      const decoded = token ? verifyAuthToken(token) : null;
      if (!decoded?.sub) return unauthorized(event, 'Unauthorized');

      const body = readBody(event);
      const currentPassword = String(body?.current_password || '');
      const newPassword = String(body?.new_password || body?.password || '');

      if (!newPassword || newPassword.length < 6) {
        return bad(event, 'Password must be at least 6 characters long');
      }

      const user = await getPublicUserById(decoded.sub);
      if (!user) return bad(event, 'User not found', null, 404);

      if (user.password_hash && currentPassword) {
        const okPassword = await verifyPassword(currentPassword, user.password_hash);
        if (!okPassword) return unauthorized(event, 'Invalid current password');
      }

      await setPublicUserPassword(user.id, newPassword);
      return ok(event, { success: true });
    }

    return bad(event, 'Not found', null, 404);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Auth] Function failed:', error?.message || error);
    return fail(event, 'Auth failed', error?.message || String(error));
  }
};
