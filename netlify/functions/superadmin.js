import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const TOKEN_KEY = 'superadmin_token';

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  },
  body: JSON.stringify(body),
});

const nowIso = () => new Date().toISOString();
const normalizeEmail = (v) => String(v || '').trim().toLowerCase();
const normalizeRole = (v) => {
  const r = String(v || '').trim().toUpperCase();
  return r === 'DATAENTRY' ? 'DATA_ENTRY' : r;
};
const clampLimit = (limit, fallback = 200, max = 1000) => {
  const n = Number(limit);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
};

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);

const toNonNegativeNumber = (value, fallback = 0) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
};

const toPositiveInteger = (value, fallback = 1) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.max(1, Math.floor(n));
};

const toNonNegativeInteger = (value, fallback = 0) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.max(0, Math.floor(n));
};

const normalizeObject = (value) => {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
      return {};
    } catch {
      return {};
    }
  }
  if (typeof value === 'object' && !Array.isArray(value)) return { ...value };
  return {};
};

const buildPlanFeatures = (existingFeatures, payload = {}) => {
  const base = normalizeObject(existingFeatures);
  const incoming = normalizeObject(payload?.features);
  const baseCoverage = normalizeObject(base.coverage);
  const incomingCoverage = normalizeObject(incoming.coverage);
  const next = {
    ...base,
    ...incoming,
  };

  const hasPricingInput =
    hasOwn(payload, 'original_price') ||
    hasOwn(payload, 'discount_percent') ||
    hasOwn(payload, 'discount_label');

  if (hasPricingInput) {
    const pricing = {
      ...normalizeObject(base.pricing),
      ...normalizeObject(incoming.pricing),
    };

    if (hasOwn(payload, 'original_price')) {
      pricing.original_price = toNonNegativeNumber(payload.original_price, 0);
    }
    if (hasOwn(payload, 'discount_percent')) {
      pricing.discount_percent = Math.max(0, Math.min(100, toNonNegativeNumber(payload.discount_percent, 0)));
    }
    if (hasOwn(payload, 'discount_label')) {
      pricing.discount_label = String(payload.discount_label || '').trim();
    }

    next.pricing = pricing;
  }

  const hasBadgeInput = hasOwn(payload, 'badge_label') || hasOwn(payload, 'badge_variant');
  if (hasBadgeInput) {
    const badge = {
      ...normalizeObject(base.badge),
      ...normalizeObject(incoming.badge),
    };
    if (hasOwn(payload, 'badge_label')) badge.label = String(payload.badge_label || '').trim();
    if (hasOwn(payload, 'badge_variant')) badge.variant = String(payload.badge_variant || '').trim() || 'neutral';
    next.badge = badge;
  }

  const resolveCoverageLimit = (key) => {
    if (hasOwn(payload, key)) return toNonNegativeInteger(payload[key], 0);
    if (hasOwn(incoming, key)) return toNonNegativeInteger(incoming[key], 0);
    if (hasOwn(incomingCoverage, key)) return toNonNegativeInteger(incomingCoverage[key], 0);
    if (hasOwn(baseCoverage, key)) return toNonNegativeInteger(baseCoverage[key], 0);
    if (hasOwn(base, key)) return toNonNegativeInteger(base[key], 0);
    return undefined;
  };

  const statesLimit = resolveCoverageLimit('states_limit');
  const citiesLimit = resolveCoverageLimit('cities_limit');

  if (statesLimit !== undefined || citiesLimit !== undefined) {
    const coverage = {
      ...baseCoverage,
      ...incomingCoverage,
    };
    if (statesLimit !== undefined) coverage.states_limit = statesLimit;
    if (citiesLimit !== undefined) coverage.cities_limit = citiesLimit;
    next.coverage = coverage;

    // Keep flat keys for backward compatibility with older vendor UIs.
    if (statesLimit !== undefined) next.states_limit = statesLimit;
    if (citiesLimit !== undefined) next.cities_limit = citiesLimit;
  }

  return next;
};

const isMissingVendorPlanColumnError = (error, columnName) => {
  const col = String(columnName || '').trim().toLowerCase();
  if (!col) return false;

  const text = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
  const mentionsColumn =
    text.includes(`'${col}'`) ||
    text.includes(`"${col}"`) ||
    text.includes(`column "${col}"`) ||
    text.includes(`column '${col}'`);
  const mentionsTable =
    text.includes(`'vendor_plans'`) ||
    text.includes(`"vendor_plans"`) ||
    text.includes('relation "vendor_plans"') ||
    text.includes("relation 'vendor_plans'");
  const missingSignal = text.includes('schema cache') || text.includes('does not exist');

  return mentionsColumn && mentionsTable && missingSignal;
};

const insertVendorPlanWithFallback = async (supabase, payload) => {
  const first = await supabase
    .from('vendor_plans')
    .insert([payload])
    .select('*')
    .maybeSingle();

  if (!first?.error || !hasOwn(payload, 'description')) {
    return first;
  }

  if (!isMissingVendorPlanColumnError(first.error, 'description')) {
    return first;
  }

  const retryPayload = { ...payload };
  delete retryPayload.description;

  const retry = await supabase
    .from('vendor_plans')
    .insert([retryPayload])
    .select('*')
    .maybeSingle();

  if (!retry?.error && retry?.data) {
    retry.data.description = String(payload.description || '');
  }
  return retry;
};

const updateVendorPlanWithFallback = async (supabase, planId, updates) => {
  const first = await supabase
    .from('vendor_plans')
    .update(updates)
    .eq('id', planId)
    .select('*')
    .maybeSingle();

  if (!first?.error || !hasOwn(updates, 'description')) {
    return first;
  }

  if (!isMissingVendorPlanColumnError(first.error, 'description')) {
    return first;
  }

  const retryUpdates = { ...updates };
  delete retryUpdates.description;

  if (Object.keys(retryUpdates).length === 0) {
    return {
      data: null,
      error: {
        message:
          'Plan description is not supported by current DB schema. Apply latest migration to enable it.',
      },
    };
  }

  const retry = await supabase
    .from('vendor_plans')
    .update(retryUpdates)
    .eq('id', planId)
    .select('*')
    .maybeSingle();

  if (!retry?.error && retry?.data) {
    retry.data.description = String(updates.description || '');
  }
  return retry;
};

const syncActivePlanQuota = async (supabase, planId, limits) => {
  if (!planId) return;

  const { data: subscriptions, error: subError } = await supabase
    .from('vendor_plan_subscriptions')
    .select('vendor_id')
    .eq('plan_id', planId)
    .eq('status', 'ACTIVE');

  if (subError) throw new Error(subError.message);

  const vendorIds = Array.from(
    new Set(
      (subscriptions || [])
        .map((row) => row?.vendor_id)
        .filter(Boolean)
    )
  );
  if (!vendorIds.length) return;

  const { error: quotaError } = await supabase
    .from('vendor_lead_quota')
    .update({
      plan_id: planId,
      daily_limit: toNonNegativeInteger(limits?.daily_limit, 0),
      weekly_limit: toNonNegativeInteger(limits?.weekly_limit, 0),
      yearly_limit: toNonNegativeInteger(limits?.yearly_limit, 0),
      updated_at: nowIso(),
    })
    .in('vendor_id', vendorIds);

  if (quotaError) throw new Error(quotaError.message);
};

const getSupabase = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
};

const parseTail = (path = '') => {
  const parts = String(path || '').split('/').filter(Boolean);
  const idx = parts.lastIndexOf('superadmin');
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

const parseBearerToken = (headers = {}) => {
  const header = headers.Authorization || headers.authorization;
  if (!header || typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  return header.replace('Bearer ', '').trim();
};

let warnedMissingSecret = false;
const getSecret = () => {
  const secret =
    process.env.SUPERADMIN_JWT_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('Missing SUPERADMIN_JWT_SECRET (or fallback secret)');
  if (!process.env.SUPERADMIN_JWT_SECRET && !warnedMissingSecret) {
    // eslint-disable-next-line no-console
    console.warn('[SuperAdmin] SUPERADMIN_JWT_SECRET missing, using fallback secret.');
    warnedMissingSecret = true;
  }
  return secret;
};

const signToken = (row) =>
  jwt.sign(
    {
      sub: row.id,
      email: row.email,
      role: normalizeRole(row.role || 'SUPERADMIN'),
      type: 'SUPERADMIN',
    },
    getSecret(),
    { expiresIn: process.env.SUPERADMIN_TOKEN_TTL || '12h' }
  );

const verifyToken = (token) => {
  try {
    return jwt.verify(token, getSecret());
  } catch {
    return null;
  }
};

const isBcryptHash = (v) => typeof v === 'string' && v.startsWith('$2');
const hashPassword = (password) => bcrypt.hash(String(password || ''), 10);
const verifyPassword = async (password, storedHash) => {
  if (!password || !storedHash) return false;
  if (isBcryptHash(storedHash)) return bcrypt.compare(String(password), storedHash);
  return String(password) === String(storedHash);
};

const writeAuditLog = async (
  supabase,
  { actor = null, action, entityType, entityId = null, details = {} }
) => {
  try {
    if (!action || !entityType) return;
    await supabase.from('audit_logs').insert([
      {
        user_id: actor?.id || null,
        action: String(action),
        entity_type: String(entityType),
        entity_id: entityId ? String(entityId) : null,
        details: {
          actor_id: actor?.id || null,
          actor_type: actor?.type || null,
          actor_role: actor?.role || null,
          actor_email: actor?.email || null,
          ...details,
        },
        created_at: nowIso(),
      },
    ]);
  } catch {
    // audit should not break flow
  }
};

const notifyUser = async (supabase, { user_id, type, title, message, link }) => {
  try {
    if (!user_id) return null;
    const { data } = await supabase
      .from('notifications')
      .insert([
        {
          user_id,
          type: type || 'INFO',
          title: title || 'Notification',
          message: message || '',
          link: link || null,
          is_read: false,
          created_at: nowIso(),
        },
      ])
      .select()
      .maybeSingle();
    return data || null;
  } catch {
    return null;
  }
};

const findPublicUserByEmail = async (supabase, email) => {
  const target = normalizeEmail(email);
  if (!target) return null;
  const { data, error } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', target)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
};

const upsertPublicUser = async (
  supabase,
  { email, full_name, role, phone, password_hash, allowPasswordUpdate = false }
) => {
  const targetEmail = normalizeEmail(email);
  if (!targetEmail) throw new Error('Email is required');
  const existing = await findPublicUserByEmail(supabase, targetEmail);
  if (existing?.id) {
    const updates = {
      full_name: full_name || undefined,
      role: normalizeRole(role || ''),
      phone: phone || null,
      updated_at: nowIso(),
    };
    if (password_hash && allowPasswordUpdate) updates.password_hash = password_hash;
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', existing.id)
      .select('*')
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data || { ...existing, ...updates };
  }

  const payload = {
    id: randomUUID(),
    email: targetEmail,
    full_name: String(full_name || '').trim() || targetEmail.split('@')[0],
    role: normalizeRole(role || 'USER'),
    phone: phone || null,
    password_hash: password_hash || null,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  const { data, error } = await supabase.from('users').insert([payload]).select('*').maybeSingle();
  if (error) throw new Error(error.message);
  return data || payload;
};

const setPublicUserPassword = async (supabase, userId, password) => {
  const password_hash = await hashPassword(password);
  const { error } = await supabase
    .from('users')
    .update({ password_hash, updated_at: nowIso() })
    .eq('id', userId);
  if (error) throw new Error(error.message);
};

const ensureEmployeeUser = async (supabase, employee, password) => {
  if (employee?.user_id) {
    const { data } = await supabase.from('users').select('id').eq('id', employee.user_id).maybeSingle();
    if (data?.id) return { userId: employee.user_id, created: false };
  }
  const email = normalizeEmail(employee?.email);
  if (!email) {
    const err = new Error('Employee user not found');
    err.statusCode = 404;
    throw err;
  }
  let publicUser = await findPublicUserByEmail(supabase, email);
  let created = false;
  if (!publicUser) {
    if (!password) {
      const err = new Error('Password required to create employee user');
      err.statusCode = 400;
      throw err;
    }
    publicUser = await upsertPublicUser(supabase, {
      email,
      full_name: employee?.full_name || '',
      role: employee?.role || 'DATA_ENTRY',
      phone: employee?.phone || null,
      password_hash: await hashPassword(password),
      allowPasswordUpdate: true,
    });
    created = true;
  }
  await supabase.from('employees').update({ user_id: publicUser.id }).eq('id', employee.id);
  return { userId: publicUser.id, created };
};

const ensureSystemConfigRow = async (supabase, superadminId) => {
  const key = 'maintenance_mode';
  const { data, error } = await supabase
    .from('system_config')
    .select('*')
    .eq('config_key', key)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data;

  const payload = {
    config_key: key,
    maintenance_mode: false,
    maintenance_message: '',
    allow_vendor_registration: true,
    commission_rate: 5,
    max_upload_size_mb: 10,
    public_notice_enabled: false,
    public_notice_message: '',
    public_notice_variant: 'info',
    updated_at: nowIso(),
    updated_by: superadminId || null,
  };
  const { data: inserted, error: insertError } = await supabase
    .from('system_config')
    .upsert(payload, { onConflict: 'config_key' })
    .select('*')
    .maybeSingle();
  if (insertError) throw new Error(insertError.message);
  return inserted || payload;
};

const deleteVendorCascade = async (supabase, vendorId) => {
  const { data: vendor, error: vendorErr } = await supabase
    .from('vendors')
    .select('id, user_id, company_name, email, vendor_id')
    .eq('id', vendorId)
    .maybeSingle();
  if (vendorErr) throw new Error(vendorErr.message);
  if (!vendor) {
    const err = new Error('Vendor not found');
    err.statusCode = 404;
    throw err;
  }

  const { data: products } = await supabase.from('products').select('id').eq('vendor_id', vendorId);
  const productIds = (products || []).map((p) => p.id).filter(Boolean);
  if (productIds.length) await supabase.from('product_images').delete().in('product_id', productIds);
  await supabase.from('products').delete().eq('vendor_id', vendorId);

  const { data: tickets } = await supabase.from('support_tickets').select('id').eq('vendor_id', vendorId);
  const ticketIds = (tickets || []).map((t) => t.id).filter(Boolean);
  if (ticketIds.length) await supabase.from('ticket_messages').delete().in('ticket_id', ticketIds);
  await supabase.from('support_tickets').delete().eq('vendor_id', vendorId);

  await supabase.from('leads').update({ vendor_id: null, status: 'AVAILABLE' }).eq('vendor_id', vendorId);

  const vendorTables = [
    'favorites',
    'lead_contacts',
    'lead_purchases',
    'vendor_additional_leads',
    'vendor_bank_details',
    'vendor_contact_persons',
    'vendor_coupon_usages',
    'vendor_documents',
    'vendor_lead_quota',
    'vendor_messages',
    'vendor_otp_codes',
    'vendor_payments',
    'vendor_plan_slots',
    'vendor_plan_subscriptions',
    'vendor_plan_coupons',
    'vendor_preferences',
    'proposals',
  ];
  for (const table of vendorTables) {
    // eslint-disable-next-line no-await-in-loop
    await supabase.from(table).delete().eq('vendor_id', vendorId);
  }

  const { error: deleteErr } = await supabase.from('vendors').delete().eq('id', vendorId);
  if (deleteErr) throw new Error(deleteErr.message);
  if (vendor.user_id) {
    try {
      await supabase.from('users').delete().eq('id', vendor.user_id);
    } catch {
      // ignore
    }
  }
  return vendor;
};

const maybeUpgradePasswordHash = async (supabase, superadmin, password) => {
  if (!superadmin?.id || !password || isBcryptHash(superadmin.password_hash)) return;
  try {
    await supabase
      .from('superadmin_users')
      .update({ password_hash: await hashPassword(password), updated_at: nowIso() })
      .eq('id', superadmin.id);
  } catch {
    // ignore
  }
};

const requireSuperAdmin = async (event, supabase) => {
  const token = parseBearerToken(event?.headers || {});
  if (!token) return { response: json(401, { success: false, error: 'Missing superadmin token' }) };
  const decoded = verifyToken(token);
  if (!decoded?.sub) {
    return { response: json(401, { success: false, error: 'Invalid or expired superadmin token' }) };
  }
  const { data: superadmin, error } = await supabase
    .from('superadmin_users')
    .select('*')
    .eq('id', decoded.sub)
    .maybeSingle();
  if (error) return { response: json(500, { success: false, error: error.message }) };
  if (!superadmin || superadmin.is_active === false) {
    return { response: json(403, { success: false, error: 'Superadmin account is inactive' }) };
  }
  return {
    superadmin,
    actor: {
      id: superadmin.id,
      type: 'SUPERADMIN',
      role: normalizeRole(superadmin.role || 'SUPERADMIN'),
      email: superadmin.email,
    },
  };
};

const handleLogin = async (supabase, body) => {
  const email = normalizeEmail(body?.email);
  const password = String(body?.password || '');
  if (!email || !password) return json(400, { success: false, error: 'Email and password are required' });

  const { data: superadmin, error } = await supabase
    .from('superadmin_users')
    .select('*')
    .eq('email', email)
    .maybeSingle();
  if (error) return json(500, { success: false, error: error.message });
  if (!superadmin || superadmin.is_active === false) return json(401, { success: false, error: 'Invalid credentials' });
  if (!(await verifyPassword(password, superadmin.password_hash))) {
    return json(401, { success: false, error: 'Invalid credentials' });
  }

  await maybeUpgradePasswordHash(supabase, superadmin, password);
  await supabase.from('superadmin_users').update({ last_login: nowIso(), updated_at: nowIso() }).eq('id', superadmin.id);

  const actor = {
    id: superadmin.id,
    type: 'SUPERADMIN',
    role: normalizeRole(superadmin.role || 'SUPERADMIN'),
    email: superadmin.email,
  };
  await writeAuditLog(supabase, {
    actor,
    action: 'SUPERADMIN_LOGIN',
    entityType: 'superadmin_users',
    entityId: superadmin.id,
    details: { email: superadmin.email },
  });

  return json(200, {
    success: true,
    token: signToken(superadmin),
    token_type: TOKEN_KEY,
    superadmin: {
      id: superadmin.id,
      email: superadmin.email,
      role: normalizeRole(superadmin.role || 'SUPERADMIN'),
      is_active: superadmin.is_active !== false,
      last_login: nowIso(),
    },
  });
};

export const handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });

    const supabase = getSupabase();
    const tail = parseTail(event.path);
    const body = readBody(event);

    if (event.httpMethod === 'POST' && tail[0] === 'login') {
      return handleLogin(supabase, body);
    }

    const guard = await requireSuperAdmin(event, supabase);
    if (guard.response) return guard.response;
    const { superadmin, actor } = guard;

    if (event.httpMethod === 'GET' && tail[0] === 'me') {
      return json(200, {
        success: true,
        superadmin: {
          id: superadmin.id,
          email: superadmin.email,
          role: normalizeRole(superadmin.role || 'SUPERADMIN'),
          last_login: superadmin.last_login || null,
          is_active: superadmin.is_active !== false,
        },
      });
    }

    if (event.httpMethod === 'PUT' && tail[0] === 'password') {
      const currentPassword = String(body?.current_password || '');
      const newPassword = String(body?.new_password || '');
      if (!newPassword || newPassword.length < 8) {
        return json(400, { success: false, error: 'New password must be at least 8 characters' });
      }
      if (!(await verifyPassword(currentPassword, superadmin.password_hash))) {
        return json(401, { success: false, error: 'Current password is incorrect' });
      }
      const { error } = await supabase
        .from('superadmin_users')
        .update({ password_hash: await hashPassword(newPassword), updated_at: nowIso() })
        .eq('id', superadmin.id);
      if (error) return json(500, { success: false, error: error.message });

      await writeAuditLog(supabase, {
        actor,
        action: 'SUPERADMIN_PASSWORD_CHANGED',
        entityType: 'superadmin_users',
        entityId: superadmin.id,
        details: { email: superadmin.email },
      });
      return json(200, { success: true });
    }

    if (event.httpMethod === 'GET' && tail[0] === 'employees' && tail.length === 1) {
      const { data, error } = await supabase.from('employees').select('*').order('created_at', { ascending: false });
      if (error) return json(500, { success: false, error: error.message });
      await writeAuditLog(supabase, {
        actor,
        action: 'EMPLOYEES_VIEWED',
        entityType: 'employees',
        details: { count: data?.length || 0 },
      });
      return json(200, { success: true, employees: data || [] });
    }

    if (event.httpMethod === 'POST' && tail[0] === 'employees' && tail.length === 1) {
      const fullName = String(body?.full_name || '').trim();
      const email = normalizeEmail(body?.email);
      const password = String(body?.password || '').trim();
      const role = normalizeRole(body?.role || 'DATA_ENTRY');
      const phone = String(body?.phone || '').trim() || null;
      const department = String(body?.department || '').trim() || 'Operations';
      const status = normalizeRole(body?.status || 'ACTIVE') || 'ACTIVE';

      if (!fullName || !email || !password) {
        return json(400, { success: false, error: 'full_name, email and password are required' });
      }
      const allowedRoles = ['ADMIN', 'HR', 'DATA_ENTRY', 'SUPPORT', 'SALES', 'MANAGER', 'VP', 'FINANCE'];
      if (!allowedRoles.includes(role)) {
        return json(400, { success: false, error: `Invalid role. Allowed roles: ${allowedRoles.join(', ')}` });
      }

      const publicUser = await upsertPublicUser(supabase, {
        email,
        full_name: fullName,
        role,
        phone,
        password_hash: await hashPassword(password),
        allowPasswordUpdate: true,
      });
      const userId = publicUser.id;

      const empPayload = {
        user_id: userId,
        full_name: fullName,
        email,
        phone,
        role,
        department,
        status,
        created_at: nowIso(),
      };
      const { data: employee, error: empError } = await supabase
        .from('employees')
        .insert([empPayload])
        .select('*')
        .maybeSingle();
      if (empError) {
        try {
          await supabase.from('users').delete().eq('id', userId);
        } catch {
          // ignore
        }
        return json(500, { success: false, error: empError.message });
      }

      await writeAuditLog(supabase, {
        actor,
        action: 'EMPLOYEE_CREATED',
        entityType: 'employees',
        entityId: employee?.id || null,
        details: { email, role, department, user_id: userId },
      });

      if (userId) {
        await notifyUser(supabase, {
          user_id: userId,
          type: 'WELCOME',
          title: 'Welcome to the Team',
          message: 'Your staff account has been created. Please log in to continue.',
          link: '/employee/login',
        });
      }

      return json(200, { success: true, employee: employee || empPayload });
    }

    if (event.httpMethod === 'DELETE' && tail[0] === 'employees' && tail[1] && tail.length === 2) {
      const employeeId = tail[1];
      const { data: employee, error: empError } = await supabase
        .from('employees')
        .select('id, user_id, email, full_name, role')
        .eq('id', employeeId)
        .maybeSingle();
      if (empError) return json(500, { success: false, error: empError.message });
      if (!employee) return json(404, { success: false, error: 'Employee not found' });

      await supabase.from('employees').delete().eq('id', employeeId);
      if (employee.user_id) await supabase.from('users').delete().eq('id', employee.user_id);

      await writeAuditLog(supabase, {
        actor,
        action: 'EMPLOYEE_DELETED',
        entityType: 'employees',
        entityId: employeeId,
        details: {
          user_id: employee.user_id,
          email: employee.email,
          full_name: employee.full_name,
          role: employee.role,
        },
      });
      return json(200, { success: true });
    }

    if (event.httpMethod === 'PUT' && tail[0] === 'employees' && tail[1] && tail[2] === 'password') {
      const employeeId = tail[1];
      const password = String(body?.password || '').trim();
      if (!password || password.length < 6) {
        return json(400, { success: false, error: 'Password must be at least 6 characters' });
      }

      const { data: employee, error: empError } = await supabase
        .from('employees')
        .select('id, user_id, email, full_name, role, department, phone')
        .eq('id', employeeId)
        .maybeSingle();
      if (empError) return json(500, { success: false, error: empError.message });
      if (!employee) return json(404, { success: false, error: 'Employee not found' });

      let resolvedUserId = employee.user_id || null;
      let createdAuthUser = false;
      try {
        const ensured = await ensureEmployeeUser(supabase, employee, password);
        resolvedUserId = ensured.userId;
        createdAuthUser = ensured.created;
      } catch (error) {
        return json(error?.statusCode || 500, { success: false, error: error.message });
      }
      await setPublicUserPassword(supabase, resolvedUserId, password);

      await writeAuditLog(supabase, {
        actor,
        action: 'EMPLOYEE_PASSWORD_RESET',
        entityType: 'employees',
        entityId: employeeId,
        details: {
          user_id: resolvedUserId,
          email: employee.email,
          role: employee.role,
          created_auth_user: createdAuthUser,
        },
      });
      return json(200, { success: true });
    }

    if (event.httpMethod === 'GET' && tail[0] === 'vendors' && tail.length === 1) {
      const limit = clampLimit(event.queryStringParameters?.limit, 500, 2000);
      const { data, error } = await supabase
        .from('vendors')
        .select(
          'id, vendor_id, company_name, owner_name, email, phone, kyc_status, created_at, is_active, is_verified, city, state'
        )
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) return json(500, { success: false, error: error.message });
      await writeAuditLog(supabase, {
        actor,
        action: 'VENDORS_VIEWED',
        entityType: 'vendors',
        details: { count: data?.length || 0 },
      });
      return json(200, { success: true, vendors: data || [] });
    }

    if (event.httpMethod === 'DELETE' && tail[0] === 'vendors' && tail[1] && tail.length === 2) {
      const vendorId = tail[1];
      let vendor;
      try {
        vendor = await deleteVendorCascade(supabase, vendorId);
      } catch (error) {
        return json(error?.statusCode || 500, { success: false, error: error.message });
      }
      await writeAuditLog(supabase, {
        actor,
        action: 'VENDOR_DELETED',
        entityType: 'vendors',
        entityId: vendorId,
        details: {
          vendor_id: vendor.vendor_id,
          company_name: vendor.company_name,
          email: vendor.email,
          user_id: vendor.user_id,
        },
      });
      return json(200, { success: true, vendor });
    }

    if (event.httpMethod === 'GET' && tail[0] === 'plans' && tail.length === 1) {
      const query = event.queryStringParameters || {};
      const includeInactive = query.include_inactive !== 'false';
      const limit = clampLimit(query.limit, 200, 1000);

      let planQuery = supabase
        .from('vendor_plans')
        .select('*')
        .order('price', { ascending: true })
        .order('name', { ascending: true })
        .limit(limit);

      if (!includeInactive) {
        planQuery = planQuery.eq('is_active', true);
      }

      const { data, error } = await planQuery;
      if (error) return json(500, { success: false, error: error.message });

      await writeAuditLog(supabase, {
        actor,
        action: 'VENDOR_PLANS_VIEWED',
        entityType: 'vendor_plans',
        details: {
          include_inactive: includeInactive,
          count: data?.length || 0,
        },
      });

      return json(200, { success: true, plans: data || [] });
    }

    if (event.httpMethod === 'POST' && tail[0] === 'plans' && tail.length === 1) {
      const name = String(body?.name || '').trim();
      if (!name) return json(400, { success: false, error: 'name is required' });

      const payload = {
        name,
        price: toNonNegativeNumber(body?.price, 0),
        daily_limit: toNonNegativeInteger(body?.daily_limit, 0),
        weekly_limit: toNonNegativeInteger(body?.weekly_limit, 0),
        yearly_limit: toNonNegativeInteger(body?.yearly_limit, 0),
        duration_days: toPositiveInteger(body?.duration_days, 365),
        is_active: body?.is_active !== false,
        features: buildPlanFeatures({}, body),
      };

      if (hasOwn(body, 'description')) {
        payload.description = String(body?.description || '').trim();
      }

      const { data, error } = await insertVendorPlanWithFallback(supabase, payload);

      if (error) return json(500, { success: false, error: error.message });

      await writeAuditLog(supabase, {
        actor,
        action: 'VENDOR_PLAN_CREATED',
        entityType: 'vendor_plans',
        entityId: data?.id || null,
        details: {
          name: payload.name,
          price: payload.price,
          daily_limit: payload.daily_limit,
          weekly_limit: payload.weekly_limit,
          yearly_limit: payload.yearly_limit,
          duration_days: payload.duration_days,
          is_active: payload.is_active,
        },
      });

      return json(200, { success: true, plan: data || payload });
    }

    if (event.httpMethod === 'PUT' && tail[0] === 'plans' && tail[1] && tail.length === 2) {
      const planId = tail[1];
      const { data: existing, error: existingError } = await supabase
        .from('vendor_plans')
        .select('*')
        .eq('id', planId)
        .maybeSingle();

      if (existingError) return json(500, { success: false, error: existingError.message });
      if (!existing) return json(404, { success: false, error: 'Plan not found' });

      const updates = {};
      if (hasOwn(body, 'name')) updates.name = String(body?.name || '').trim();
      if (hasOwn(body, 'description')) updates.description = String(body?.description || '').trim();
      if (hasOwn(body, 'price')) updates.price = toNonNegativeNumber(body?.price, 0);
      if (hasOwn(body, 'daily_limit')) updates.daily_limit = toNonNegativeInteger(body?.daily_limit, 0);
      if (hasOwn(body, 'weekly_limit')) updates.weekly_limit = toNonNegativeInteger(body?.weekly_limit, 0);
      if (hasOwn(body, 'yearly_limit')) updates.yearly_limit = toNonNegativeInteger(body?.yearly_limit, 0);
      if (hasOwn(body, 'duration_days')) updates.duration_days = toPositiveInteger(body?.duration_days, 365);
      if (hasOwn(body, 'is_active')) updates.is_active = body?.is_active === true;

      const hasFeatureUpdate =
        hasOwn(body, 'features') ||
        hasOwn(body, 'original_price') ||
        hasOwn(body, 'discount_percent') ||
        hasOwn(body, 'discount_label') ||
        hasOwn(body, 'badge_label') ||
        hasOwn(body, 'badge_variant') ||
        hasOwn(body, 'states_limit') ||
        hasOwn(body, 'cities_limit');

      if (hasFeatureUpdate) {
        updates.features = buildPlanFeatures(existing.features, body);
      }

      if (Object.keys(updates).length === 0) {
        return json(400, { success: false, error: 'No valid fields provided to update' });
      }

      const { data, error } = await updateVendorPlanWithFallback(supabase, planId, updates);
      if (error) return json(500, { success: false, error: error.message });

      if (hasOwn(updates, 'daily_limit') || hasOwn(updates, 'weekly_limit') || hasOwn(updates, 'yearly_limit')) {
        await syncActivePlanQuota(supabase, planId, {
          daily_limit: data?.daily_limit ?? existing.daily_limit ?? 0,
          weekly_limit: data?.weekly_limit ?? existing.weekly_limit ?? 0,
          yearly_limit: data?.yearly_limit ?? existing.yearly_limit ?? 0,
        });
      }

      await writeAuditLog(supabase, {
        actor,
        action: 'VENDOR_PLAN_UPDATED',
        entityType: 'vendor_plans',
        entityId: planId,
        details: updates,
      });

      return json(200, { success: true, plan: data || null });
    }

    if (event.httpMethod === 'DELETE' && tail[0] === 'plans' && tail[1] && tail.length === 2) {
      const planId = tail[1];

      const { data: existing, error: existingError } = await supabase
        .from('vendor_plans')
        .select('*')
        .eq('id', planId)
        .maybeSingle();

      if (existingError) return json(500, { success: false, error: existingError.message });
      if (!existing) return json(404, { success: false, error: 'Plan not found' });

      const [
        { count: activeSubscriptionCount, error: activeSubError },
        { count: subscriptionHistoryCount, error: subHistoryError },
        { count: paymentHistoryCount, error: paymentHistoryError },
      ] = await Promise.all([
        supabase
          .from('vendor_plan_subscriptions')
          .select('id', { head: true, count: 'exact' })
          .eq('plan_id', planId)
          .eq('status', 'ACTIVE'),
        supabase
          .from('vendor_plan_subscriptions')
          .select('id', { head: true, count: 'exact' })
          .eq('plan_id', planId),
        supabase
          .from('vendor_payments')
          .select('id', { head: true, count: 'exact' })
          .eq('plan_id', planId),
      ]);

      if (activeSubError || subHistoryError || paymentHistoryError) {
        return json(500, {
          success: false,
          error:
            activeSubError?.message ||
            subHistoryError?.message ||
            paymentHistoryError?.message ||
            'Failed to validate plan dependencies',
        });
      }

      if ((activeSubscriptionCount || 0) > 0) {
        return json(400, {
          success: false,
          error: 'Plan has active vendor subscriptions. Disable it instead of deleting.',
        });
      }

      if ((subscriptionHistoryCount || 0) > 0 || (paymentHistoryCount || 0) > 0) {
        return json(400, {
          success: false,
          error: 'Plan has subscription/payment history. Keep it inactive instead of deleting.',
        });
      }

      const { error: deleteError } = await supabase
        .from('vendor_plans')
        .delete()
        .eq('id', planId);

      if (deleteError) return json(500, { success: false, error: deleteError.message });

      await writeAuditLog(supabase, {
        actor,
        action: 'VENDOR_PLAN_DELETED',
        entityType: 'vendor_plans',
        entityId: planId,
        details: {
          name: existing.name || null,
          price: Number(existing.price || 0),
        },
      });

      return json(200, { success: true, planId });
    }

    if (event.httpMethod === 'GET' && tail[0] === 'finance' && tail[1] === 'summary') {
      const { data: payments, error } = await supabase.from('vendor_payments').select('amount, net_amount, payment_date');
      if (error) return json(500, { success: false, error: error.message });
      const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      let totalGross = 0;
      let totalNet = 0;
      let last30 = 0;
      (payments || []).forEach((p) => {
        const gross = Number(p.amount || 0);
        const net = Number(p.net_amount ?? p.amount ?? 0);
        totalGross += gross;
        totalNet += net;
        if (p.payment_date && new Date(p.payment_date) >= thirtyAgo) last30 += net;
      });
      await writeAuditLog(supabase, {
        actor,
        action: 'FINANCE_SUMMARY_VIEWED',
        entityType: 'vendor_payments',
        details: { totalGross, totalNet, last30 },
      });
      return json(200, { success: true, data: { totalGross, totalNet, last30 } });
    }

    if (event.httpMethod === 'GET' && tail[0] === 'finance' && tail[1] === 'payments') {
      const { vendor_id, plan_id, from, to, limit = 200 } = event.queryStringParameters || {};
      let query = supabase
        .from('vendor_payments')
        .select('*, vendor:vendors(id, vendor_id, company_name, email), plan:vendor_plans(id, name, price)')
        .order('payment_date', { ascending: false })
        .limit(clampLimit(limit, 200, 2000));
      if (vendor_id) query = query.eq('vendor_id', vendor_id);
      if (plan_id) query = query.eq('plan_id', plan_id);
      if (from) query = query.gte('payment_date', from);
      if (to) query = query.lte('payment_date', to);
      const { data, error } = await query;
      if (error) return json(500, { success: false, error: error.message });
      await writeAuditLog(supabase, {
        actor,
        action: 'FINANCE_PAYMENTS_VIEWED',
        entityType: 'vendor_payments',
        details: {
          filters: {
            vendor_id: vendor_id || null,
            plan_id: plan_id || null,
            from: from || null,
            to: to || null,
          },
          count: data?.length || 0,
        },
      });
      return json(200, { success: true, data: data || [] });
    }

    if (event.httpMethod === 'GET' && tail[0] === 'system-config') {
      const row = await ensureSystemConfigRow(supabase, superadmin.id);
      return json(200, { success: true, config: row });
    }

    if (event.httpMethod === 'PUT' && tail[0] === 'system-config') {
      const existing = await ensureSystemConfigRow(supabase, superadmin.id);
      const payload = {
        config_key: 'maintenance_mode',
        maintenance_mode: body?.maintenance_mode === true,
        maintenance_message: String(body?.maintenance_message || ''),
        allow_vendor_registration:
          typeof body?.allow_vendor_registration === 'boolean'
            ? body.allow_vendor_registration
            : existing.allow_vendor_registration ?? true,
        commission_rate: body?.commission_rate != null ? Number(body.commission_rate) || 0 : existing.commission_rate,
        max_upload_size_mb:
          body?.max_upload_size_mb != null ? Number(body.max_upload_size_mb) || 0 : existing.max_upload_size_mb,
        public_notice_enabled: body?.public_notice_enabled === true,
        public_notice_message: String(body?.public_notice_message || ''),
        public_notice_variant: String(body?.public_notice_variant || existing.public_notice_variant || 'info'),
        updated_at: nowIso(),
        updated_by: superadmin.id || null,
      };
      const { data, error } = await supabase
        .from('system_config')
        .upsert(payload, { onConflict: 'config_key' })
        .select('*')
        .maybeSingle();
      if (error) return json(500, { success: false, error: error.message });
      await writeAuditLog(supabase, {
        actor,
        action: 'SYSTEM_CONFIG_UPDATED',
        entityType: 'system_config',
        entityId: existing?.id || null,
        details: {
          maintenance_mode: payload.maintenance_mode,
          maintenance_message: payload.maintenance_message,
          public_notice_enabled: payload.public_notice_enabled,
          public_notice_variant: payload.public_notice_variant,
        },
      });
      return json(200, { success: true, config: data || payload });
    }

    if (event.httpMethod === 'GET' && tail[0] === 'page-status' && tail.length === 1) {
      const { data, error } = await supabase.from('page_status').select('*').order('page_name', { ascending: true });
      if (error) return json(500, { success: false, error: error.message });
      return json(200, { success: true, pages: data || [] });
    }

    if (event.httpMethod === 'POST' && tail[0] === 'page-status' && tail.length === 1) {
      const page_name = String(body?.page_name || '').trim();
      const page_route = String(body?.page_route || '').trim();
      const error_message = String(body?.error_message || '').trim();
      if (!page_name || !page_route) {
        return json(400, { success: false, error: 'page_name and page_route are required' });
      }
      const payload = { page_name, page_route, error_message, is_blanked: false, updated_at: nowIso() };
      const { data, error } = await supabase.from('page_status').insert([payload]).select('*').maybeSingle();
      if (error) return json(500, { success: false, error: error.message });
      await writeAuditLog(supabase, {
        actor,
        action: 'PAGE_STATUS_CREATED',
        entityType: 'page_status',
        entityId: data?.id || null,
        details: { page_name, page_route },
      });
      return json(200, { success: true, page: data || payload });
    }

    if (event.httpMethod === 'PUT' && tail[0] === 'page-status' && tail[1]) {
      const pageId = tail[1];
      const updates = { updated_at: nowIso() };
      if (typeof body?.is_blanked === 'boolean') updates.is_blanked = body.is_blanked;
      if (body?.error_message != null) updates.error_message = String(body.error_message || '');
      if (body?.page_title != null) updates.page_title = String(body.page_title || '');
      if (body?.page_description != null) updates.page_description = String(body.page_description || '');
      const { data, error } = await supabase.from('page_status').update(updates).eq('id', pageId).select('*').maybeSingle();
      if (error) return json(500, { success: false, error: error.message });
      await writeAuditLog(supabase, {
        actor,
        action: 'PAGE_STATUS_UPDATED',
        entityType: 'page_status',
        entityId: pageId,
        details: updates,
      });
      return json(200, { success: true, page: data || null });
    }

    if (event.httpMethod === 'DELETE' && tail[0] === 'page-status' && tail[1]) {
      const pageId = tail[1];
      const { data: existing } = await supabase
        .from('page_status')
        .select('id, page_name, page_route')
        .eq('id', pageId)
        .maybeSingle();
      const { error } = await supabase.from('page_status').delete().eq('id', pageId);
      if (error) return json(500, { success: false, error: error.message });
      await writeAuditLog(supabase, {
        actor,
        action: 'PAGE_STATUS_DELETED',
        entityType: 'page_status',
        entityId: pageId,
        details: existing || {},
      });
      return json(200, { success: true });
    }

    if (event.httpMethod === 'GET' && tail[0] === 'audit-logs') {
      const query = event.queryStringParameters || {};
      const limit = clampLimit(query.limit, 300, 2000);
      const hoursBack = Number(query.hoursBack ?? query.hours_back ?? 168);
      const actorTypeFilter = String(query.actor_type || '').trim().toUpperCase();
      const entityTypeFilter = String(query.entity_type || '').trim();
      const actionContains = String(query.action_contains || '').trim().toUpperCase();
      const cutoff =
        Number.isFinite(hoursBack) && hoursBack > 0 ? new Date(Date.now() - hoursBack * 60 * 60 * 1000) : null;

      let q = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(limit);
      if (cutoff) q = q.gte('created_at', cutoff.toISOString());
      if (entityTypeFilter) q = q.eq('entity_type', entityTypeFilter);
      if (actionContains) q = q.ilike('action', `%${actionContains}%`);
      const { data, error } = await q;
      if (error) return json(500, { success: false, error: error.message });

      let logs = data || [];
      if (actorTypeFilter) {
        logs = logs.filter((log) => String(log?.details?.actor_type || '').toUpperCase() === actorTypeFilter);
      }

      return json(200, {
        success: true,
        logs: logs.map((log) => ({
          ...log,
          actor: {
            id: log?.details?.actor_id || log.user_id || null,
            type: log?.details?.actor_type || null,
            role: log?.details?.actor_role || null,
            email: log?.details?.actor_email || null,
          },
        })),
      });
    }

    if (!['GET', 'POST', 'PUT', 'DELETE'].includes(event.httpMethod)) {
      return json(405, { success: false, error: 'Method not allowed' });
    }

    return json(404, { success: false, error: 'Not found' });
  } catch (error) {
    return json(500, { success: false, error: error.message || 'Superadmin function failed' });
  }
};
