import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/Card';
import { TrendingUp, Eye, ShoppingCart, Users } from 'lucide-react';

const Analytics = () => {
  const [stats, setStats] = useState({
    totalViews: 0,
    totalProducts: 0,
    totalLeads: 0,
    trustScore: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          setLoading(false);
          return;
        }

        // Get vendor ID
        const { data: vendor } = await supabase
          .from('vendors')
          .select('id, trust_score')
          .eq('user_id', session.user.id)
          .single();

        if (!vendor) {
          setLoading(false);
          return;
        }

        // Get products count and total views
        const { data: products, count: productCount } = await supabase
          .from('products')
          .select('views', { count: 'exact' })
          .eq('vendor_id', vendor.id);

        const totalViews = products?.reduce((sum, p) => sum + (p.views || 0), 0) || 0;

        // Get leads count
        const { count: leadsCount } = await supabase
          .from('lead_purchases')
          .select('*', { count: 'exact' })
          .eq('vendor_id', vendor.id);

        setStats({
          totalViews,
          totalProducts: productCount || 0,
          totalLeads: leadsCount || 0,
          trustScore: vendor.trust_score || 0
        });
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return <div className="p-8 text-center">Loading analytics...</div>;
  }

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
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Performance Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-neutral-600">
            <p>Your analytics are being tracked across the platform.</p>
            <p>Product views, lead interactions, and customer engagement metrics are updated in real-time.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Analytics;
