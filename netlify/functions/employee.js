import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'itm_access';
const CSRF_COOKIE_NAME = process.env.AUTH_CSRF_COOKIE || 'itm_csrf';

const CATEGORY_IMAGE_BUCKET = 'avatars';
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const EMPLOYEE_UPLOAD_ROLES = new Set(['DATA_ENTRY', 'ADMIN', 'SUPERADMIN', 'HR', 'SUPPORT']);

const MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

const getOrigin = (event) =>
  event?.headers?.origin ||
  event?.headers?.Origin ||
  '*';

const json = (event, statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': getOrigin(event),
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
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

const normalizeRole = (role) => {
  const raw = String(role || '').trim().toUpperCase();
  if (!raw) return '';
  if (raw === 'DATAENTRY') return 'DATA_ENTRY';
  if (raw === 'FINACE') return 'FINANCE';
  return raw;
};

const parseTail = (eventPath) => {
  const parts = String(eventPath || '').split('/').filter(Boolean);
  const fnIndex = parts.indexOf('employee');
  if (fnIndex >= 0) return parts.slice(fnIndex + 1);
  return parts;
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

const parseDataUrl = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (raw.startsWith('data:')) {
    const match = raw.match(/^data:([^;]+);base64,(.*)$/);
    if (!match) return null;
    return { mime: match[1], base64: match[2] };
  }
  return { mime: null, base64: raw };
};

const safeSlug = (value = '') =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'category';

const sanitizeFilename = (name = '') =>
  String(name || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^_+/, '')
    .slice(0, 120) || 'upload';

const normalizeLevel = (value = '') => {
  const level = String(value || '').trim().toLowerCase();
  if (['head', 'sub', 'micro'].includes(level)) return level;
  return 'head';
};

const buildCategoryImagePath = ({ level, slug, originalName, contentType }) => {
  const safeName = sanitizeFilename(originalName || '');
  const extFromMime = MIME_EXT[contentType] || 'png';
  const hasExt = safeName.includes('.');
  const base = hasExt ? safeName.replace(/\.[^/.]+$/, '') : safeName;
  const ext = hasExt ? safeName.split('.').pop() : extFromMime;
  return `category-images/${normalizeLevel(level)}/${safeSlug(slug)}/${Date.now()}-${randomUUID()}-${base || 'category'}.${ext}`;
};

const resolveAuthIdentity = async (event, supabase) => {
  const bearer = parseBearerToken(event.headers || {});
  const cookieToken = getCookie(event, AUTH_COOKIE_NAME);

  if (bearer) {
    const { data, error } = await supabase.auth.getUser(bearer);
    if (error || !data?.user) return null;
    return {
      id: data.user.id,
      email: String(data.user?.email || '').trim().toLowerCase(),
    };
  }

  if (cookieToken) {
    const decoded = verifyAuthToken(cookieToken);
    if (!decoded?.sub) return null;
    return {
      id: decoded.sub,
      email: String(decoded?.email || '').trim().toLowerCase(),
    };
  }

  return null;
};

const resolveEmployee = async (supabase, authIdentity) => {
  const authUserId = authIdentity?.id || null;
  const email = String(authIdentity?.email || '').trim().toLowerCase();
  if (!authUserId) return null;

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

  if (employee && (!employee.user_id || employee.user_id !== authUserId)) {
    await supabase
      .from('employees')
      .update({ user_id: authUserId })
      .eq('id', employee.id);
    employee.user_id = authUserId;
  }

  return employee;
};

export const handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') return json(event, 200, { ok: true });

    const supabase = getSupabase();
    const tail = parseTail(event.path);
    const endpoint = tail.join('/');

    if (!endpoint) return json(event, 404, { success: false, error: 'Not found' });

    const authIdentity = await resolveAuthIdentity(event, supabase);
    if (!authIdentity) return json(event, 401, { success: false, error: 'Unauthorized' });

    const employee = await resolveEmployee(supabase, authIdentity);
    if (!employee) return json(event, 404, { success: false, error: 'Employee profile not found' });

    if (event.httpMethod === 'GET' && endpoint === 'me') {
      return json(event, 200, {
        success: true,
        employee: {
          ...employee,
          user_id: authIdentity.id,
          role: normalizeRole(employee.role || 'UNKNOWN'),
        },
      });
    }

    if (event.httpMethod === 'POST' && endpoint === 'upload-category-image') {
      if (!isSafeMethod(event.httpMethod) && !ensureCsrfValid(event)) {
        return json(event, 403, { success: false, error: 'CSRF token mismatch' });
      }

      const employeeRole = normalizeRole(employee.role || '');
      if (!EMPLOYEE_UPLOAD_ROLES.has(employeeRole)) {
        return json(event, 403, { success: false, error: 'Forbidden' });
      }

      const body = readBody(event);
      const dataUrl = String(body?.data_url || body?.dataUrl || '').trim();
      const fileName = String(body?.file_name || body?.fileName || '').trim();
      const explicitType = String(body?.content_type || body?.contentType || '').trim();
      const level = normalizeLevel(body?.level || 'head');
      const slug = String(body?.slug || '').trim();

      if (!dataUrl) return json(event, 400, { success: false, error: 'data_url is required' });

      const parsed = parseDataUrl(dataUrl);
      if (!parsed?.base64) return json(event, 400, { success: false, error: 'Invalid base64 payload' });

      const contentType = explicitType || parsed.mime || 'application/octet-stream';
      if (!contentType.startsWith('image/')) {
        return json(event, 400, { success: false, error: 'Only image uploads are supported' });
      }

      const buffer = Buffer.from(parsed.base64, 'base64');
      if (!buffer?.length) return json(event, 400, { success: false, error: 'Empty upload payload' });
      if (buffer.length > MAX_UPLOAD_BYTES) {
        return json(event, 413, { success: false, error: 'File too large (max 10MB)' });
      }

      const objectPath = buildCategoryImagePath({
        level,
        slug,
        originalName: fileName,
        contentType,
      });

      const { error: uploadError } = await supabase.storage
        .from(CATEGORY_IMAGE_BUCKET)
        .upload(objectPath, buffer, {
          contentType,
          upsert: true,
        });

      if (uploadError) {
        return json(event, 500, { success: false, error: uploadError.message || 'Upload failed' });
      }

      const { data } = supabase.storage.from(CATEGORY_IMAGE_BUCKET).getPublicUrl(objectPath);
      return json(event, 200, {
        success: true,
        publicUrl: data?.publicUrl || null,
        bucket: CATEGORY_IMAGE_BUCKET,
        path: objectPath,
        level,
      });
    }

    return json(event, 404, { success: false, error: 'Not found' });
  } catch (error) {
    return json(event, 500, { success: false, error: error.message || 'Failed to resolve employee profile' });
  }
};
