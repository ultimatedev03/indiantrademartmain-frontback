import { createClient } from '@supabase/supabase-js';

const json = (statusCode, body, extraHeaders = {}) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    ...extraHeaders,
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

const COUPON_CODE_REGEX = /^[A-Z0-9_-]+$/;
const GLOBAL_SCOPE_TOKENS = new Set(['ANY', 'ALL', 'GLOBAL', 'NULL', 'NONE']);

const looksLikeUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '').trim()
  );

const normalizeCouponCode = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9_-]/g, '');

const normalizeScopeToken = (value) => String(value || '').trim();

const isGlobalScopeValue = (value) => {
  const token = normalizeScopeToken(value);
  if (!token) return true;
  return GLOBAL_SCOPE_TOKENS.has(token.toUpperCase());
};

const normalizePlanScopeId = (planScope) => {
  const token = normalizeScopeToken(planScope);
  if (isGlobalScopeValue(token)) return null;
  return token;
};

async function resolveVendorScopeId(supabase, vendorRef) {
  const ref = normalizeScopeToken(vendorRef);
  if (isGlobalScopeValue(ref)) return null;

  if (looksLikeUuid(ref)) {
    const { data: byId, error: byIdError } = await supabase
      .from('vendors')
      .select('id')
      .eq('id', ref)
      .maybeSingle();
    if (byIdError) throw new Error(byIdError.message || 'Failed to validate vendor UUID');
    if (byId?.id) return byId.id;
  }

  const { data: byPublicId, error: byPublicIdError } = await supabase
    .from('vendors')
    .select('id')
    .ilike('vendor_id', ref)
    .limit(2);
  if (byPublicIdError) throw new Error(byPublicIdError.message || 'Failed to resolve vendor');
  if ((byPublicId || []).length === 1) return byPublicId[0].id;
  if ((byPublicId || []).length > 1) {
    throw new Error('Multiple vendors matched this vendor ID. Use vendor UUID.');
  }

  const { data: byEmail, error: byEmailError } = await supabase
    .from('vendors')
    .select('id')
    .ilike('email', ref)
    .limit(2);
  if (byEmailError) throw new Error(byEmailError.message || 'Failed to resolve vendor');
  if ((byEmail || []).length === 1) return byEmail[0].id;
  if ((byEmail || []).length > 1) {
    throw new Error('Multiple vendors matched this email. Use vendor UUID.');
  }

  throw new Error('Vendor not found. Enter vendor UUID, vendor code, or vendor email.');
}

const parseRoute = (path = '') => {
  const parts = path.split('/').filter(Boolean);
  const idx = parts.lastIndexOf('finance');
  const rest = idx >= 0 ? parts.slice(idx + 1) : [];
  return { action: rest[0] || '', params: rest.slice(1) };
};

export const handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });

    const { action } = parseRoute(event.path);
    const supabase = getSupabase();

    // GET /api/finance/payments
    if (event.httpMethod === 'GET' && action === 'payments') {
      const { vendor_id, plan_id, from, to, limit = 200 } = event.queryStringParameters || {};
      let query = supabase
        .from('vendor_payments')
        .select('*, vendor:vendors(id,vendor_id,company_name,email), plan:vendor_plans(id,name,price)')
        .order('payment_date', { ascending: false })
        .limit(Number(limit) || 200);
      if (vendor_id) query = query.eq('vendor_id', vendor_id);
      if (plan_id) query = query.eq('plan_id', plan_id);
      if (from) query = query.gte('payment_date', from);
      if (to) query = query.lte('payment_date', to);
      const { data, error } = await query;
      if (error) return json(500, { success: false, error: error.message });
      return json(200, { success: true, data: data || [] });
    }

    // GET /api/finance/summary
    if (event.httpMethod === 'GET' && action === 'summary') {
      const { data: payments, error } = await supabase.from('vendor_payments').select('amount, net_amount, payment_date');
      if (error) return json(500, { success: false, error: error.message });
      const { data: leads, error: leadErr } = await supabase.from('lead_purchases').select('amount, purchase_date, created_at');
      if (leadErr) {
        console.warn('[finance/summary] lead_purchases error:', leadErr.message);
      }
      const now = new Date();
      const thirtyAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      let totalGross = 0;
      let totalNet = 0;
      let totalLead = 0;
      let last30 = 0;
      (payments || []).forEach((p) => {
        const gross = Number(p.amount || 0);
        const net = Number(p.net_amount ?? p.amount ?? 0);
        totalGross += gross;
        totalNet += net;
        if (p.payment_date && new Date(p.payment_date) >= thirtyAgo) last30 += net;
      });
      (leads || []).forEach((l) => {
        const amt = Number(l.amount || 0);
        totalLead += amt;
        const d = l.purchase_date || l.created_at;
        if (d && new Date(d) >= thirtyAgo) last30 += amt;
      });
      const totalRevenue = totalNet + totalLead;
      return json(200, { success: true, data: { totalGross, totalNet, totalLead, totalRevenue, last30 } });
    }

    // GET /api/finance/coupons
    if (event.httpMethod === 'GET' && action === 'coupons') {
      const { data, error } = await supabase.from('vendor_plan_coupons').select('*').order('created_at', { ascending: false });
      if (error) return json(500, { success: false, error: error.message });
      const normalized = (data || []).map((row) => ({
        ...row,
        plan_id: normalizePlanScopeId(row?.plan_id),
        vendor_id: isGlobalScopeValue(row?.vendor_id) ? null : row?.vendor_id || null,
      }));
      return json(200, { success: true, data: normalized });
    }

    // POST /api/finance/coupons
    if (event.httpMethod === 'POST' && action === 'coupons') {
      const body = event.body ? JSON.parse(event.body) : {};
      const { code, discount_type, value, plan_id = null, vendor_id = null, max_uses = 0, expires_at = null, is_active = true } = body;

      const normalizedCode = normalizeCouponCode(code);
      const normalizedDiscountType = String(discount_type || '').trim().toUpperCase();
      const numericValue = Number(value);
      const numericMaxUses = Number(max_uses || 0);

      if (!normalizedCode || !normalizedDiscountType || value === undefined || value === null || value === '') {
        return json(400, { success: false, error: 'code, discount_type, value are required' });
      }
      if (!COUPON_CODE_REGEX.test(normalizedCode)) {
        return json(400, {
          success: false,
          error: 'Coupon code must use letters, numbers, hyphen, or underscore only',
        });
      }
      if (!['PERCENT', 'FLAT'].includes(normalizedDiscountType)) {
        return json(400, { success: false, error: 'discount_type must be PERCENT or FLAT' });
      }
      if (!Number.isFinite(numericValue) || numericValue <= 0) {
        return json(400, { success: false, error: 'value must be a number greater than 0' });
      }
      if (normalizedDiscountType === 'PERCENT' && numericValue > 100) {
        return json(400, { success: false, error: 'Percent coupon value cannot exceed 100' });
      }
      if (!Number.isFinite(numericMaxUses) || numericMaxUses < 0) {
        return json(400, { success: false, error: 'max_uses must be 0 or more' });
      }

      const normalizedExpiresAt = expires_at ? new Date(expires_at) : null;
      if (normalizedExpiresAt && Number.isNaN(normalizedExpiresAt.getTime())) {
        return json(400, { success: false, error: 'expires_at must be a valid date/time' });
      }

      const resolvedVendorId = await resolveVendorScopeId(supabase, vendor_id);
      const normalizedPlanId = normalizePlanScopeId(plan_id);

      const payload = {
        code: normalizedCode,
        discount_type: normalizedDiscountType,
        value: numericValue,
        plan_id: normalizedPlanId,
        vendor_id: resolvedVendorId,
        max_uses: Math.trunc(numericMaxUses),
        expires_at: normalizedExpiresAt ? normalizedExpiresAt.toISOString() : null,
        is_active,
        created_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('vendor_plan_coupons').insert([payload]).select().single();
      if (error) return json(500, { success: false, error: error.message });
      return json(200, { success: true, data });
    }

    // DELETE /api/finance/coupons/:id
    if (event.httpMethod === 'DELETE' && action === 'coupons') {
      const { params } = parseRoute(event.path);
      const id = params?.[0];
      if (!id) return json(400, { success: false, error: 'Missing coupon id' });
      const { data, error } = await supabase
        .from('vendor_plan_coupons')
        .delete()
        .eq('id', id)
        .select()
        .single();
      if (error) return json(500, { success: false, error: error.message });
      return json(200, { success: true, data });
    }

    // POST /api/finance/coupons/:code/deactivate
    if (event.httpMethod === 'POST' && action === 'coupons' && (event.path || '').toLowerCase().includes('deactivate')) {
      const parts = event.path.split('/').filter(Boolean);
      const code = parts[parts.length - 2]; // /api/finance/coupons/:code/deactivate
      const { data, error } = await supabase
        .from('vendor_plan_coupons')
        .update({ is_active: false })
        .eq('code', String(code).toUpperCase())
        .select()
        .single();
      if (error) return json(500, { success: false, error: error.message });
      return json(200, { success: true, data });
    }

    return json(404, { success: false, error: 'Invalid finance route' });
  } catch (error) {
    console.error('Finance function error:', error);
    return json(500, { success: false, error: error.message || 'Internal error' });
  }
};
