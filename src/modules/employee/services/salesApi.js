import { supabase } from '@/lib/customSupabaseClient';

const safeNum = (v) => (typeof v === 'number' && !Number.isNaN(v) ? v : 0);

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const fmtINR = (amount) => {
  const n = safeNum(amount);
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `₹${Math.round(n).toLocaleString('en-IN')}`;
  }
};

const pctChange = (current, prev) => {
  const c = safeNum(current);
  const p = safeNum(prev);
  if (p <= 0) return null;
  return Math.round(((c - p) / p) * 100);
};

export const salesApi = {
  getStats: async () => {
    // ✅ Real DB stats (last 7 days + previous 7 days) + revenue from lead_purchases
    const now = new Date();
    const end = now.toISOString();

    const start7 = startOfDay(now);
    start7.setDate(start7.getDate() - 6);

    const prevStart7 = startOfDay(start7);
    prevStart7.setDate(prevStart7.getDate() - 7);

    const prevEnd7 = new Date(start7);

    const conversions = ['CONVERTED', 'CLOSED'];

    // Totals
    const [{ count: totalLeads }, { count: totalConverted }] = await Promise.all([
      supabase.from('leads').select('*', { count: 'exact', head: true }),
      supabase.from('leads').select('*', { count: 'exact', head: true }).in('status', conversions),
    ]);

    // New leads
    const [{ count: newLeads7d }, { count: newLeadsPrev7d }] = await Promise.all([
      supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', start7.toISOString())
        .lte('created_at', end),
      supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', prevStart7.toISOString())
        .lt('created_at', prevEnd7.toISOString()),
    ]);

    // Conversions (based on status; filtered by created_at window to keep it deterministic)
    const [{ count: converted7d }, { count: convertedPrev7d }] = await Promise.all([
      supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .in('status', conversions)
        .gte('created_at', start7.toISOString())
        .lte('created_at', end),
      supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .in('status', conversions)
        .gte('created_at', prevStart7.toISOString())
        .lt('created_at', prevEnd7.toISOString()),
    ]);

    // Revenue (lead purchases)
    const [{ data: rev7 }, { data: revPrev7 }] = await Promise.all([
      supabase
        .from('lead_purchases')
        .select('amount, purchase_date')
        .gte('purchase_date', start7.toISOString())
        .lte('purchase_date', end),
      supabase
        .from('lead_purchases')
        .select('amount, purchase_date')
        .gte('purchase_date', prevStart7.toISOString())
        .lt('purchase_date', prevEnd7.toISOString()),
    ]);

    const revenue7d = safeNum(rev7?.reduce((sum, r) => sum + safeNum(r?.amount), 0));
    const revenuePrev7d = safeNum(revPrev7?.reduce((sum, r) => sum + safeNum(r?.amount), 0));

    const totalLeadsN = safeNum(totalLeads);
    const totalConvertedN = safeNum(totalConverted);
    const conversionRate = totalLeadsN ? Math.round((totalConvertedN / totalLeadsN) * 100) : 0;

    return {
      totalLeads: totalLeadsN,
      conversionRate,
      // Dashboard specific
      newLeads7d: safeNum(newLeads7d),
      newLeadsPrev7d: safeNum(newLeadsPrev7d),
      converted7d: safeNum(converted7d),
      convertedPrev7d: safeNum(convertedPrev7d),
      revenue7d,
      revenuePrev7d,
      newLeadsTrendPct: pctChange(newLeads7d, newLeadsPrev7d),
      convertedTrendPct: pctChange(converted7d, convertedPrev7d),
      revenueTrendPct: pctChange(revenue7d, revenuePrev7d),
      revenue7dFmt: fmtINR(revenue7d),
    };
  },

  getAllLeads: async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  updateLeadStatus: async (id, status) => {
    const { error } = await supabase.from('leads').update({ status }).eq('id', id);
    if (error) throw error;
  }
};
