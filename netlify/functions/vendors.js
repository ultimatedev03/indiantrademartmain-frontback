import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'itm_access';
const CSRF_COOKIE_NAME = process.env.AUTH_CSRF_COOKIE || 'itm_csrf';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=300&q=80';
const FALLBACK_SERVICE_IMAGE =
  'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=800&q=80';

const ALLOWED_UPLOAD_BUCKETS = new Set(['avatars', 'product-images', 'product-media']);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

const supabase = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_ROLE_KEY || '', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const getOrigin = (event) =>
  event?.headers?.origin ||
  event?.headers?.Origin ||
  '*';

const baseHeaders = (event) => ({
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': getOrigin(event),
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Vary': 'Origin',
});

const json = (event, statusCode, body) => ({
  statusCode,
  headers: baseHeaders(event),
  body: JSON.stringify(body),
});

const ok = (event, body) => json(event, 200, body);
const bad = (event, msg, details, statusCode = 400) =>
  json(event, statusCode, { success: false, error: msg, details });
const unauthorized = (event, msg) => bad(event, msg || 'Unauthorized', null, 401);
const forbidden = (event, msg) => bad(event, msg || 'Forbidden', null, 403);
const fail = (event, msg, details) => json(event, 500, { success: false, error: msg, details });

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
      '[Vendors] JWT_SECRET missing. Falling back to another secret. Configure a dedicated JWT_SECRET.'
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

const ensureCsrfValid = (event) => {
  const cookieToken = getCookie(event, CSRF_COOKIE_NAME);
  const header =
    event.headers?.['x-csrf-token'] ||
    event.headers?.['x-xsrf-token'] ||
    event.headers?.['csrf-token'];
  return !!cookieToken && !!header && String(cookieToken) === String(header);
};

const isSafeMethod = (method) => {
  const m = String(method || '').toUpperCase();
  return m === 'GET' || m === 'HEAD' || m === 'OPTIONS';
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

const parseTail = (eventPath) => {
  const parts = String(eventPath || '').split('/').filter(Boolean);
  const fnIndex = parts.indexOf('vendors');
  if (fnIndex >= 0) return parts.slice(fnIndex + 1);
  return parts;
};

const sanitizeVendorUpdates = (updates = {}) => {
  const BLOCK = new Set([
    'id',
    'user_id',
    'created_at',
    'updated_at',
    'role',
    'aud',
    'app_metadata',
    'user_metadata',
    'confirmed_at',
    'email_confirmed_at',
    'last_sign_in_at',
    'phone_confirmed_at',
    'identities',
    'factors',
    'is_anonymous',
  ]);

  const cleaned = {};
  Object.entries(updates || {}).forEach(([key, value]) => {
    if (BLOCK.has(key)) return;
    if (value === undefined) return;
    cleaned[key] = value;
  });
  return cleaned;
};

const resolveVendorForUser = async (user) => {
  const userId = user?.id || null;
  const email = String(user?.email || '').trim().toLowerCase();

  let vendor = null;
  if (userId) {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    vendor = data || null;
  }

  if (!vendor && email) {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('email', email)
      .maybeSingle();
    if (error) throw new Error(error.message);
    vendor = data || null;
  }

  if (vendor && userId && vendor.user_id !== userId) {
    await supabase
      .from('vendors')
      .update({ user_id: userId })
      .eq('id', vendor.id);
    vendor.user_id = userId;
  }

  return vendor;
};

const resolveBuyerId = async (userId) => {
  if (!userId) return null;
  const { data: buyer } = await supabase
    .from('buyers')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  return buyer?.id || null;
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

const sanitizeFilename = (name) =>
  String(name || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^_+/, '')
    .slice(0, 120) || 'upload';

const buildUploadPath = ({ vendorId, originalName, contentType }) => {
  const safeName = sanitizeFilename(originalName || '');
  const extFromMime = MIME_EXT[contentType] || '';
  const hasExt = safeName.includes('.');
  const base = hasExt ? safeName.replace(/\.[^/.]+$/, '') : safeName;
  const ext = hasExt ? safeName.split('.').pop() : (extFromMime || 'bin');
  const fileName = `${base || 'upload'}.${ext}`;
  return `${vendorId}/${Date.now()}-${randomUUID()}-${fileName}`;
};

const getAuthUser = (event) => {
  const bearer = parseBearerToken(event.headers || {});
  const cookieToken = getCookie(event, AUTH_COOKIE_NAME);
  const token = bearer || cookieToken;
  if (!token) return null;
  const decoded = verifyAuthToken(token);
  if (!decoded?.sub) return null;
  return {
    id: decoded.sub,
    email: decoded.email || null,
    role: normalizeRole(decoded.role || 'USER'),
  };
};

const requireRole = (event, role) => {
  const user = getAuthUser(event);
  if (!user) return { error: unauthorized(event, 'Unauthorized') };
  if (role && normalizeRole(user.role) !== normalizeRole(role)) {
    return { error: forbidden(event, 'Forbidden') };
  }
  return { user };
};

export const handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') return ok(event, { ok: true });

    const tail = parseTail(event.path);
    if (!tail.length) return bad(event, 'Not found', null, 404);

    // -------------------------
    // /me (vendor-only)
    // -------------------------
    if (tail[0] === 'me') {
      if (!isSafeMethod(event.httpMethod) && !ensureCsrfValid(event)) {
        return forbidden(event, 'CSRF token mismatch');
      }

      const { user, error } = requireRole(event, 'VENDOR');
      if (error) return error;

      if (event.httpMethod === 'GET' && tail.length === 1) {
        const vendor = await resolveVendorForUser(user);
        if (!vendor) return bad(event, 'Vendor profile not found', null, 404);
        return ok(event, { success: true, vendor });
      }

      if (event.httpMethod === 'PUT' && tail.length === 1) {
        const vendor = await resolveVendorForUser(user);
        if (!vendor) return bad(event, 'Vendor profile not found', null, 404);

        const payload = sanitizeVendorUpdates(readBody(event));
        payload.updated_at = new Date().toISOString();

        const { data, error: updErr } = await supabase
          .from('vendors')
          .update(payload)
          .eq('id', vendor.id)
          .select('*')
          .maybeSingle();

        if (updErr) return fail(event, updErr.message || 'Update failed');
        return ok(event, { success: true, vendor: data || { ...vendor, ...payload } });
      }

      // -------------------------
      // /me/upload
      // -------------------------
      if (event.httpMethod === 'POST' && tail[1] === 'upload') {
        const vendor = await resolveVendorForUser(user);
        if (!vendor) return bad(event, 'Vendor profile not found', null, 404);

        const body = readBody(event);
        const bucket = String(body?.bucket || 'avatars').trim() || 'avatars';
        if (!ALLOWED_UPLOAD_BUCKETS.has(bucket)) {
          return bad(event, 'Invalid upload bucket');
        }

        const dataUrl = String(body?.data_url || body?.dataUrl || '').trim();
        const originalName = String(body?.file_name || body?.fileName || '').trim();
        const explicitType = String(body?.content_type || body?.contentType || '').trim();

        if (!dataUrl) return bad(event, 'data_url is required');

        const parsed = parseDataUrl(dataUrl);
        if (!parsed?.base64) return bad(event, 'Invalid base64 payload');

        const contentType = explicitType || parsed.mime || 'application/octet-stream';
        const allowVideo = bucket === 'product-media';
        const isAllowed =
          contentType.startsWith('image/') ||
          (allowVideo && contentType.startsWith('video/'));

        if (!isAllowed) return bad(event, 'Unsupported file type');

        const buffer = Buffer.from(parsed.base64, 'base64');
        if (!buffer?.length) return bad(event, 'Empty upload payload');
        if (buffer.length > MAX_UPLOAD_BYTES) {
          return json(event, 413, { success: false, error: 'File too large (max 10MB)' });
        }

        const objectPath = buildUploadPath({
          vendorId: vendor.id,
          originalName,
          contentType,
        });

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(objectPath, buffer, { contentType, upsert: true });

        if (uploadError) return fail(event, uploadError.message || 'Upload failed');

        const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
        return ok(event, {
          success: true,
          bucket,
          path: objectPath,
          publicUrl: data?.publicUrl || null,
        });
      }

      // -------------------------
      // /me/kyc/submit
      // -------------------------
      if (event.httpMethod === 'POST' && tail[1] === 'kyc' && tail[2] === 'submit') {
        const vendor = await resolveVendorForUser(user);
        if (!vendor) return bad(event, 'Vendor profile not found', null, 404);

        const { data, error: updErr } = await supabase
          .from('vendors')
          .update({ kyc_status: 'SUBMITTED', updated_at: new Date().toISOString() })
          .eq('id', vendor.id)
          .select('*')
          .maybeSingle();

        if (updErr) return fail(event, updErr.message || 'KYC submit failed');
        return ok(event, { success: true, vendor: data || { ...vendor, kyc_status: 'SUBMITTED' } });
      }

      // -------------------------
      // /me/documents
      // -------------------------
      if (tail[1] === 'documents') {
        const vendor = await resolveVendorForUser(user);
        if (!vendor) return bad(event, 'Vendor profile not found', null, 404);

        if (event.httpMethod === 'GET' && tail.length === 2) {
          let query = supabase
            .from('vendor_documents')
            .select('*')
            .eq('vendor_id', vendor.id);
          if (event.queryStringParameters?.type) {
            query = query.eq('document_type', String(event.queryStringParameters.type));
          }
          if (event.queryStringParameters?.status) {
            query = query.eq('verification_status', String(event.queryStringParameters.status));
          }
          const { data, error: listErr } = await query.order('uploaded_at', { ascending: false });
          if (listErr) return fail(event, listErr.message || 'Failed to fetch documents');
          return ok(event, { success: true, documents: data || [] });
        }

        if (event.httpMethod === 'POST' && tail.length === 2) {
          const body = readBody(event);
          const document_type = String(body?.document_type || '').trim();
          const document_url = String(body?.document_url || '').trim();
          const original_name = String(body?.original_name || '').trim() || null;
          if (!document_type || !document_url) {
            return bad(event, 'document_type and document_url are required');
          }

          const { data, error: insertErr } = await supabase
            .from('vendor_documents')
            .insert([{
              vendor_id: vendor.id,
              document_type,
              document_url,
              original_name,
              uploaded_at: new Date().toISOString(),
              verification_status: 'PENDING',
            }])
            .select('*')
            .maybeSingle();

          if (insertErr) return fail(event, insertErr.message || 'Failed to save document');
          return ok(event, { success: true, document: data });
        }

        if (event.httpMethod === 'DELETE' && tail.length === 3) {
          const docId = tail[2];
          const { error: delErr } = await supabase
            .from('vendor_documents')
            .delete()
            .eq('id', docId)
            .eq('vendor_id', vendor.id);
          if (delErr) return fail(event, delErr.message || 'Failed to delete document');
          return ok(event, { success: true });
        }

        if (event.httpMethod === 'GET' && tail.length === 3) {
          const docId = tail[2];
          const { data, error: docErr } = await supabase
            .from('vendor_documents')
            .select('*')
            .eq('id', docId)
            .eq('vendor_id', vendor.id)
            .maybeSingle();
          if (docErr) return fail(event, docErr.message || 'Failed to fetch document');
          if (!data) return bad(event, 'Document not found', null, 404);
          return ok(event, { success: true, document: data });
        }

        if (event.httpMethod === 'DELETE' && tail.length === 2) {
          const docType = String(event.queryStringParameters?.type || '').trim();
          if (!docType) return bad(event, 'type query param is required');
          const { error: delErr } = await supabase
            .from('vendor_documents')
            .delete()
            .eq('vendor_id', vendor.id)
            .eq('document_type', docType);
          if (delErr) return fail(event, delErr.message || 'Failed to delete documents');
          return ok(event, { success: true });
        }
      }

      return bad(event, 'Not found', null, 404);
    }

    // -------------------------
    // Public vendor profile endpoints
    // -------------------------
    const vendorId = tail[0];
    const action = tail[1];

    if (event.httpMethod === 'GET' && tail.length === 1) {
      const { data: vendor, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('id', vendorId)
        .maybeSingle();
      if (error) return fail(event, error.message || 'Failed to fetch vendor');
      if (!vendor) return bad(event, 'Vendor not found', null, 404);
      return ok(event, { success: true, vendor });
    }

    if (event.httpMethod === 'GET' && action === 'products') {
      const { data: products, error: pErr } = await supabase
        .from('products')
        .select('id, name, price, price_unit, images, category_other, micro_category_id, sub_category_id, head_category_id, status')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (pErr) return fail(event, pErr.message || 'Failed to fetch products');

      const isPublicStatus = (rawStatus) => {
        const s = String(rawStatus || 'ACTIVE').trim().toUpperCase();
        return !['DRAFT', 'ARCHIVED', 'INACTIVE', 'DELETED', 'BLOCKED', 'PENDING'].includes(s);
      };

      const visibleProducts = (products || []).filter((p) => isPublicStatus(p.status));

      const microIds = Array.from(new Set(visibleProducts.map((p) => p.micro_category_id).filter(Boolean)));
      const subIds = Array.from(new Set(visibleProducts.map((p) => p.sub_category_id).filter(Boolean)));
      const headIds = Array.from(new Set(visibleProducts.map((p) => p.head_category_id).filter(Boolean)));

      const [microRes, subRes, headRes] = await Promise.all([
        microIds.length
          ? supabase
              .from('micro_categories')
              .select('id, name, sub_categories(id, name, head_categories(id, name))')
              .in('id', microIds)
          : Promise.resolve({ data: [] }),
        subIds.length
          ? supabase
              .from('sub_categories')
              .select('id, name, head_categories(id, name)')
              .in('id', subIds)
          : Promise.resolve({ data: [] }),
        headIds.length
          ? supabase.from('head_categories').select('id, name').in('id', headIds)
          : Promise.resolve({ data: [] }),
      ]);

      const microLookup = {};
      (microRes?.data || []).forEach((m) => {
        microLookup[m.id] = {
          microName: m.name,
          subId: m.sub_categories?.id || null,
          subName: m.sub_categories?.name || null,
          headId: m.sub_categories?.head_categories?.id || null,
          headName: m.sub_categories?.head_categories?.name || null,
        };
      });

      const subLookup = {};
      (subRes?.data || []).forEach((s) => {
        subLookup[s.id] = {
          subName: s.name,
          headId: s.head_categories?.id || null,
          headName: s.head_categories?.name || null,
        };
      });

      const headLookup = {};
      (headRes?.data || []).forEach((h) => {
        headLookup[h.id] = h.name;
      });

      const mappedProducts = visibleProducts.map((p) => {
        const microInfo = microLookup[p.micro_category_id] || {};
        const subInfo = subLookup[p.sub_category_id] || {};
        const headName =
          microInfo.headName ||
          subInfo.headName ||
          headLookup[p.head_category_id] ||
          'Other Category';
        const subName =
          microInfo.subName ||
          subInfo.subName ||
          p.category_other ||
          'Other Subcategory';

        const image =
          (p.images && Array.isArray(p.images) && p.images[0]) ||
          (p.images && typeof p.images === 'string' ? p.images : FALLBACK_IMAGE);

        return {
          id: p.id,
          name: p.name,
          price: `₹${p.price}${p.price_unit ? ' / ' + p.price_unit : ''}`,
          category: p.category_other || microInfo.microName || subName || 'General',
          head_category_name: headName,
          sub_category_name: subName,
          micro_category_name: microInfo.microName || null,
          image,
        };
      });

      return ok(event, { success: true, products: mappedProducts });
    }

    if (event.httpMethod === 'GET' && action === 'services') {
      let mappedServices = [];
      try {
        const { data: services, error } = await supabase
          .from('vendor_services')
          .select('*')
          .eq('vendor_id', vendorId);
        if (error) throw error;

        if (services?.length) {
          mappedServices = services.map((service) => ({
            id: service.id,
            name: service.name || service.service_name || service.title || 'Service',
            category: service.category || service.service_type || 'Service',
            description:
              service.description ||
              service.details ||
              service.short_description ||
              'Service details coming soon.',
            price: service.price
              ? `₹${service.price}${service.price_unit ? ' / ' + service.price_unit : ''}`
              : service.rate
                ? `₹${service.rate}`
                : 'Price on request',
            image:
              service.image ||
              service.cover_image ||
              (Array.isArray(service.images) ? service.images[0] : null) ||
              FALLBACK_SERVICE_IMAGE,
          }));
        }
      } catch {
        mappedServices = [];
      }
      return ok(event, { success: true, services: mappedServices });
    }

    if (event.httpMethod === 'GET' && action === 'service-categories') {
      const { data: prefs, error } = await supabase
        .from('vendor_preferences')
        .select('preferred_micro_categories')
        .eq('vendor_id', vendorId)
        .maybeSingle();

      if (error) return fail(event, error.message || 'Failed to fetch categories');

      const ids = prefs?.preferred_micro_categories || [];
      if (!ids?.length) return ok(event, { success: true, categories: [] });

      const { data: headCats, error: headErr } = await supabase
        .from('head_categories')
        .select('id, name')
        .in('id', ids);

      if (headErr) return fail(event, headErr.message || 'Failed to fetch categories');

      const mapped = (headCats || []).map((h) => ({ id: h.id, name: h.name }));
      return ok(event, { success: true, categories: mapped });
    }

    // -------------------------
    // Buyer-only endpoints
    // -------------------------
    if (action === 'favorite') {
      if (!isSafeMethod(event.httpMethod) && !ensureCsrfValid(event)) {
        return forbidden(event, 'CSRF token mismatch');
      }

      const { user, error } = requireRole(event, 'BUYER');
      if (error) return error;

      const buyerId = await resolveBuyerId(user.id);
      if (!buyerId) return bad(event, 'Buyer profile not found', null, 404);

      if (event.httpMethod === 'GET') {
        const { data: favRow, error: favErr } = await supabase
          .from('favorites')
          .select('id')
          .eq('buyer_id', buyerId)
          .eq('vendor_id', vendorId)
          .maybeSingle();
        if (favErr) return fail(event, favErr.message || 'Failed to fetch favorite');
        return ok(event, { success: true, isFavorite: !!favRow?.id });
      }

      if (event.httpMethod === 'POST') {
        const { error: insErr } = await supabase
          .from('favorites')
          .insert([{ buyer_id: buyerId, vendor_id: vendorId }]);
        if (insErr && String(insErr.message || '').toLowerCase().includes('duplicate')) {
          return ok(event, { success: true, isFavorite: true });
        }
        if (insErr) return fail(event, insErr.message || 'Failed to favorite vendor');
        return ok(event, { success: true, isFavorite: true });
      }

      if (event.httpMethod === 'DELETE') {
        const { error: delErr } = await supabase
          .from('favorites')
          .delete()
          .match({ buyer_id: buyerId, vendor_id: vendorId });
        if (delErr) return fail(event, delErr.message || 'Failed to remove favorite');
        return ok(event, { success: true, isFavorite: false });
      }
    }

    if (event.httpMethod === 'GET' && action === 'leads') {
      const { user, error } = requireRole(event, 'BUYER');
      if (error) return error;

      const buyerId = await resolveBuyerId(user.id);
      if (!buyerId) return bad(event, 'Buyer profile not found', null, 404);

      const { data: leads, error: leadErr } = await supabase
        .from('leads')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('buyer_id', buyerId);

      if (leadErr) return fail(event, leadErr.message || 'Failed to fetch leads');
      return ok(event, { success: true, leads: leads || [] });
    }

    return bad(event, 'Not found', null, 404);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Vendors] Function failed:', error?.message || error);
    return fail(event, 'Vendors failed', error?.message || String(error));
  }
};
