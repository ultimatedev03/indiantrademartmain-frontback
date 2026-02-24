import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'itm_access';

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  },
  body: JSON.stringify(body),
});

const getSupabase = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Missing Supabase credentials');
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
};

const parseTail = (eventPath = '') => {
  const parts = String(eventPath || '').split('/').filter(Boolean);
  const idx = parts.lastIndexOf('territory');
  return idx >= 0 ? parts.slice(idx + 1) : parts;
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
  const cookieHeader = event?.headers?.cookie || event?.headers?.Cookie || '';
  const cookies = parseCookies(cookieHeader);
  return cookies[name];
};

const getJwtSecret = () =>
  process.env.JWT_SECRET ||
  process.env.SUPABASE_JWT_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const verifyAuthToken = (token) => {
  try {
    const secret = getJwtSecret();
    if (!secret) return null;
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
};

const normalizeRole = (role) => String(role || '').trim().toUpperCase();
const normalizeText = (value = '') => String(value || '').trim();
const unique = (arr = []) => Array.from(new Set((arr || []).map((v) => String(v || '').trim()).filter(Boolean)));
const nowIso = () => new Date().toISOString();

const VP_ROLES = new Set(['VP', 'ADMIN', 'SUPERADMIN']);
const MANAGER_ROLES = new Set(['MANAGER', 'VP', 'ADMIN', 'SUPERADMIN']);
const SALES_ROLES = new Set(['SALES', 'MANAGER', 'VP', 'ADMIN', 'SUPERADMIN']);
const ENGAGEMENT_TYPES = new Set([
  'CALL',
  'WHATSAPP',
  'VISIT',
  'DEMO',
  'FOLLOW_UP',
  'PLAN_PITCH',
  'CONVERTED',
  'UNMASK_REQUEST',
]);

const isVpOrAdmin = (role) => VP_ROLES.has(normalizeRole(role));
const isManagerOrAbove = (role) => MANAGER_ROLES.has(normalizeRole(role));
const isSalesOrAbove = (role) => SALES_ROLES.has(normalizeRole(role));

const maskPhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 4) return `${digits[0] || ''}${'*'.repeat(Math.max(0, digits.length - 2))}${digits.slice(-1)}`;
  return `${digits.slice(0, 2)}${'*'.repeat(digits.length - 4)}${digits.slice(-2)}`;
};

const maskEmail = (email) => {
  const value = String(email || '').trim();
  if (!value || !value.includes('@')) return '';
  const [local, domain] = value.split('@');
  if (!domain) return '';
  const maskedLocal =
    local.length <= 2
      ? `${local[0] || ''}*`
      : `${local.slice(0, 2)}${'*'.repeat(Math.max(1, local.length - 2))}`;
  return `${maskedLocal}@${domain}`;
};

const readBody = (event) => {
  if (!event?.body) return {};
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const resolveAuthUser = (event) => {
  const token = parseBearerToken(event.headers || {}) || getCookie(event, AUTH_COOKIE_NAME);
  if (!token) return null;
  const decoded = verifyAuthToken(token);
  if (!decoded?.sub) return null;
  return {
    id: decoded.sub,
    email: decoded.email || null,
    role: normalizeRole(decoded.role || 'USER'),
  };
};

const resolveEmployee = async (supabase, user = {}) => {
  const userId = String(user?.id || '').trim();
  const email = String(user?.email || '').trim().toLowerCase();
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .or([userId ? `user_id.eq.${userId}` : null, email ? `email.eq.${email}` : null].filter(Boolean).join(','))
    .maybeSingle();
  if (error) throw new Error(error.message || 'Failed to resolve employee');
  if (data?.id && !data.user_id && userId) {
    await supabase.from('employees').update({ user_id: userId }).eq('id', data.id);
    data.user_id = userId;
  }
  return data || null;
};

const getScopedDivisionIds = async (supabase, role, actorUserId) => {
  if (isVpOrAdmin(role)) return null;
  if (normalizeRole(role) === 'MANAGER') {
    const { data, error } = await supabase
      .from('vp_manager_division_allocations')
      .select('division_id')
      .eq('manager_user_id', actorUserId)
      .eq('allocation_status', 'ACTIVE');
    if (error) throw new Error(error.message || 'Failed to fetch manager division scope');
    return unique((data || []).map((r) => r.division_id));
  }
  if (normalizeRole(role) === 'SALES') {
    const { data, error } = await supabase
      .from('manager_sales_division_allocations')
      .select('division_id')
      .eq('sales_user_id', actorUserId)
      .eq('allocation_status', 'ACTIVE');
    if (error) throw new Error(error.message || 'Failed to fetch sales division scope');
    return unique((data || []).map((r) => r.division_id));
  }
  return [];
};

const getDivisions = async (supabase, scope, query = {}) => {
  let req = supabase
    .from('geo_divisions')
    .select('id, division_key, name, slug, state_id, city_id, district_name, subdistrict_name, pincode_count, is_active, state:states(name), city:cities(name)')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (query?.state_id) req = req.eq('state_id', query.state_id);
  if (query?.city_id) req = req.eq('city_id', query.city_id);
  if (query?.division_id) req = req.eq('id', query.division_id);

  if (Array.isArray(scope)) {
    if (!scope.length) return [];
    req = req.in('id', scope);
  }

  const { data, error } = await req;
  if (error) throw new Error(error.message || 'Failed to fetch divisions');
  return data || [];
};

const validateEmployeeRole = async (supabase, userId, expectedRole) => {
  const { data, error } = await supabase
    .from('employees')
    .select('id, role, status')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message || 'Failed to validate employee');
  if (!data?.id) return { ok: false, reason: 'Employee not found' };
  if (normalizeRole(data.status || 'ACTIVE') !== 'ACTIVE') return { ok: false, reason: 'Employee is not active' };
  if (normalizeRole(data.role) !== normalizeRole(expectedRole)) return { ok: false, reason: `Employee role must be ${normalizeRole(expectedRole)}` };
  return { ok: true };
};

const resolveDivisionFromVendor = async (supabase, vendorId, preferredDivisionId = '') => {
  const requestedDivisionId = normalizeText(preferredDivisionId);
  if (requestedDivisionId) return requestedDivisionId;

  const { data: mapped, error: mapErr } = await supabase
    .from('vendor_division_map')
    .select('division_id')
    .eq('vendor_id', vendorId)
    .maybeSingle();
  if (mapErr) throw new Error(mapErr.message || 'Failed to resolve vendor division map');
  if (mapped?.division_id) return mapped.division_id;

  const { data: vendor, error: vendorErr } = await supabase
    .from('vendors')
    .select('city_id')
    .eq('id', vendorId)
    .maybeSingle();
  if (vendorErr) throw new Error(vendorErr.message || 'Failed to resolve vendor city');
  if (!vendor?.city_id) return null;

  const { data: division, error: divisionErr } = await supabase
    .from('geo_divisions')
    .select('id')
    .eq('city_id', vendor.city_id)
    .eq('is_active', true)
    .order('pincode_count', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (divisionErr) throw new Error(divisionErr.message || 'Failed to resolve division by city');
  return division?.id || null;
};

const resolveVpUserForManager = async (supabase, managerUserId, divisionId = null) => {
  if (!managerUserId) return null;

  let scoped = supabase
    .from('vp_manager_division_allocations')
    .select('vp_user_id')
    .eq('manager_user_id', managerUserId)
    .eq('allocation_status', 'ACTIVE')
    .order('allocated_at', { ascending: false })
    .limit(1);

  if (divisionId) scoped = scoped.eq('division_id', divisionId);

  const { data: scopedVp, error: scopedErr } = await scoped.maybeSingle();
  if (scopedErr) throw new Error(scopedErr.message || 'Failed to resolve VP for manager');
  if (scopedVp?.vp_user_id) return scopedVp.vp_user_id;

  if (!divisionId) return null;

  const { data: fallbackVp, error: fallbackErr } = await supabase
    .from('vp_manager_division_allocations')
    .select('vp_user_id')
    .eq('manager_user_id', managerUserId)
    .eq('allocation_status', 'ACTIVE')
    .order('allocated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (fallbackErr) throw new Error(fallbackErr.message || 'Failed to resolve fallback VP for manager');
  return fallbackVp?.vp_user_id || null;
};

const resolveSalesHierarchyForVendor = async (supabase, salesUserId, vendorId, preferredDivisionId = '') => {
  let divisionId = await resolveDivisionFromVendor(supabase, vendorId, preferredDivisionId);
  let managerUserId = null;

  if (divisionId) {
    const { data: scopedManager, error: scopedErr } = await supabase
      .from('manager_sales_division_allocations')
      .select('manager_user_id')
      .eq('sales_user_id', salesUserId)
      .eq('division_id', divisionId)
      .eq('allocation_status', 'ACTIVE')
      .order('allocated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (scopedErr) throw new Error(scopedErr.message || 'Failed to resolve scoped manager allocation');
    if (scopedManager?.manager_user_id) managerUserId = scopedManager.manager_user_id;
  }

  if (!managerUserId) {
    const { data: fallbackManager, error: fallbackErr } = await supabase
      .from('manager_sales_division_allocations')
      .select('manager_user_id, division_id')
      .eq('sales_user_id', salesUserId)
      .eq('allocation_status', 'ACTIVE')
      .order('allocated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (fallbackErr) throw new Error(fallbackErr.message || 'Failed to resolve manager allocation');
    managerUserId = fallbackManager?.manager_user_id || null;
    if (!divisionId) divisionId = fallbackManager?.division_id || null;
  }

  const vpUserId = await resolveVpUserForManager(supabase, managerUserId, divisionId);
  return { divisionId: divisionId || null, managerUserId, vpUserId };
};

export const handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });

    const supabase = getSupabase();
    const authUser = resolveAuthUser(event);
    if (!authUser?.id) return json(401, { success: false, error: 'Unauthorized' });

    const employee = await resolveEmployee(supabase, authUser);
    const role = normalizeRole(employee?.role || authUser.role || '');
    const actorUserId = String(authUser.id || employee?.user_id || '').trim() || null;
    if (!employee && role !== 'SUPERADMIN') return json(404, { success: false, error: 'Employee profile not found' });
    if (employee?.status && normalizeRole(employee.status) !== 'ACTIVE') return json(403, { success: false, error: 'Employee is not active' });

    const tail = parseTail(event.path);
    const query = event.queryStringParameters || {};
    const body = readBody(event);

    if (event.httpMethod === 'GET' && tail[0] === 'divisions') {
      if (!isSalesOrAbove(role)) return json(403, { success: false, error: 'Sales access required' });
      const scope = await getScopedDivisionIds(supabase, role, actorUserId);
      const divisions = await getDivisions(supabase, scope, query);
      return json(200, { success: true, divisions });
    }

    if (event.httpMethod === 'GET' && tail[0] === 'employees') {
      if (!isManagerOrAbove(role)) return json(403, { success: false, error: 'Manager-level access required' });
      const requestedRole = normalizeRole(query?.role || '');
      const roleFilter = requestedRole && ['MANAGER', 'SALES', 'VP'].includes(requestedRole)
        ? [requestedRole]
        : ['MANAGER', 'SALES', 'VP'];
      let req = supabase
        .from('employees')
        .select('id, user_id, full_name, email, role, department, status, created_at')
        .in('role', roleFilter)
        .order('full_name', { ascending: true });
      if (role === 'MANAGER') req = req.in('role', ['SALES']);
      const { data, error } = await req;
      if (error) return json(500, { success: false, error: error.message || 'Failed to fetch employees' });
      const employees = (data || []).filter((r) => normalizeRole(r.status || 'ACTIVE') === 'ACTIVE');
      return json(200, { success: true, employees });
    }

    if (event.httpMethod === 'GET' && tail[0] === 'allocations' && tail[1] === 'vp-manager') {
      if (!isManagerOrAbove(role)) return json(403, { success: false, error: 'Manager-level access required' });
      let managerUserId = normalizeText(query?.manager_user_id);
      if (role === 'MANAGER') managerUserId = actorUserId;
      let req = supabase
        .from('vp_manager_division_allocations')
        .select('id, vp_user_id, manager_user_id, division_id, allocation_status, notes, allocated_at, released_at, updated_at, division:geo_divisions(id, name, city_id, state_id)')
        .order('allocated_at', { ascending: false });
      if (managerUserId) req = req.eq('manager_user_id', managerUserId);
      if (query?.active !== 'false') req = req.eq('allocation_status', 'ACTIVE');
      const { data, error } = await req;
      if (error) return json(500, { success: false, error: error.message || 'Failed to fetch VP allocations' });
      return json(200, { success: true, allocations: data || [] });
    }

    if (event.httpMethod === 'POST' && tail[0] === 'allocations' && tail[1] === 'vp-manager') {
      if (!isVpOrAdmin(role)) return json(403, { success: false, error: 'VP/Admin access required' });
      const managerUserId = normalizeText(body?.manager_user_id);
      const divisionIds = unique(body?.division_ids || []);
      const mode = normalizeRole(body?.mode || 'REPLACE');
      if (!managerUserId) return json(400, { success: false, error: 'manager_user_id is required' });
      if (!['REPLACE', 'APPEND'].includes(mode)) return json(400, { success: false, error: 'mode must be REPLACE or APPEND' });
      const managerCheck = await validateEmployeeRole(supabase, managerUserId, 'MANAGER');
      if (!managerCheck.ok) return json(400, { success: false, error: managerCheck.reason });

      if (mode === 'REPLACE') {
        const keep = new Set(divisionIds);
        const { data: activeRows } = await supabase
          .from('vp_manager_division_allocations')
          .select('id, division_id')
          .eq('manager_user_id', managerUserId)
          .eq('allocation_status', 'ACTIVE');
        const releaseIds = (activeRows || []).filter((r) => !keep.has(String(r.division_id || '').trim())).map((r) => r.id);
        if (releaseIds.length) {
          await supabase
            .from('vp_manager_division_allocations')
            .update({ allocation_status: 'RELEASED', released_at: nowIso(), updated_at: nowIso() })
            .in('id', releaseIds);
        }
      }

      for (const divisionId of divisionIds) {
        const { data: existing } = await supabase
          .from('vp_manager_division_allocations')
          .select('id')
          .eq('manager_user_id', managerUserId)
          .eq('division_id', divisionId)
          .eq('allocation_status', 'ACTIVE')
          .maybeSingle();
        if (existing?.id) {
          await supabase.from('vp_manager_division_allocations').update({ updated_at: nowIso() }).eq('id', existing.id);
        } else {
          await supabase.from('vp_manager_division_allocations').insert([{
            vp_user_id: actorUserId,
            manager_user_id: managerUserId,
            division_id: divisionId,
            allocation_status: 'ACTIVE',
            allocated_at: nowIso(),
            created_at: nowIso(),
            updated_at: nowIso(),
          }]);
        }
      }
      return json(200, { success: true, summary: { divisions: divisionIds.length } });
    }

    if (event.httpMethod === 'GET' && tail[0] === 'allocations' && tail[1] === 'manager-sales') {
      if (!isManagerOrAbove(role)) return json(403, { success: false, error: 'Manager-level access required' });
      let managerUserId = normalizeText(query?.manager_user_id);
      if (role === 'MANAGER') managerUserId = actorUserId;
      let req = supabase
        .from('manager_sales_division_allocations')
        .select('id, manager_user_id, sales_user_id, division_id, allocation_status, notes, allocated_at, released_at, updated_at, division:geo_divisions(id, name, city_id, state_id)')
        .order('allocated_at', { ascending: false });
      if (managerUserId) req = req.eq('manager_user_id', managerUserId);
      if (query?.sales_user_id) req = req.eq('sales_user_id', query.sales_user_id);
      if (query?.active !== 'false') req = req.eq('allocation_status', 'ACTIVE');
      const { data, error } = await req;
      if (error) return json(500, { success: false, error: error.message || 'Failed to fetch manager allocations' });
      return json(200, { success: true, allocations: data || [] });
    }

    if (event.httpMethod === 'POST' && tail[0] === 'allocations' && tail[1] === 'manager-sales') {
      if (!isManagerOrAbove(role)) return json(403, { success: false, error: 'Manager-level access required' });
      const salesUserId = normalizeText(body?.sales_user_id);
      const divisionIds = unique(body?.division_ids || []);
      let managerUserId = normalizeText(body?.manager_user_id);
      if (role === 'MANAGER') managerUserId = actorUserId;
      if (!salesUserId) return json(400, { success: false, error: 'sales_user_id is required' });
      if (!managerUserId) return json(400, { success: false, error: 'manager_user_id is required' });
      const salesCheck = await validateEmployeeRole(supabase, salesUserId, 'SALES');
      if (!salesCheck.ok) return json(400, { success: false, error: salesCheck.reason });

      const mode = normalizeRole(body?.mode || 'REPLACE');
      if (mode === 'REPLACE') {
        const keep = new Set(divisionIds);
        const { data: activeRows } = await supabase
          .from('manager_sales_division_allocations')
          .select('id, division_id')
          .eq('manager_user_id', managerUserId)
          .eq('sales_user_id', salesUserId)
          .eq('allocation_status', 'ACTIVE');
        const releaseIds = (activeRows || []).filter((r) => !keep.has(String(r.division_id || '').trim())).map((r) => r.id);
        if (releaseIds.length) {
          await supabase
            .from('manager_sales_division_allocations')
            .update({ allocation_status: 'RELEASED', released_at: nowIso(), updated_at: nowIso() })
            .in('id', releaseIds);
        }
      }

      for (const divisionId of divisionIds) {
        await supabase
          .from('manager_sales_division_allocations')
          .update({ allocation_status: 'RELEASED', released_at: nowIso(), updated_at: nowIso() })
          .eq('manager_user_id', managerUserId)
          .eq('division_id', divisionId)
          .eq('allocation_status', 'ACTIVE')
          .neq('sales_user_id', salesUserId);

        const { data: existing } = await supabase
          .from('manager_sales_division_allocations')
          .select('id')
          .eq('manager_user_id', managerUserId)
          .eq('sales_user_id', salesUserId)
          .eq('division_id', divisionId)
          .eq('allocation_status', 'ACTIVE')
          .maybeSingle();
        if (existing?.id) {
          await supabase.from('manager_sales_division_allocations').update({ updated_at: nowIso() }).eq('id', existing.id);
        } else {
          await supabase.from('manager_sales_division_allocations').insert([{
            manager_user_id: managerUserId,
            sales_user_id: salesUserId,
            division_id: divisionId,
            allocation_status: 'ACTIVE',
            allocated_at: nowIso(),
            created_at: nowIso(),
            updated_at: nowIso(),
          }]);
        }
      }
      return json(200, { success: true, summary: { divisions: divisionIds.length } });
    }

    if (event.httpMethod === 'GET' && tail[0] === 'sales' && tail[1] === 'vendors') {
      if (!isSalesOrAbove(role)) return json(403, { success: false, error: 'Sales access required' });
      const includeUnmasked = query?.include_unmasked === 'true' && isManagerOrAbove(role);
      const scope = await getScopedDivisionIds(supabase, role, actorUserId);
      const divisions = await getDivisions(supabase, scope, query);
      const divisionIds = unique((divisions || []).map((d) => d.id));
      const cityIds = unique((divisions || []).map((d) => d.city_id));

      let vendors = [];
      const seenVendorIds = new Set();
      const divisionByVendor = new Map();
      if (divisionIds.length) {
        const { data: maps } = await supabase.from('vendor_division_map').select('vendor_id, division_id').in('division_id', divisionIds);
        const mappedVendorIds = unique((maps || []).map((m) => m.vendor_id));
        (maps || []).forEach((m) => divisionByVendor.set(m.vendor_id, m.division_id));
        if (mappedVendorIds.length) {
          const { data: rows } = await supabase
            .from('vendors')
            .select('id, vendor_id, company_name, owner_name, email, phone, city, state, city_id, state_id, kyc_status, is_active')
            .in('id', mappedVendorIds)
            .eq('is_active', true);
          vendors = (rows || []).map((v) => {
            const mappedDivisionId = divisionByVendor.get(v.id) || null;
            seenVendorIds.add(v.id);
            return {
              id: v.id,
              vendor_id: v.vendor_id,
              company_name: v.company_name,
              owner_name: v.owner_name,
              phone: includeUnmasked ? v.phone : maskPhone(v.phone),
              email: includeUnmasked ? v.email : maskEmail(v.email),
              city: v.city,
              state: v.state,
              city_id: v.city_id,
              state_id: v.state_id,
              kyc_status: v.kyc_status,
              is_active: v.is_active !== false,
              contact_masked: !includeUnmasked,
              division_id: mappedDivisionId,
              division_name: divisions.find((d) => d.id === mappedDivisionId)?.name || null,
            };
          });
        }
      }
      if (cityIds.length) {
        const { data: rows } = await supabase
          .from('vendors')
          .select('id, vendor_id, company_name, owner_name, email, phone, city, state, city_id, state_id, kyc_status, is_active')
          .in('city_id', cityIds)
          .eq('is_active', true);
        (rows || []).forEach((v) => {
          if (seenVendorIds.has(v.id)) return;
          const cityDivisionRows = divisions.filter((d) => String(d.city_id || '') === String(v.city_id || ''));
          const cityDivision = cityDivisionRows.length === 1 ? cityDivisionRows[0] : null;

          vendors.push({
            id: v.id,
            vendor_id: v.vendor_id,
            company_name: v.company_name,
            owner_name: v.owner_name,
            phone: includeUnmasked ? v.phone : maskPhone(v.phone),
            email: includeUnmasked ? v.email : maskEmail(v.email),
            city: v.city,
            state: v.state,
            city_id: v.city_id,
            state_id: v.state_id,
            kyc_status: v.kyc_status,
            is_active: v.is_active !== false,
            contact_masked: !includeUnmasked,
            division_id: cityDivision?.id || null,
            division_name: cityDivision?.name || null,
          });
        });
      }
      return json(200, { success: true, vendors, meta: { total: vendors.length, contact_masked: !includeUnmasked, divisions_in_scope: divisionIds.length } });
    }

    if (event.httpMethod === 'POST' && tail[0] === 'sales' && tail[1] === 'engagements') {
      if (!isSalesOrAbove(role)) return json(403, { success: false, error: 'Sales access required' });
      const vendorId = normalizeText(body?.vendor_id);
      const engagementType = normalizeRole(body?.engagement_type || 'FOLLOW_UP');
      if (!vendorId) return json(400, { success: false, error: 'vendor_id is required' });
      if (!ENGAGEMENT_TYPES.has(engagementType)) {
        return json(400, { success: false, error: `Invalid engagement_type. Allowed: ${[...ENGAGEMENT_TYPES].join(', ')}` });
      }

      const { data: vendor, error: vendorErr } = await supabase
        .from('vendors')
        .select('id')
        .eq('id', vendorId)
        .maybeSingle();
      if (vendorErr) return json(500, { success: false, error: vendorErr.message || 'Failed to validate vendor' });
      if (!vendor?.id) return json(404, { success: false, error: 'Vendor not found' });

      const requestedDivisionId = normalizeText(body?.division_id || '');
      let divisionId = requestedDivisionId || null;
      let managerUserId = role === 'MANAGER' ? actorUserId : null;
      let vpUserId = role === 'VP' ? actorUserId : null;

      if (role === 'SALES') {
        const hierarchy = await resolveSalesHierarchyForVendor(
          supabase,
          actorUserId,
          vendorId,
          requestedDivisionId
        );
        divisionId = hierarchy.divisionId || divisionId;
        managerUserId = hierarchy.managerUserId || null;
        vpUserId = hierarchy.vpUserId || null;
      }

      if (role === 'MANAGER' && !vpUserId) {
        vpUserId = await resolveVpUserForManager(supabase, managerUserId, divisionId);
      }

      const payload = {
        vendor_id: vendorId,
        sales_user_id: actorUserId,
        manager_user_id: managerUserId,
        vp_user_id: vpUserId,
        division_id: divisionId,
        engagement_type: engagementType,
        status: normalizeRole(body?.status || 'OPEN') || 'OPEN',
        notes: normalizeText(body?.notes || '') || null,
        next_follow_up_at: normalizeText(body?.next_follow_up_at || '') || null,
        is_contact_unmasked: body?.is_contact_unmasked === true && isManagerOrAbove(role),
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      const { data, error } = await supabase.from('sales_vendor_engagements').insert([payload]).select('*').maybeSingle();
      if (error) return json(500, { success: false, error: error.message || 'Failed to save engagement' });
      return json(200, { success: true, engagement: data || payload });
    }

    if (event.httpMethod === 'GET' && tail[0] === 'sales' && tail[1] === 'engagements') {
      if (!isSalesOrAbove(role)) return json(403, { success: false, error: 'Sales access required' });
      let req = supabase
        .from('sales_vendor_engagements')
        .select('id, vendor_id, sales_user_id, manager_user_id, vp_user_id, division_id, engagement_type, status, notes, next_follow_up_at, is_contact_unmasked, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(Math.min(Math.max(Number(query?.limit || 100), 1), 500));
      if (role === 'SALES') req = req.eq('sales_user_id', actorUserId);
      if (role === 'MANAGER') req = req.eq('manager_user_id', actorUserId);
      if (query?.vendor_id) req = req.eq('vendor_id', query.vendor_id);
      if (query?.status) req = req.eq('status', normalizeRole(query.status));
      const { data, error } = await req;
      if (error) return json(500, { success: false, error: error.message || 'Failed to fetch engagements' });
      return json(200, { success: true, engagements: data || [] });
    }

    return json(404, { success: false, error: 'Not found' });
  } catch (error) {
    return json(500, { success: false, error: error.message || 'Territory function failed' });
  }
};
