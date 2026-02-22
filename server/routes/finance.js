import express from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { writeAuditLog } from '../lib/audit.js';
import { requireEmployeeRoles } from '../middleware/requireEmployeeRoles.js';

const router = express.Router();

// Finance APIs require FINANCE or ADMIN employees.
router.use(requireEmployeeRoles(['FINANCE', 'ADMIN']));

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

async function resolveVendorScopeId(vendorRef) {
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

// GET /api/finance/payments
// Optional query params: vendor_id, plan_id, from, to, limit
router.get('/payments', async (req, res) => {
  try {
    const { vendor_id, plan_id, from, to, limit = 200 } = req.query;
    let query = supabase
      .from('vendor_payments')
      .select('*, vendor:vendors(id, vendor_id, company_name, email), plan:vendor_plans(id, name, price)')
      .order('payment_date', { ascending: false })
      .limit(Number(limit) || 200);

    if (vendor_id) query = query.eq('vendor_id', vendor_id);
    if (plan_id) query = query.eq('plan_id', plan_id);
    if (from) query = query.gte('payment_date', from);
    if (to) query = query.lte('payment_date', to);

    const { data, error } = await query;
    if (error) return res.status(500).json({ success: false, error: error.message });

    await writeAuditLog({
      req,
      actor: req.actor,
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

    return res.json({ success: true, data: data || [] });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/finance/summary
router.get('/summary', async (_req, res) => {
  try {
    const { data: payments, error } = await supabase
      .from('vendor_payments')
      .select('amount, net_amount, payment_date');
    if (error) return res.status(500).json({ success: false, error: error.message });

    const { data: leads, error: leadErr } = await supabase
      .from('lead_purchases')
      .select('amount, purchase_date, created_at');
    if (leadErr) {
      // Do not fail summary if lead_purchases is missing/blocked.
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

    await writeAuditLog({
      req: _req,
      actor: _req.actor,
      action: 'FINANCE_SUMMARY_VIEWED',
      entityType: 'vendor_payments',
      details: { totalGross, totalNet, totalLead, totalRevenue, last30 },
    });

    return res.json({
      success: true,
      data: {
        totalGross,
        totalNet,
        totalLead,
        totalRevenue,
        last30,
      },
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// Coupons ---------------------------------------------------

// GET /api/finance/coupons
router.get('/coupons', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('vendor_plan_coupons')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ success: false, error: error.message });

    const coupons = Array.isArray(data) ? data : [];
    const planIds = Array.from(
      new Set(coupons.map((c) => normalizePlanScopeId(c.plan_id)).filter((id) => id && looksLikeUuid(id)))
    );
    const vendorIds = Array.from(
      new Set(coupons.map((c) => normalizeScopeToken(c.vendor_id)).filter((id) => id && looksLikeUuid(id)))
    );

    let planMap = {};
    let vendorMap = {};

    if (planIds.length) {
      const { data: plans, error: planErr } = await supabase
        .from('vendor_plans')
        .select('id, name')
        .in('id', planIds);
      if (planErr) {
        console.warn('[finance/coupons] plan lookup failed:', planErr.message);
      } else {
        planMap = (plans || []).reduce((acc, p) => {
          if (p?.id) acc[p.id] = p;
          return acc;
        }, {});
      }
    }

    if (vendorIds.length) {
      const { data: vendors, error: vendorErr } = await supabase
        .from('vendors')
        .select('id, company_name, owner_name, vendor_id')
        .in('id', vendorIds);
      if (vendorErr) {
        console.warn('[finance/coupons] vendor lookup failed:', vendorErr.message);
      } else {
        vendorMap = (vendors || []).reduce((acc, v) => {
          if (v?.id) acc[v.id] = v;
          return acc;
        }, {});
      }
    }

    const enriched = coupons.map((c) => ({
      ...c,
      plan: c.plan_id ? planMap[c.plan_id] || null : null,
      vendor: c.vendor_id ? vendorMap[c.vendor_id] || null : null,
    }));

    return res.json({ success: true, data: enriched });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/finance/coupons
router.post('/coupons', async (req, res) => {
  try {
    const {
      code,
      discount_type,
      value,
      plan_id = null,
      vendor_id = null,
      max_uses = 0,
      expires_at = null,
      is_active = true,
    } = req.body || {};

    const normalizedCode = normalizeCouponCode(code);
    const normalizedDiscountType = String(discount_type || '').trim().toUpperCase();
    const numericValue = Number(value);
    const numericMaxUses = Number(max_uses || 0);

    if (!normalizedCode || !normalizedDiscountType || value === undefined || value === null || value === '') {
      return res.status(400).json({ success: false, error: 'code, discount_type, value are required' });
    }

    if (!COUPON_CODE_REGEX.test(normalizedCode)) {
      return res.status(400).json({
        success: false,
        error: 'Coupon code must use letters, numbers, hyphen, or underscore only',
      });
    }

    if (!['PERCENT', 'FLAT'].includes(normalizedDiscountType)) {
      return res.status(400).json({ success: false, error: 'discount_type must be PERCENT or FLAT' });
    }

    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return res.status(400).json({ success: false, error: 'value must be a number greater than 0' });
    }

    if (normalizedDiscountType === 'PERCENT' && numericValue > 100) {
      return res.status(400).json({ success: false, error: 'Percent coupon value cannot exceed 100' });
    }

    if (!Number.isFinite(numericMaxUses) || numericMaxUses < 0) {
      return res.status(400).json({ success: false, error: 'max_uses must be 0 or more' });
    }

    const normalizedExpiresAt = expires_at ? new Date(expires_at) : null;
    if (normalizedExpiresAt && Number.isNaN(normalizedExpiresAt.getTime())) {
      return res.status(400).json({ success: false, error: 'expires_at must be a valid date/time' });
    }

    const resolvedVendorId = await resolveVendorScopeId(vendor_id);
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
    if (error) {
      const status = error.code === '23505' ? 409 : 500;
      return res.status(status).json({ success: false, error: error.message });
    }

    await writeAuditLog({
      req,
      actor: req.actor,
      action: 'COUPON_CREATED',
      entityType: 'vendor_plan_coupons',
      entityId: data?.id || null,
      details: {
        code: payload.code,
        discount_type: payload.discount_type,
        value: payload.value,
        plan_id: payload.plan_id,
        vendor_id: payload.vendor_id,
        vendor_input: vendor_id || null,
        expires_at: payload.expires_at,
      },
    });

    return res.json({ success: true, data });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/finance/coupons/:code/deactivate
router.post('/coupons/:code/deactivate', async (req, res) => {
  try {
    const { code } = req.params;
    const { data, error } = await supabase
      .from('vendor_plan_coupons')
      .update({ is_active: false })
      .eq('code', code.toUpperCase())
      .select()
      .single();
    if (error) return res.status(500).json({ success: false, error: error.message });

    await writeAuditLog({
      req,
      actor: req.actor,
      action: 'COUPON_DEACTIVATED',
      entityType: 'vendor_plan_coupons',
      entityId: data?.id || null,
      details: { code: code.toUpperCase() },
    });

    return res.json({ success: true, data });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/finance/coupons/:id
router.delete('/coupons/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, error: 'Missing coupon id' });

    const { data, error } = await supabase
      .from('vendor_plan_coupons')
      .delete()
      .eq('id', id)
      .select()
      .single();
    if (error) return res.status(500).json({ success: false, error: error.message });

    await writeAuditLog({
      req,
      actor: req.actor,
      action: 'COUPON_DELETED',
      entityType: 'vendor_plan_coupons',
      entityId: id,
      details: { code: data?.code || null },
    });

    return res.json({ success: true, data });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});
export default router;
