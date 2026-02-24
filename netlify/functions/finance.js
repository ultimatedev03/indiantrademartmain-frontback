import { createClient } from '@supabase/supabase-js';
import { getReferralSettings } from '../../server/lib/referralProgram.js';

const json = (statusCode, body, extraHeaders = {}) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
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

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const asUpper = (value) => String(value || '').trim().toUpperCase();

const readBody = (event) => {
  if (!event?.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    return {};
  }
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
    const body = readBody(event);

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

    // Referral program ---------------------------------------------------

    // GET /api/finance/referrals/settings
    if (event.httpMethod === 'GET' && action === 'referrals' && parseRoute(event.path).params?.[0] === 'settings') {
      const settings = await getReferralSettings(supabase);

      const [{ data: rules, error: rulesErr }, { data: plans, error: plansErr }] = await Promise.all([
        supabase
          .from('referral_plan_rules')
          .select('*')
          .order('updated_at', { ascending: false }),
        supabase
          .from('vendor_plans')
          .select('id, name, price, is_active')
          .order('price', { ascending: true }),
      ]);

      if (rulesErr) return json(500, { success: false, error: rulesErr.message });
      if (plansErr) return json(500, { success: false, error: plansErr.message });

      return json(200, {
        success: true,
        data: {
          settings,
          rules: rules || [],
          plans: plans || [],
        },
      });
    }

    // PUT /api/finance/referrals/settings
    if (event.httpMethod === 'PUT' && action === 'referrals' && parseRoute(event.path).params?.[0] === 'settings') {
      const payload = body || {};
      const update = {
        is_enabled: Boolean(payload.is_enabled),
        first_paid_plan_only: payload.first_paid_plan_only !== false,
        allow_coupon_stack: Boolean(payload.allow_coupon_stack),
        min_plan_amount: Math.max(0, Number(payload.min_plan_amount || 0)),
        min_cashout_amount: Math.max(0, Number(payload.min_cashout_amount || 0)),
        reward_hold_days: Math.max(0, Math.trunc(Number(payload.reward_hold_days || 0))),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('referral_program_settings')
        .upsert([{ config_key: 'GLOBAL', ...update }], { onConflict: 'config_key' })
        .select('*')
        .single();

      if (error) return json(500, { success: false, error: error.message });
      return json(200, { success: true, data });
    }

    // PUT /api/finance/referrals/plan-rules/:planId
    if (event.httpMethod === 'PUT' && action === 'referrals' && parseRoute(event.path).params?.[0] === 'plan-rules') {
      const parts = parseRoute(event.path).params || [];
      const planId = String(parts[1] || '').trim();
      if (!looksLikeUuid(planId)) {
        return json(400, { success: false, error: 'Invalid plan id' });
      }

      const {
        is_enabled = true,
        discount_type = 'PERCENT',
        discount_value = 0,
        discount_cap = null,
        reward_type = 'PERCENT',
        reward_value = 0,
        reward_cap = null,
        valid_from = null,
        valid_to = null,
      } = body || {};

      const normalizedDiscountType = asUpper(discount_type);
      const normalizedRewardType = asUpper(reward_type);
      if (!['PERCENT', 'FLAT'].includes(normalizedDiscountType)) {
        return json(400, { success: false, error: 'discount_type must be PERCENT or FLAT' });
      }
      if (!['PERCENT', 'FLAT'].includes(normalizedRewardType)) {
        return json(400, { success: false, error: 'reward_type must be PERCENT or FLAT' });
      }

      const dValue = Number(discount_value || 0);
      const rValue = Number(reward_value || 0);
      if (!Number.isFinite(dValue) || dValue < 0) {
        return json(400, { success: false, error: 'discount_value must be >= 0' });
      }
      if (!Number.isFinite(rValue) || rValue < 0) {
        return json(400, { success: false, error: 'reward_value must be >= 0' });
      }
      if (normalizedDiscountType === 'PERCENT' && dValue > 100) {
        return json(400, { success: false, error: 'discount percent cannot exceed 100' });
      }
      if (normalizedRewardType === 'PERCENT' && rValue > 100) {
        return json(400, { success: false, error: 'reward percent cannot exceed 100' });
      }

      const payload = {
        plan_id: planId,
        is_enabled: Boolean(is_enabled),
        discount_type: normalizedDiscountType,
        discount_value: dValue,
        discount_cap: toNumberOrNull(discount_cap),
        reward_type: normalizedRewardType,
        reward_value: rValue,
        reward_cap: toNumberOrNull(reward_cap),
        valid_from: valid_from || null,
        valid_to: valid_to || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('referral_plan_rules')
        .upsert([payload], { onConflict: 'plan_id' })
        .select('*')
        .single();
      if (error) return json(500, { success: false, error: error.message });

      return json(200, { success: true, data });
    }

    // GET /api/finance/referrals/cashouts
    if (event.httpMethod === 'GET' && action === 'referrals' && parseRoute(event.path).params?.[0] === 'cashouts') {
      const status = asUpper(event.queryStringParameters?.status || '');
      const limit = Math.max(1, Math.min(500, Number(event.queryStringParameters?.limit || 200)));

      let query = supabase
        .from('vendor_referral_cashout_requests')
        .select('*, vendor:vendors(id, vendor_id, company_name, owner_name, email, phone)')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (status && status !== 'ALL') query = query.eq('status', status);

      const { data, error } = await query;
      if (error) return json(500, { success: false, error: error.message });
      return json(200, { success: true, data: data || [] });
    }

    // POST /api/finance/referrals/cashouts/:id/approve
    if (event.httpMethod === 'POST' && action === 'referrals') {
      const parts = parseRoute(event.path).params || [];
      if (parts[0] === 'cashouts' && parts[2] === 'approve') {
        const id = String(parts[1] || '').trim();
        if (!looksLikeUuid(id)) return json(400, { success: false, error: 'Invalid cashout id' });

        const { data: row, error: rowErr } = await supabase
          .from('vendor_referral_cashout_requests')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (rowErr) return json(500, { success: false, error: rowErr.message });
        if (!row) return json(404, { success: false, error: 'Cashout request not found' });
        if (!['REQUESTED', 'APPROVED'].includes(asUpper(row.status))) {
          return json(400, { success: false, error: `Cannot approve cashout in status ${row.status}` });
        }

        const { data, error } = await supabase
          .from('vendor_referral_cashout_requests')
          .update({
            status: 'APPROVED',
            approved_by_user_id: null,
            approved_at: new Date().toISOString(),
            notes: normalizeScopeToken(body?.notes) || row.notes || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select('*')
          .single();
        if (error) return json(500, { success: false, error: error.message });

        return json(200, { success: true, data });
      }

      // POST /api/finance/referrals/cashouts/:id/reject
      if (parts[0] === 'cashouts' && parts[2] === 'reject') {
        const id = String(parts[1] || '').trim();
        if (!looksLikeUuid(id)) return json(400, { success: false, error: 'Invalid cashout id' });
        const rejectionReason = normalizeScopeToken(body?.rejection_reason || 'Rejected by finance');

        const { data: row, error: rowErr } = await supabase
          .from('vendor_referral_cashout_requests')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (rowErr) return json(500, { success: false, error: rowErr.message });
        if (!row) return json(404, { success: false, error: 'Cashout request not found' });
        if (!['REQUESTED', 'APPROVED'].includes(asUpper(row.status))) {
          return json(400, { success: false, error: `Cannot reject cashout in status ${row.status}` });
        }

        const { data: wallet, error: walletErr } = await supabase
          .from('vendor_referral_wallets')
          .select('*')
          .eq('vendor_id', row.vendor_id)
          .maybeSingle();
        if (walletErr) return json(500, { success: false, error: walletErr.message });

        const amount = Number(row.requested_amount || 0);
        const nextAvailable = Number(wallet?.available_balance || 0) + amount;
        const { error: walletUpdateErr } = await supabase
          .from('vendor_referral_wallets')
          .upsert(
            [
              {
                vendor_id: row.vendor_id,
                available_balance: nextAvailable,
                pending_balance: Number(wallet?.pending_balance || 0),
                lifetime_earned: Number(wallet?.lifetime_earned || 0),
                lifetime_paid_out: Number(wallet?.lifetime_paid_out || 0),
                updated_at: new Date().toISOString(),
              },
            ],
            { onConflict: 'vendor_id' }
          );
        if (walletUpdateErr) return json(500, { success: false, error: walletUpdateErr.message });

        const referenceKey = `cashout_revert:${row.id}`;
        const { error: ledgerErr } = await supabase.from('vendor_referral_wallet_ledger').insert([
          {
            vendor_id: row.vendor_id,
            cashout_request_id: row.id,
            entry_type: 'CASHOUT_REVERT',
            amount,
            status: 'COMPLETED',
            reference_key: referenceKey,
            meta: {},
            created_at: new Date().toISOString(),
          },
        ]);
        if (ledgerErr) {
          const msg = String(ledgerErr.message || '').toLowerCase();
          if (!msg.includes('duplicate') && !msg.includes('unique')) {
            return json(500, { success: false, error: ledgerErr.message || 'Failed to write cashout revert ledger' });
          }
        }

        const { data, error } = await supabase
          .from('vendor_referral_cashout_requests')
          .update({
            status: 'REJECTED',
            rejection_reason: rejectionReason || null,
            approved_by_user_id: null,
            approved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select('*')
          .single();
        if (error) return json(500, { success: false, error: error.message });

        return json(200, { success: true, data });
      }

      // POST /api/finance/referrals/cashouts/:id/mark-paid
      if (parts[0] === 'cashouts' && parts[2] === 'mark-paid') {
        const id = String(parts[1] || '').trim();
        if (!looksLikeUuid(id)) return json(400, { success: false, error: 'Invalid cashout id' });

        const utr = normalizeScopeToken(body?.utr_number || '');
        const receiptUrl = normalizeScopeToken(body?.receipt_url || '');
        const notes = normalizeScopeToken(body?.notes || '');

        if (!utr) return json(400, { success: false, error: 'utr_number is required' });

        const { data: row, error: rowErr } = await supabase
          .from('vendor_referral_cashout_requests')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (rowErr) return json(500, { success: false, error: rowErr.message });
        if (!row) return json(404, { success: false, error: 'Cashout request not found' });
        if (asUpper(row.status) !== 'APPROVED') {
          return json(400, { success: false, error: 'Cashout must be APPROVED before mark-paid' });
        }

        const { data: wallet, error: walletErr } = await supabase
          .from('vendor_referral_wallets')
          .select('*')
          .eq('vendor_id', row.vendor_id)
          .maybeSingle();
        if (walletErr) return json(500, { success: false, error: walletErr.message });

        const nextPaidOut = Number(wallet?.lifetime_paid_out || 0) + Number(row.requested_amount || 0);
        const { error: walletUpdateErr } = await supabase
          .from('vendor_referral_wallets')
          .upsert(
            [
              {
                vendor_id: row.vendor_id,
                available_balance: Number(wallet?.available_balance || 0),
                pending_balance: Number(wallet?.pending_balance || 0),
                lifetime_earned: Number(wallet?.lifetime_earned || 0),
                lifetime_paid_out: nextPaidOut,
                updated_at: new Date().toISOString(),
              },
            ],
            { onConflict: 'vendor_id' }
          );
        if (walletUpdateErr) return json(500, { success: false, error: walletUpdateErr.message });

        const { data, error } = await supabase
          .from('vendor_referral_cashout_requests')
          .update({
            status: 'PAID',
            paid_by_user_id: null,
            paid_at: new Date().toISOString(),
            utr_number: utr,
            receipt_url: receiptUrl || null,
            notes: notes || row.notes || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select('*')
          .single();
        if (error) return json(500, { success: false, error: error.message });

        return json(200, { success: true, data });
      }
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
