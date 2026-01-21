import express from 'express';
import { supabase } from '../lib/supabaseClient.js';

const router = express.Router();

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

    const now = new Date();
    const thirtyAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

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

    return res.json({
      success: true,
      data: {
        totalGross,
        totalNet,
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
    return res.json({ success: true, data: data || [] });
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

    if (!code || !discount_type || !value) {
      return res.status(400).json({ success: false, error: 'code, discount_type, value are required' });
    }

    const payload = {
      code: String(code).toUpperCase(),
      discount_type: discount_type.toUpperCase(),
      value,
      plan_id,
      vendor_id,
      max_uses,
      expires_at,
      is_active,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('vendor_plan_coupons').insert([payload]).select().single();
    if (error) return res.status(500).json({ success: false, error: error.message });

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
    return res.json({ success: true, data });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});
export default router;
