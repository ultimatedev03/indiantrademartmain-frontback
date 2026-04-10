import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { assertCaptchaForNetlifyEvent } from '../../server/lib/captcha.js';
import { SECURITY_HEADERS } from '../../server/lib/httpSecurity.js';

const TOKEN_KEY = 'superadmin_token';

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    ...SECURITY_HEADERS,
  },
  body: JSON.stringify(body),
});

const nowIso = () => new Date().toISOString();
const normalizeEmail = (v) => String(v || '').trim().toLowerCase();
const normalizeRole = (v) => {
  const r = String(v || '').trim().toUpperCase();
  const compact = r.replace(/[^A-Z]/g, '');
  if (compact === 'DATAENTRY') return 'DATA_ENTRY';
  if (compact === 'GODMODE' || compact === 'SUPERUSER' || compact === 'DEVELOPER') return 'GODMODE';
  if (compact === 'SUPERADMIN') return 'SUPERADMIN';
  return r;
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
    hasOwn(payload, 'discount_label') ||
    hasOwn(payload, 'extra_lead_price');

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
    if (hasOwn(payload, 'extra_lead_price')) {
      pricing.extra_lead_price = toNonNegativeNumber(payload.extra_lead_price, 0);
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

const insertSuperadminWithFallback = async (supabase, payload) => {
  const first = await supabase
    .from('superadmin_users')
    .insert([payload])
    .select('id, email, role, is_active, created_at')
    .maybeSingle();

  if (!first?.error || !hasOwn(payload, 'full_name')) {
    return first;
  }

  const text = `${first.error?.message || ''} ${first.error?.details || ''} ${first.error?.hint || ''}`.toLowerCase();
  const missingFullName =
    (text.includes(`'full_name'`) || text.includes(`"full_name"`) || text.includes('column "full_name"')) &&
    (text.includes('schema cache') || text.includes('does not exist'));

  if (!missingFullName) {
    return first;
  }

  const retryPayload = { ...payload };
  delete retryPayload.full_name;

  return supabase
    .from('superadmin_users')
    .insert([retryPayload])
    .select('id, email, role, is_active, created_at')
    .maybeSingle();
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

const KYC_REVIEW_STATUSES = new Set(['PENDING', 'SUBMITTED']);
const MONITORING_BATCH_SIZE = 1000;
const UNASSIGNED_REGION = { code: 'UNASSIGNED', name: 'Unassigned', sort_order: 999 };

const normalizeText = (value) => String(value ?? '').trim();

// Supabase REST responses are capped per request, so monitoring queries must page through large tables.
const fetchAllRows = async (buildQuery, pageSize = MONITORING_BATCH_SIZE) => {
  const rows = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await buildQuery().range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message || 'Failed to fetch paginated rows');
    if (!Array.isArray(data) || data.length === 0) break;

    rows.push(...data);
    if (data.length < pageSize) break;
  }

  return rows;
};

const isMissingColumnError = (error, tableName, columnName) => {
  const table = String(tableName || '').trim().toLowerCase();
  const column = String(columnName || '').trim().toLowerCase();
  if (!table || !column || !error) return false;

  const text = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
  const mentionsColumn =
    text.includes(`'${column}'`) ||
    text.includes(`"${column}"`) ||
    text.includes(`${table}.${column}`) ||
    text.includes(`column "${table}.${column}"`) ||
    text.includes(`column ${table}.${column}`) ||
    text.includes(`column "${column}"`) ||
    text.includes(`column ${column}`) ||
    text.includes(`column '${column}'`);
  const mentionsTable =
    text.includes(`'${table}'`) ||
    text.includes(`"${table}"`) ||
    text.includes(`relation "${table}"`) ||
    text.includes(`relation '${table}'`) ||
    text.includes(`${table}.`);
  const missingSignal = text.includes('schema cache') || text.includes('does not exist');

  return mentionsColumn && mentionsTable && missingSignal;
};

const selectAdminEmployeesForMonitoring = async (
  supabase,
  { includeCreatedAt = false, orderByCreatedAt = false } = {}
) => {
  const selectColumns = ['id', 'full_name', 'email', 'role', 'status', 'states_scope', 'last_login'];
  if (includeCreatedAt) selectColumns.push('created_at');

  let query = supabase.from('employees').select(selectColumns.join(', ')).eq('role', 'ADMIN');
  if (orderByCreatedAt) {
    query = query.order('created_at', { ascending: false });
  }

  const first = await query;
  if (!isMissingColumnError(first?.error, 'employees', 'last_login')) {
    return first;
  }

  const fallbackColumns = selectColumns.filter((column) => column !== 'last_login');
  let retry = supabase.from('employees').select(fallbackColumns.join(', ')).eq('role', 'ADMIN');
  if (orderByCreatedAt) {
    retry = retry.order('created_at', { ascending: false });
  }

  const fallback = await retry;
  if (!fallback?.error && Array.isArray(fallback?.data)) {
    fallback.data = fallback.data.map((row) => ({ ...row, last_login: null }));
  }
  return fallback;
};

const loadStateCatalog = async (supabase) => {
  const [{ data: states, error: statesErr }, { data: regions, error: regionsErr }] = await Promise.all([
    supabase
      .from('states')
      .select('id, name, slug, region_code')
      .order('name', { ascending: true }),
    supabase
      .from('regions')
      .select('code, name, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
  ]);

  if (statesErr) throw new Error(statesErr.message || 'Failed to load states');
  if (regionsErr) throw new Error(regionsErr.message || 'Failed to load regions');

  const regionByCode = new Map(
    [UNASSIGNED_REGION, ...(regions || [])].map((region) => {
      const code = normalizeText(region.code).toUpperCase();
      return [
        code,
        {
          code,
          name: normalizeText(region.name) || code,
          sort_order: Number(region.sort_order ?? UNASSIGNED_REGION.sort_order),
        },
      ];
    })
  );

  const catalogStates = (states || []).map((state) => {
    const regionCode = normalizeText(state.region_code).toUpperCase() || UNASSIGNED_REGION.code;
    const region = regionByCode.get(regionCode) || UNASSIGNED_REGION;
    return {
      id: String(state.id),
      name: normalizeText(state.name),
      slug: normalizeText(state.slug),
      region_code: region.code,
      region_name: region.name,
      region_sort_order: Number(region.sort_order ?? UNASSIGNED_REGION.sort_order),
    };
  });

  return {
    states: catalogStates,
    regions: Array.from(regionByCode.values()).sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name)),
    stateById: new Map(catalogStates.map((state) => [state.id, state])),
    stateByName: new Map(catalogStates.map((state) => [state.name.toLowerCase(), state])),
  };
};

const resolveStateInfo = (stateId, fallbackState, stateCatalog) => {
  if (stateId) {
    const state = stateCatalog.stateById.get(String(stateId));
    if (state) return state;
  }

  const fallback = normalizeText(fallbackState);
  if (fallback) {
    const state = stateCatalog.stateByName.get(fallback.toLowerCase());
    if (state) return state;
  }

  return {
    id: '',
    name: fallback || 'Unknown',
    slug: '',
    region_code: UNASSIGNED_REGION.code,
    region_name: UNASSIGNED_REGION.name,
    region_sort_order: UNASSIGNED_REGION.sort_order,
  };
};

const normalizeRequestedStateScope = (rawScope, stateCatalog) => {
  const values = Array.isArray(rawScope) ? rawScope : [];
  const seen = new Set();
  const invalid = [];
  const stateIds = [];
  const stateNames = [];

  values.forEach((value) => {
    const raw = normalizeText(
      typeof value === 'object' && value !== null
        ? (value.id ?? value.state_id ?? value.name ?? '')
        : value
    );
    if (!raw) return;

    const state =
      stateCatalog.stateById.get(raw) ||
      stateCatalog.stateByName.get(raw.toLowerCase()) ||
      null;

    if (!state) {
      invalid.push(raw);
      return;
    }

    if (seen.has(state.id)) return;
    seen.add(state.id);
    stateIds.push(state.id);
    stateNames.push(state.name);
  });

  if (invalid.length) {
    const err = new Error(`Invalid states: ${invalid.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  return { stateIds, stateNames };
};

const loadEmployeeScopeRows = async (supabase, employeeIds = []) => {
  const ids = [...new Set((employeeIds || []).map((id) => normalizeText(id)).filter(Boolean))];
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from('employee_state_scope')
    .select('employee_id, state_id')
    .in('employee_id', ids);

  if (error) throw new Error(error.message || 'Failed to load employee state scope');
  return data || [];
};

const hydrateEmployeesWithStateScope = async (supabase, employees = [], stateCatalog = null) => {
  const catalog = stateCatalog || await loadStateCatalog(supabase);
  const employeeIds = employees.map((employee) => employee?.id).filter(Boolean);
  const scopeRows = await loadEmployeeScopeRows(supabase, employeeIds);
  const scopeByEmployeeId = new Map(employeeIds.map((id) => [String(id), []]));

  (scopeRows || []).forEach((row) => {
    const key = String(row.employee_id || '');
    if (!scopeByEmployeeId.has(key)) scopeByEmployeeId.set(key, []);
    scopeByEmployeeId.get(key).push(String(row.state_id || ''));
  });

  return employees.map((employee) => {
    const employeeId = String(employee?.id || '');
    let stateIds = [...new Set((scopeByEmployeeId.get(employeeId) || []).filter((id) => catalog.stateById.has(id)))];

    if (!stateIds.length && Array.isArray(employee?.states_scope) && employee.states_scope.length > 0) {
      stateIds = normalizeRequestedStateScope(employee.states_scope, catalog).stateIds;
    }

    const stateNames = stateIds
      .map((stateId) => catalog.stateById.get(stateId)?.name || '')
      .filter(Boolean);

    return {
      ...employee,
      state_scope_ids: stateIds,
      states_scope: stateNames,
    };
  });
};

const syncEmployeeStateScope = async (supabase, employeeId, rawScope, stateCatalog = null) => {
  const catalog = stateCatalog || await loadStateCatalog(supabase);
  const { stateIds, stateNames } = normalizeRequestedStateScope(rawScope, catalog);

  const { error: deleteError } = await supabase
    .from('employee_state_scope')
    .delete()
    .eq('employee_id', employeeId);

  if (deleteError) throw new Error(deleteError.message || 'Failed to clear employee state scope');

  if (stateIds.length > 0) {
    const { error: insertError } = await supabase
      .from('employee_state_scope')
      .insert(
        stateIds.map((stateId) => ({
          employee_id: employeeId,
          state_id: stateId,
          created_at: nowIso(),
          updated_at: nowIso(),
        }))
      );

    if (insertError) throw new Error(insertError.message || 'Failed to save employee state scope');
  }

  const { error: employeeUpdateError } = await supabase
    .from('employees')
    .update({ states_scope: stateNames, updated_at: nowIso() })
    .eq('id', employeeId);

  if (employeeUpdateError) throw new Error(employeeUpdateError.message || 'Failed to mirror employee state scope');

  return { stateIds, stateNames, stateCatalog: catalog };
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

const requireGodMode = async (event, supabase) => {
  const guard = await requireSuperAdmin(event, supabase);
  if (guard.response) return guard;

  const role = normalizeRole(guard?.superadmin?.role || guard?.actor?.role || 'SUPERADMIN');
  if (role !== 'GODMODE') {
    return {
      response: json(403, {
        success: false,
        error: 'GOD MODE access required. This action is restricted to the platform developer.',
      }),
    };
  }

  return guard;
};

const handleLogin = async (event, supabase, body) => {
  await assertCaptchaForNetlifyEvent(event, body, { action: 'superadmin_login' });

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
      return handleLogin(event, supabase, body);
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

    if (tail[0] === 'godmode') {
      const godmodeGuard = await requireGodMode(event, supabase);
      if (godmodeGuard.response) return godmodeGuard.response;
      const godmodeActor = godmodeGuard.actor;

      if (event.httpMethod === 'GET' && tail[1] === 'superadmins' && tail.length === 2) {
        const { data, error } = await supabase
          .from('superadmin_users')
          .select('id, email, role, is_active, last_login, created_at')
          .order('created_at', { ascending: false });

        if (error) return json(500, { success: false, error: error.message });

        await writeAuditLog(supabase, {
          actor: godmodeActor,
          action: 'GODMODE_SUPERADMINS_VIEWED',
          entityType: 'superadmin_users',
          details: { count: data?.length || 0 },
        });

        return json(200, { success: true, superadmins: data || [] });
      }

      if (event.httpMethod === 'POST' && tail[1] === 'superadmins' && tail.length === 2) {
        const email = normalizeEmail(body?.email);
        const password = String(body?.password || '').trim();
        const fullName = String(body?.full_name || '').trim();

        if (!email || !password) {
          return json(400, { success: false, error: 'email and password are required' });
        }

        const role = 'SUPERADMIN';
        const { data: existing, error: existingError } = await supabase
          .from('superadmin_users')
          .select('id')
          .eq('email', email)
          .maybeSingle();

        if (existingError) return json(500, { success: false, error: existingError.message });
        if (existing?.id) {
          return json(400, { success: false, error: 'A superadmin with this email already exists' });
        }

        const { data, error } = await insertSuperadminWithFallback(supabase, {
          email,
          full_name: fullName || email,
          role,
          password_hash: await hashPassword(password),
          is_active: true,
          created_at: nowIso(),
          updated_at: nowIso(),
        });

        if (error) return json(500, { success: false, error: error.message });

        await writeAuditLog(supabase, {
          actor: godmodeActor,
          action: 'SUPERADMIN_CREATED',
          entityType: 'superadmin_users',
          entityId: data?.id || null,
          details: { email, role },
        });

        return json(200, { success: true, superadmin: data });
      }

      if (event.httpMethod === 'PUT' && tail[1] === 'superadmins' && tail[2] && tail[3] === 'toggle-active') {
        const id = tail[2];
        const { data: target, error: fetchError } = await supabase
          .from('superadmin_users')
          .select('id, email, role, is_active')
          .eq('id', id)
          .maybeSingle();

        if (fetchError) return json(500, { success: false, error: fetchError.message });
        if (!target) return json(404, { success: false, error: 'Superadmin not found' });
        if (normalizeRole(target.role) === 'GODMODE') {
          return json(403, { success: false, error: 'Cannot deactivate GOD MODE account' });
        }

        const newStatus = !target.is_active;
        const { data, error } = await supabase
          .from('superadmin_users')
          .update({ is_active: newStatus, updated_at: nowIso() })
          .eq('id', id)
          .select('id, email, role, is_active')
          .maybeSingle();

        if (error) return json(500, { success: false, error: error.message });

        await writeAuditLog(supabase, {
          actor: godmodeActor,
          action: newStatus ? 'SUPERADMIN_ACTIVATED' : 'SUPERADMIN_DEACTIVATED',
          entityType: 'superadmin_users',
          entityId: id,
          details: { email: target.email, role: target.role, is_active: newStatus },
        });

        return json(200, { success: true, superadmin: data });
      }

      if (event.httpMethod === 'DELETE' && tail[1] === 'superadmins' && tail[2] && tail.length === 3) {
        const id = tail[2];
        const { data: target, error: fetchError } = await supabase
          .from('superadmin_users')
          .select('id, email, role')
          .eq('id', id)
          .maybeSingle();

        if (fetchError) return json(500, { success: false, error: fetchError.message });
        if (!target) return json(404, { success: false, error: 'Superadmin not found' });
        if (normalizeRole(target.role) === 'GODMODE') {
          return json(403, { success: false, error: 'Cannot delete GOD MODE account' });
        }

        const { error } = await supabase.from('superadmin_users').delete().eq('id', id);
        if (error) return json(500, { success: false, error: error.message });

        await writeAuditLog(supabase, {
          actor: godmodeActor,
          action: 'SUPERADMIN_DELETED',
          entityType: 'superadmin_users',
          entityId: id,
          details: { email: target.email, role: target.role },
        });

        return json(200, { success: true });
      }

      if (event.httpMethod === 'PUT' && tail[1] === 'superadmins' && tail[2] && tail[3] === 'password') {
        const id = tail[2];
        const newPassword = String(body?.password || '').trim();

        if (!newPassword || newPassword.length < 8) {
          return json(400, { success: false, error: 'Password must be at least 8 characters' });
        }

        const { data: target, error: fetchError } = await supabase
          .from('superadmin_users')
          .select('id, email, role')
          .eq('id', id)
          .maybeSingle();

        if (fetchError) return json(500, { success: false, error: fetchError.message });
        if (!target) return json(404, { success: false, error: 'Superadmin not found' });
        if (normalizeRole(target.role) === 'GODMODE') {
          return json(403, { success: false, error: 'Use /password endpoint to change your own GOD MODE password' });
        }

        const { error } = await supabase
          .from('superadmin_users')
          .update({ password_hash: await hashPassword(newPassword), updated_at: nowIso() })
          .eq('id', id);

        if (error) return json(500, { success: false, error: error.message });

        await writeAuditLog(supabase, {
          actor: godmodeActor,
          action: 'SUPERADMIN_PASSWORD_RESET',
          entityType: 'superadmin_users',
          entityId: id,
          details: { email: target.email },
        });

        return json(200, { success: true });
      }
    }

    if (event.httpMethod === 'GET' && tail[0] === 'states' && tail.length === 1) {
      const stateCatalog = await loadStateCatalog(supabase);
      return json(200, {
        success: true,
        states: stateCatalog.states.map((state) => ({
          id: state.id,
          name: state.name,
          slug: state.slug,
          region_code: state.region_code,
          region_name: state.region_name,
        })),
      });
    }

    if (event.httpMethod === 'GET' && tail[0] === 'employees' && tail.length === 1) {
      const { data, error } = await supabase.from('employees').select('*').order('created_at', { ascending: false });
      if (error) return json(500, { success: false, error: error.message });
      const employees = await hydrateEmployeesWithStateScope(supabase, data || []);
      await writeAuditLog(supabase, {
        actor,
        action: 'EMPLOYEES_VIEWED',
        entityType: 'employees',
        details: { count: data?.length || 0 },
      });
      return json(200, { success: true, employees });
    }

    if (event.httpMethod === 'POST' && tail[0] === 'employees' && tail.length === 1) {
      const fullName = String(body?.full_name || '').trim();
      const email = normalizeEmail(body?.email);
      const password = String(body?.password || '').trim();
      const role = normalizeRole(body?.role || 'DATA_ENTRY');
      const phone = String(body?.phone || '').trim() || null;
      const department = String(body?.department || '').trim() || 'Operations';
      const status = normalizeRole(body?.status || 'ACTIVE') || 'ACTIVE';
      const stateCatalog = await loadStateCatalog(supabase);
      const rawScope = Array.isArray(body?.state_scope_ids) ? body.state_scope_ids : body?.states_scope;
      const { stateIds: stateScopeIds, stateNames: statesScope } =
        role === 'ADMIN'
          ? normalizeRequestedStateScope(rawScope, stateCatalog)
          : { stateIds: [], stateNames: [] };

      if (!fullName || !email || !password) {
        return json(400, { success: false, error: 'full_name, email and password are required' });
      }
      const allowedRoles = ['ADMIN', 'HR', 'DATA_ENTRY', 'SUPPORT', 'SALES', 'FINANCE'];
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
        states_scope: statesScope,
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

      let hydratedEmployee = employee || empPayload;
      if (employee?.id) {
        await syncEmployeeStateScope(supabase, employee.id, stateScopeIds, stateCatalog);
        [hydratedEmployee] = await hydrateEmployeesWithStateScope(supabase, [employee], stateCatalog);
      }

      await writeAuditLog(supabase, {
        actor,
        action: 'EMPLOYEE_CREATED',
        entityType: 'employees',
        entityId: employee?.id || null,
        details: { email, role, department, user_id: userId, state_scope_ids: stateScopeIds, states_scope: statesScope },
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

      return json(200, { success: true, employee: hydratedEmployee });
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

    if (event.httpMethod === 'PUT' && tail[0] === 'employees' && tail[1] && tail[2] === 'states-scope') {
      const employeeId = tail[1];
      const rawStates = Array.isArray(body?.state_scope_ids) ? body.state_scope_ids : body?.states_scope;

      if (!Array.isArray(rawStates)) {
        return json(400, { success: false, error: 'state_scope_ids or states_scope must be an array' });
      }

      const { data: employee, error: employeeError } = await supabase
        .from('employees')
        .select('id, role, full_name, email')
        .eq('id', employeeId)
        .maybeSingle();

      if (employeeError) return json(500, { success: false, error: employeeError.message });
      if (!employee) return json(404, { success: false, error: 'Employee not found' });
      if (employee.role !== 'ADMIN') {
        return json(400, { success: false, error: 'states_scope can only be set on ADMIN employees' });
      }

      const stateCatalog = await loadStateCatalog(supabase);
      const { stateIds, stateNames } = await syncEmployeeStateScope(supabase, employeeId, rawStates, stateCatalog);

      await writeAuditLog(supabase, {
        actor,
        action: 'ADMIN_STATES_SCOPE_UPDATED',
        entityType: 'employees',
        entityId: employeeId,
        details: { email: employee.email, state_scope_ids: stateIds, states_scope: stateNames },
      });

      return json(200, { success: true, state_scope_ids: stateIds, states_scope: stateNames });
    }

    if (event.httpMethod === 'GET' && tail[0] === 'monitoring' && tail[1] === 'overview') {
      const [
        { data: adminEmployeesRaw, error: adminError },
        stateCatalog,
        vendors,
        payments,
        tickets,
      ] = await Promise.all([
        selectAdminEmployeesForMonitoring(supabase, { includeCreatedAt: true, orderByCreatedAt: true }),
        loadStateCatalog(supabase),
        fetchAllRows(() =>
          supabase
            .from('vendors')
            .select('id, state_id, state, kyc_status, is_active')
            .order('id', { ascending: true })
        ),
        fetchAllRows(() =>
          supabase
            .from('vendor_payments')
            .select('id, vendor_id, amount, net_amount, payment_date')
            .order('id', { ascending: true })
        ),
        fetchAllRows(() =>
          supabase
            .from('support_tickets')
            .select('id, status, vendor_id, created_at')
            .not('status', 'eq', 'RESOLVED')
            .order('id', { ascending: true })
        ),
      ]);

      if (adminError) return json(500, { success: false, error: adminError.message });
      const adminEmployees = await hydrateEmployeesWithStateScope(supabase, adminEmployeesRaw || [], stateCatalog);

      const allVendors = vendors || [];
      const allPayments = payments || [];
      const allTickets = tickets || [];
      const vendorStateById = new Map();
      const regionSortOrderByName = new Map((stateCatalog.regions || []).map((region) => [region.name, Number(region.sort_order ?? UNASSIGNED_REGION.sort_order)]));

      const totalRevenue = allPayments.reduce((sum, payment) => sum + Number(payment.net_amount ?? payment.amount ?? 0), 0);
      const totalVendors = allVendors.filter((vendor) => vendor.is_active).length;
      const kycPending = allVendors.filter((vendor) => KYC_REVIEW_STATUSES.has(normalizeText(vendor.kyc_status).toUpperCase())).length;
      const openTickets = allTickets.length;

      const byState = {};

      allVendors.forEach((vendor) => {
        const stateInfo = resolveStateInfo(vendor.state_id, vendor.state, stateCatalog);
        const state = stateInfo.name;
        vendorStateById.set(String(vendor.id), stateInfo);
        if (!byState[state]) {
          byState[state] = {
            state,
            region: stateInfo.region_name,
            region_sort_order: Number(stateInfo.region_sort_order ?? UNASSIGNED_REGION.sort_order),
            revenue: 0,
            vendors: 0,
            kycPending: 0,
            openTickets: 0,
          };
        }
        if (vendor.is_active) byState[state].vendors += 1;
        if (KYC_REVIEW_STATUSES.has(normalizeText(vendor.kyc_status).toUpperCase())) byState[state].kycPending += 1;
      });

      allPayments.forEach((payment) => {
        const stateInfo = vendorStateById.get(String(payment.vendor_id)) || resolveStateInfo('', 'Unknown', stateCatalog);
        const state = stateInfo.name;
        if (!byState[state]) {
          byState[state] = {
            state,
            region: stateInfo.region_name,
            region_sort_order: Number(stateInfo.region_sort_order ?? UNASSIGNED_REGION.sort_order),
            revenue: 0,
            vendors: 0,
            kycPending: 0,
            openTickets: 0,
          };
        }
        byState[state].revenue += Number(payment.net_amount ?? payment.amount ?? 0);
      });

      allTickets.forEach((ticket) => {
        const stateInfo = vendorStateById.get(String(ticket.vendor_id)) || resolveStateInfo('', 'Unknown', stateCatalog);
        const state = stateInfo.name;
        if (!byState[state]) {
          byState[state] = {
            state,
            region: stateInfo.region_name,
            region_sort_order: Number(stateInfo.region_sort_order ?? UNASSIGNED_REGION.sort_order),
            revenue: 0,
            vendors: 0,
            kycPending: 0,
            openTickets: 0,
          };
        }
        byState[state].openTickets += 1;
      });

      const byRegion = {};
      Object.values(byState).forEach((stateSummary) => {
        const region = stateSummary.region;
        if (!byRegion[region]) {
          byRegion[region] = {
            region,
            region_sort_order: Number(regionSortOrderByName.get(region) ?? stateSummary.region_sort_order ?? UNASSIGNED_REGION.sort_order),
            revenue: 0,
            vendors: 0,
            kycPending: 0,
            openTickets: 0,
            states: [],
          };
        }
        byRegion[region].revenue += stateSummary.revenue;
        byRegion[region].vendors += stateSummary.vendors;
        byRegion[region].kycPending += stateSummary.kycPending;
        byRegion[region].openTickets += stateSummary.openTickets;
        byRegion[region].states.push(stateSummary.state);
      });

      const admins = (adminEmployees || []).map((employee) => {
        const scope = Array.isArray(employee.states_scope) ? employee.states_scope : [];
        const scopedStates = scope.map((state) => String(state).toLowerCase().trim());
        let revenue = 0;
        let vendorCount = 0;
        let pendingCount = 0;
        let ticketCount = 0;

        Object.values(byState).forEach((stateSummary) => {
          if (scopedStates.length === 0 || scopedStates.includes(stateSummary.state.toLowerCase())) {
            revenue += stateSummary.revenue;
            vendorCount += stateSummary.vendors;
            pendingCount += stateSummary.kycPending;
            ticketCount += stateSummary.openTickets;
          }
        });

        return {
          id: employee.id,
          full_name: employee.full_name,
          email: employee.email,
          status: employee.status,
          states_scope: scope,
          state_scope_ids: Array.isArray(employee.state_scope_ids) ? employee.state_scope_ids : [],
          last_login: employee.last_login,
          revenue: scopedStates.length > 0 ? revenue : null,
          vendors: scopedStates.length > 0 ? vendorCount : null,
          kycPending: scopedStates.length > 0 ? pendingCount : null,
          openTickets: scopedStates.length > 0 ? ticketCount : null,
        };
      });

      return json(200, {
        success: true,
        data: {
          allIndia: { totalRevenue, totalVendors, kycPending, openTickets },
          byRegion: Object.values(byRegion).sort((a, b) => (a.region_sort_order - b.region_sort_order) || (b.revenue - a.revenue) || a.region.localeCompare(b.region)),
          byState: Object.values(byState).sort((a, b) => (b.revenue - a.revenue) || (b.vendors - a.vendors) || a.state.localeCompare(b.state)),
          admins,
        },
      });
    }

    if (event.httpMethod === 'GET' && tail[0] === 'monitoring' && tail[1] === 'admin-activity') {
      const days = Math.min(Number(event.queryStringParameters?.days ?? 7), 90);
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const [logs, { data: adminsRaw, error: adminsError }, stateCatalog] = await Promise.all([
        fetchAllRows(() =>
          supabase
            .from('audit_logs')
            .select('id, user_id, action, details, created_at')
            .gte('created_at', cutoff)
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
        ),
        selectAdminEmployeesForMonitoring(supabase),
        loadStateCatalog(supabase),
      ]);

      if (adminsError) return json(500, { success: false, error: adminsError.message });
      const admins = await hydrateEmployeesWithStateScope(supabase, adminsRaw || [], stateCatalog);

      const adminMap = {};
      (admins || []).forEach((admin) => {
        adminMap[admin.id] = {
          ...admin,
          actionsTotal: 0,
          kycApproved: 0,
          kycRejected: 0,
          vendorsTerminated: 0,
          vendorsActivated: 0,
          staffCreated: 0,
          ticketsResolved: 0,
          recentActions: [],
        };
      });

      (logs || []).forEach((log) => {
        const actorId = log.details?.actor_id || log.user_id;
        if (!actorId || !adminMap[actorId]) return;

        const entry = adminMap[actorId];
        entry.actionsTotal += 1;

        const action = String(log.action || '').toUpperCase();
        if (action.includes('KYC_APPROV')) entry.kycApproved += 1;
        else if (action.includes('KYC_REJECT')) entry.kycRejected += 1;
        else if (action.includes('VENDOR_TERM')) entry.vendorsTerminated += 1;
        else if (action.includes('VENDOR_ACTIV')) entry.vendorsActivated += 1;
        else if (action.includes('STAFF_CREAT') || action.includes('EMPLOYEE_CREAT')) entry.staffCreated += 1;
        else if (action.includes('TICKET') && action.includes('RESOLV')) entry.ticketsResolved += 1;

        if (entry.recentActions.length < 5) {
          entry.recentActions.push({ action: log.action, created_at: log.created_at });
        }
      });

      return json(200, {
        success: true,
        data: {
          days,
          activity: Object.values(adminMap).sort((a, b) => b.actionsTotal - a.actionsTotal),
        },
      });
    }

    if (event.httpMethod === 'GET' && tail[0] === 'monitoring' && tail[1] === 'revenue-by-state') {
      const [stateCatalog, vendors, payments] = await Promise.all([
        loadStateCatalog(supabase),
        fetchAllRows(() =>
          supabase
            .from('vendors')
            .select('id, state_id, state')
            .order('id', { ascending: true })
        ),
        fetchAllRows(() =>
          supabase
            .from('vendor_payments')
            .select('id, vendor_id, amount, net_amount, payment_date')
            .order('payment_date', { ascending: false })
            .order('id', { ascending: false })
        ),
      ]);

      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const byState = {};
      const vendorStateById = new Map((vendors || []).map((vendor) => [
        String(vendor.id),
        resolveStateInfo(vendor.state_id, vendor.state, stateCatalog),
      ]));

      (payments || []).forEach((payment) => {
        const stateInfo = vendorStateById.get(String(payment.vendor_id)) || resolveStateInfo('', 'Unknown', stateCatalog);
        const state = stateInfo.name;
        const region = stateInfo.region_name;
        const amount = Number(payment.net_amount ?? payment.amount ?? 0);
        const date = payment.payment_date ? new Date(payment.payment_date) : null;

        if (!byState[state]) {
          byState[state] = { state, region, totalRevenue: 0, paymentCount: 0, thisMonth: 0, lastMonth: 0 };
        }

        byState[state].totalRevenue += amount;
        byState[state].paymentCount += 1;

        if (date) {
          if (date >= thisMonthStart) byState[state].thisMonth += amount;
          else if (date >= lastMonthStart) byState[state].lastMonth += amount;
        }
      });

      return json(200, {
        success: true,
        data: Object.values(byState)
          .sort((a, b) => (b.totalRevenue - a.totalRevenue) || (b.paymentCount - a.paymentCount) || a.state.localeCompare(b.state))
          .map((stateSummary) => ({
            ...stateSummary,
            trend:
              stateSummary.lastMonth > 0
                ? ((stateSummary.thisMonth - stateSummary.lastMonth) / stateSummary.lastMonth) * 100
                : null,
          })),
      });
    }

    if (event.httpMethod === 'GET' && tail[0] === 'vendors' && tail.length === 1) {
      const limit = clampLimit(event.queryStringParameters?.limit, 500, 2000);
      const offset = toNonNegativeInteger(event.queryStringParameters?.offset, 0);
      const { data, error, count } = await supabase
        .from('vendors')
        .select(
          'id, vendor_id, company_name, owner_name, email, phone, kyc_status, created_at, is_active, is_verified, city, state',
          { count: 'exact' }
        )
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) return json(500, { success: false, error: error.message });
      await writeAuditLog(supabase, {
        actor,
        action: 'VENDORS_VIEWED',
        entityType: 'vendors',
        details: { count: data?.length || 0, total: Number(count) || 0, limit, offset },
      });
      return json(200, { success: true, vendors: data || [], total: Number(count) || 0, limit, offset });
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
          extra_lead_price: toNonNegativeNumber(payload?.features?.pricing?.extra_lead_price, 0),
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
        hasOwn(body, 'extra_lead_price') ||
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
    const statusCode = error?.statusCode || 500;
    return json(statusCode, {
      success: false,
      error:
        statusCode >= 500 && !error?.statusCode
          ? 'Superadmin function failed'
          : error?.message || 'Superadmin function failed',
    });
  }
};
