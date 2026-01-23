import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/Card';
import { TrendingUp, Eye, ShoppingCart, Users, Mail, Phone } from 'lucide-react';

const now = new Date();
const startOf = (unit) => {
  const d = new Date(now);
  if (unit === 'day') d.setHours(0, 0, 0, 0);
  if (unit === 'week') {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
  }
  if (unit === 'year') {
    d.setMonth(0, 1);
    d.setHours(0, 0, 0, 0);
  }
  return d.toISOString();
};

const Analytics = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          setLoading(false);
          return;
        }

        const { data: vendor } = await supabase
          .from('vendors')
          .select('id, trust_score')
          .eq('user_id', session.user.id)
          .single();
        if (!vendor) {
          setLoading(false);
          return;
        }

        // Products + views
        const { data: products, count: productCount } = await supabase
          .from('products')
          .select('views', { count: 'exact' })
          .eq('vendor_id', vendor.id);
        const totalViews = (products || []).reduce((sum, p) => sum + (p.views || 0), 0);

        // Lead purchases (total / day / week / year)
        const purchaseBase = supabase
          .from('lead_purchases')
          .select('id,purchase_date', { count: 'exact' })
          .eq('vendor_id', vendor.id);
        const { count: totalLeads } = await purchaseBase;
        const { count: dailyLeads } = await purchaseBase.gte('purchase_date', startOf('day'));
        const { count: weeklyLeads } = await purchaseBase.gte('purchase_date', startOf('week'));
        const { count: yearlyLeads } = await purchaseBase.gte('purchase_date', startOf('year'));

        // Contacts (distinct leads contacted)
        const { data: contacts } = await supabase
          .from('lead_contacts')
          .select('lead_id, contact_type, contact_date')
          .eq('vendor_id', vendor.id);
        const contactSet = new Set((contacts || []).map((c) => c.lead_id));
        const totalContacted = contactSet.size;
        const dailyContacted = new Set(
          (contacts || []).filter(c => c.contact_date >= startOf('day')).map(c => c.lead_id)
        ).size;
        const weeklyContacted = new Set(
          (contacts || []).filter(c => c.contact_date >= startOf('week')).map(c => c.lead_id)
        ).size;

        // Proposals sent
        const { count: proposalsSent } = await supabase
          .from('proposals')
          .select('*', { count: 'exact' })
          .eq('vendor_id', vendor.id);

        setStats({
          totalViews,
          totalProducts: productCount || 0,
          totalLeads: totalLeads || 0,
          dailyLeads: dailyLeads || 0,
          weeklyLeads: weeklyLeads || 0,
          yearlyLeads: yearlyLeads || 0,
          totalContacted,
          dailyContacted,
          weeklyContacted,
          proposalsSent: proposalsSent || 0,
          trustScore: vendor.trust_score || 0,
        });
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) return <div className="p-8 text-center">Loading analytics...</div>;
  if (!stats) return <div className="p-8 text-center text-gray-500">No analytics data.</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-neutral-800">Analytics</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600 flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Total Views
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-neutral-800">
              {stats.totalViews.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-neutral-800">
              {stats.totalProducts}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Leads Purchased
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-neutral-800">
              {stats.totalLeads}
            </div>
            <div className="text-xs text-neutral-500 mt-1">
              Today: {stats.dailyLeads} · This Week: {stats.weeklyLeads} · This Year: {stats.yearlyLeads}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Trust Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-neutral-800">
              {stats.trustScore}
            </div>
            <div className="text-xs text-neutral-500 mt-1">Higher is better</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
              Lead Interactions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-600">Leads Contacted (distinct)</span>
              <span className="text-lg font-bold text-neutral-900">{stats.totalContacted}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg border bg-neutral-50 p-2">
                <div className="text-[11px] text-neutral-500">Today</div>
                <div className="font-semibold text-neutral-900">{stats.dailyContacted}</div>
              </div>
              <div className="rounded-lg border bg-neutral-50 p-2">
                <div className="text-[11px] text-neutral-500">This Week</div>
                <div className="font-semibold text-neutral-900">{stats.weeklyContacted}</div>
              </div>
              <div className="rounded-lg border bg-neutral-50 p-2">
                <div className="text-[11px] text-neutral-500">This Year</div>
                <div className="font-semibold text-neutral-900">{stats.totalContacted}</div>
              </div>
            </div>
            <div className="text-xs text-neutral-500 flex items-center gap-2">
              <Phone className="h-3.5 w-3.5" /> Calls / <Mail className="h-3.5 w-3.5" /> Emails logged in real time
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-neutral-700">Performance Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-neutral-600">
            <p>Real-time stats combine product views, lead purchases, and contact events.</p>
            <p>Use these numbers to monitor how often you reach out to buyers and how many leads you’re acquiring each day.</p>
            <p>Proposals sent: <span className="font-semibold text-neutral-900">{stats.proposalsSent}</span></p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Analytics;
