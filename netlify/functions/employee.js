import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'itm_access';

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
  },
  body: JSON.stringify(body),
});

const getSupabase = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
};

const parseBearerToken = (headers = {}) => {
  const header = headers.Authorization || headers.authorization;
  if (!header || typeof header !== 'string') return null;
  if (!header.startsWith('Bearer ')) return null;
  return header.replace('Bearer ', '').trim();
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
      '[Employee] JWT_SECRET missing. Falling back to another secret. Configure a dedicated JWT_SECRET.'
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

const normalizeRole = (role) => String(role || '').trim().toUpperCase();

export const handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
    if (event.httpMethod !== 'GET') return json(405, { success: false, error: 'Method not allowed' });

    const supabase = getSupabase();
    const bearer = parseBearerToken(event.headers || {});
    const cookieToken = getCookie(event, AUTH_COOKIE_NAME);

    let authUserId = null;
    let email = '';

    if (bearer) {
      const { data: authData, error: authError } = await supabase.auth.getUser(bearer);
      if (authError || !authData?.user) return json(401, { success: false, error: 'Invalid auth token' });
      authUserId = authData.user.id;
      email = String(authData.user?.email || '').trim().toLowerCase();
    } else if (cookieToken) {
      const decoded = verifyAuthToken(cookieToken);
      if (!decoded?.sub) return json(401, { success: false, error: 'Invalid auth token' });
      authUserId = decoded.sub;
      email = String(decoded?.email || '').trim().toLowerCase();
    } else {
      return json(401, { success: false, error: 'Missing auth token' });
    }

    let employee = null;
    const { data: byId } = await supabase
      .from('employees')
      .select('*')
      .eq('user_id', authUserId)
      .maybeSingle();
    if (byId) employee = byId;

    if (!employee && email) {
      const { data: byEmail } = await supabase
        .from('employees')
        .select('*')
        .eq('email', email)
        .maybeSingle();
      if (byEmail) employee = byEmail;
    }

    if (!employee) return json(404, { success: false, error: 'Employee profile not found' });

    if (!employee.user_id || employee.user_id !== authUserId) {
      await supabase
        .from('employees')
        .update({ user_id: authUserId })
        .eq('id', employee.id);
    }

    return json(200, {
      success: true,
      employee: { ...employee, user_id: authUserId, role: normalizeRole(employee.role || 'UNKNOWN') },
    });
  } catch (error) {
    return json(500, { success: false, error: error.message || 'Failed to resolve employee profile' });
  }
};
