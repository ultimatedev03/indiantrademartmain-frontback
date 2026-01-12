import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/modules/vendor/context/AuthContext';
import {
  CheckCircle2,
  Zap,
  ShoppingCart,
  ShieldCheck,
  Rocket,
  Crown,
  Gem,
  Star,
  BarChart3,
  Headphones,
  MapPin,
  BadgeCheck,
} from 'lucide-react';

// ✅ shadcn dialog (if you have it)
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter as DialogFooterUI,
} from '@/components/ui/dialog';

const cx = (...arr) => arr.filter(Boolean).join(' ');

const formatINR = (v) => {
  const n = Number(v || 0);
  return n.toLocaleString('en-IN');
};

const badgeStyle = (variant) => {
  switch ((variant || '').toLowerCase()) {
    case 'green':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'blue':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'purple':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'gold':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'diamond':
      return 'bg-slate-50 text-slate-800 border-slate-200';
    case 'slate':
      return 'bg-slate-50 text-slate-700 border-slate-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
};

const planIcon = (name) => {
  const n = (name || '').toLowerCase();
  if (n.includes('trial')) return <Star className="w-5 h-5" />;
  if (n.includes('starter')) return <Zap className="w-5 h-5" />;
  if (n.includes('verified')) return <ShieldCheck className="w-5 h-5" />;
  if (n.includes('boost')) return <Rocket className="w-5 h-5" />;
  if (n.includes('silver')) return <BadgeCheck className="w-5 h-5" />;
  if (n.includes('gold')) return <Crown className="w-5 h-5" />;
  if (n.includes('dimond') || n.includes('diamond')) return <Gem className="w-5 h-5" />;
  return <Star className="w-5 h-5" />;
};

const Services = () => {
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [currentSub, setCurrentSub] = useState(null);
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(true);
  const [vendorId, setVendorId] = useState(null);

  // ✅ dialog state
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  const mostPopularPlanId = useMemo(() => {
    if (!plans?.length) return null;
    const paid = plans
      .filter((p) => Number(p.price || 0) > 0)
      .sort((a, b) => Number(a.price) - Number(b.price));
    if (paid.length >= 2) return paid[Math.max(0, paid.length - 2)].id;
    if (paid.length === 1) return paid[0].id;
    return plans[0].id;
  }, [plans]);

  const parsePlanMeta = (plan) => {
    const f = plan?.features;

    if (Array.isArray(f)) {
      return {
        badge: { label: plan.name, variant: 'neutral' },
        highlights: f.map(String),
        visibility: [],
        leads: [],
        support: [],
        analytics: [],
        coverage: [],
      };
    }

    if (!f || typeof f !== 'object') {
      return {
        badge: { label: plan.name, variant: 'neutral' },
        highlights: [],
        visibility: [],
        leads: [],
        support: [],
        analytics: [],
        coverage: [],
      };
    }

    const badge = f.badge || { label: plan.name, variant: 'neutral' };
    const visibility = [];
    const leads = [];
    const support = [];
    const analytics = [];
    const coverage = [];

    // Coverage
    if (typeof f.states_limit === 'number') coverage.push(`Up to ${f.states_limit} states`);
    if (typeof f.cities_limit === 'number') coverage.push(`Up to ${f.cities_limit} cities`);

    // Visibility
    if (f.listing?.highlight) visibility.push('Highlighted listing');
    if (f.listing?.featured) visibility.push('Featured listing');
    if (f.listing?.homepage_featured) visibility.push('Homepage featured');
    if (f.listing?.category_top_ranking) visibility.push('Category top ranking');
    if (f.listing?.home_category_boost) visibility.push('Category boost');
    if (typeof f.listing?.top_slots === 'number' && f.listing.top_slots > 0) {
      visibility.push(`${f.listing.top_slots} top slots`);
    }
    if (f.verification?.trust_seal) visibility.push('Trust seal');
    if (f.listing?.profile_verified_tick) visibility.push('Verified tick on profile');

    // Leads
    if (f.leads?.priority_leads) leads.push('Priority leads');
    if (f.leads?.exclusive_leads) leads.push('Exclusive leads');
    if (f.leads?.early_access_leads) leads.push('Early access leads');
    if (f.leads?.rfq_access) leads.push('RFQ access');
    if (f.leads?.direct_call_whatsapp) leads.push('Direct call/WhatsApp');

    // Support
    if (f.support?.level) support.push(`${String(f.support.level).toUpperCase()} support`);
    if (f.support?.response_sla_hours) support.push(`SLA ${f.support.response_sla_hours} hrs`);
    if (f.support?.account_manager) support.push('Dedicated account manager');

    // Analytics
    if (f.analytics?.enabled) analytics.push('Analytics dashboard');
    if (f.analytics?.export_csv) analytics.push('Export reports (CSV)');
    if (f.analytics?.campaign_insights) analytics.push('Campaign insights');
    if (f.analytics?.competitor_insights) analytics.push('Competitor insights');

    const highlights = [];
    if (badge?.label) highlights.push(`Badge: ${badge.label}`);
    if (f.verification?.kyc_required) highlights.push('KYC required');

    return { badge, highlights, visibility, leads, support, analytics, coverage };
  };

  useEffect(() => {
    const fetchVendorId = async () => {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        if (!authUser) return;

        const { data: vendor, error } = await supabase
          .from('vendors')
          .select('id')
          .eq('user_id', authUser.id)
          .maybeSingle();

        if (error) throw error;
        setVendorId(vendor?.id || null);
      } catch (e) {
        console.error('Error fetching vendor ID:', e);
      }
    };

    if (user && !vendorId) fetchVendorId();
  }, [user, vendorId]);

  useEffect(() => {
    if (vendorId) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Force fresh data from Supabase (no cache)
      const { data: plansData, error: plansErr } = await supabase
        .from('vendor_plans')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });

      if (plansErr) throw plansErr;
      setPlans(plansData || []);

      // Query for ACTIVE subscription - this will get the latest one
      const { data: subs, error: subsErr } = await supabase
        .from('vendor_plan_subscriptions')
        .select('*, plan:vendor_plans(id,name,price)')
        .eq('vendor_id', vendorId)
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false })
        .limit(1);

      if (subsErr) throw subsErr;
      // Get the first (most recent) active subscription
      const currentActive = subs && subs.length > 0 ? subs[0] : null;
      setCurrentSub(currentActive);

      const { data: q, error: qErr } = await supabase
        .from('vendor_lead_quota')
        .select('*')
        .eq('vendor_id', vendorId)
        .maybeSingle();

      if (qErr) throw qErr;
      setQuota(q);
    } catch (e) {
      console.error('Error loading subscription data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (plan) => {
    if (!vendorId) {
      toast({ title: 'Error', description: 'Vendor ID not found', variant: 'destructive' });
      return;
    }
    toast({ title: 'Processing...', description: `Subscribing to ${plan.name}` });

    try {
      // If already subscribed to a plan, deactivate it first
      if (currentSub && currentSub.id) {
        await supabase
          .from('vendor_plan_subscriptions')
          .update({ status: 'INACTIVE' })
          .eq('id', currentSub.id);
      }

      // Now activate the new plan
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000);
      
      await supabase.from('vendor_plan_subscriptions').insert({
        vendor_id: vendorId,
        plan_id: plan.id,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        status: 'ACTIVE',
        plan_duration_days: 365,
        auto_renewal_enabled: false,
        renewal_notification_sent: false
      });

      toast({ title: 'Success!', description: 'Plan activated.' });
      setDetailsOpen(false);
      // Reload immediately to refresh UI and badges
      setTimeout(() => loadData(), 500);
    } catch (e) {
      console.error('Subscription error:', e);
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
      // Reload anyway to sync state
      setTimeout(() => loadData(), 500);
    }
  };

  // Check if subscription is active and not expired
  const isSubscriptionActive = (sub) => {
    if (!sub) return false;
    if (sub.status !== 'ACTIVE') return false;
    const endDate = new Date(sub.end_date);
    return endDate > new Date();
  };

  // Calculate days remaining
  const getDaysRemaining = (sub) => {
    if (!sub?.end_date) return 0;
    const end = new Date(sub.end_date);
    const now = new Date();
    const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return Math.max(0, daysLeft);
  };

  const buyLeads = async () => {
    if (!vendorId) {
      toast({ title: 'Error', description: 'Vendor ID not found', variant: 'destructive' });
      return;
    }

    // ✅ Check if subscription is active and not expired
    if (!isSubscriptionActive(currentSub)) {
      toast({
        title: 'No Active Subscription',
        description: 'Please subscribe to a plan to purchase additional leads.',
        variant: 'destructive'
      });
      return;
    }

    if (window.confirm('Buy 10 additional leads for ₹1500?')) {
      try {
        await supabase.from('vendor_additional_leads').insert({
          vendor_id: vendorId,
          leads_purchased: 10,
          leads_remaining: 10,
          amount_paid: 1500,
        });
        toast({ title: 'Leads Purchased', description: '10 leads added to your account.' });
        loadData();
      } catch (e) {
        toast({ title: 'Error', description: e.message, variant: 'destructive' });
      }
    }
  };

  const openPlanDetails = (plan) => {
    setSelectedPlan(plan);
    setDetailsOpen(true);
  };

  const buildGroups = (plan) => {
    const meta = parsePlanMeta(plan);

    const groups = [
      { title: 'Visibility', icon: <Star className="w-4 h-4" />, items: meta.visibility },
      { title: 'Leads', icon: <Rocket className="w-4 h-4" />, items: meta.leads },
      { title: 'Support', icon: <Headphones className="w-4 h-4" />, items: meta.support },
      { title: 'Analytics', icon: <BarChart3 className="w-4 h-4" />, items: meta.analytics },
      { title: 'Coverage', icon: <MapPin className="w-4 h-4" />, items: meta.coverage },
    ].filter((g) => (g.items || []).length > 0);

    // ✅ small card key points (mix)
    const keyBenefits = groups.flatMap((g) => g.items.map((it) => ({ group: g.title, text: it })));

    return { meta, groups, keyBenefits };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[420px]">
        <div className="text-center">
          <Zap className="w-12 h-12 text-slate-300 mx-auto mb-2 animate-pulse" />
          <p className="text-slate-500">Loading subscription plans...</p>
        </div>
      </div>
    );
  }

  const selected = selectedPlan ? buildGroups(selectedPlan) : null;
  const selectedIsCurrent = selectedPlan && currentSub?.plan_id === selectedPlan.id;
  const selectedIsPopular = selectedPlan && selectedPlan.id === mostPopularPlanId;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="rounded-2xl border bg-white p-6 md:p-8 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Subscription Plans</h1>
            <p className="text-slate-600 mt-1">Choose a plan to get more visibility, more leads, and premium support.</p>
          </div>

          <div className="flex gap-2 items-center flex-col sm:flex-row">
            {/* ✅ Subscription Status */}
            {currentSub && (
              <div className={cx(
                'px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap',
                isSubscriptionActive(currentSub)
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              )}>
                <Crown className="w-4 h-4" />
                {isSubscriptionActive(currentSub) ? (
                  <span>{getDaysRemaining(currentSub)} days left</span>
                ) : (
                  <span>Plan Expired</span>
                )}
              </div>
            )}

            <Button
              variant="outline"
              onClick={buyLeads}
              disabled={!isSubscriptionActive(currentSub)}
              className={cx(
                'bg-white',
                !isSubscriptionActive(currentSub) && 'opacity-50 cursor-not-allowed'
              )}
              title={!isSubscriptionActive(currentSub) ? 'Please subscribe to a plan first' : ''}
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Buy Leads
            </Button>
          </div>
        </div>

        {/* Quota */}
        {quota && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { label: 'Daily', used: quota.daily_used, limit: quota.daily_limit },
              { label: 'Weekly', used: quota.weekly_used, limit: quota.weekly_limit },
              { label: 'Yearly', used: quota.yearly_used, limit: quota.yearly_limit },
            ].map((x) => (
              <div key={x.label} className="rounded-xl border bg-gradient-to-b from-slate-50 to-white p-4">
                <div className="text-xs text-slate-500 uppercase">{x.label} Usage</div>
                <div className="mt-1 text-xl font-bold text-slate-900">
                  {x.used} <span className="text-slate-400 text-sm">/ {x.limit}</span>
                </div>
                <div className="mt-2 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-900/80"
                    style={{ width: `${Math.min(100, (Number(x.used || 0) / Math.max(1, Number(x.limit || 0))) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cards (COMPACT) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {plans.map((plan) => {
          const isCurrent = currentSub?.plan_id === plan.id;
          const isPopular = plan.id === mostPopularPlanId;

          const { meta, keyBenefits } = buildGroups(plan);
          const badge = meta.badge || {};
          const badgeLabel = badge.label || plan.name;
          const badgeVariant = badge.variant || 'neutral';

          const compactBenefits = keyBenefits.slice(0, 3);
          const moreCount = Math.max(0, keyBenefits.length - compactBenefits.length);

          return (
            <Card
              key={plan.id}
              role="button"
              tabIndex={0}
              onClick={() => openPlanDetails(plan)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') openPlanDetails(plan);
              }}
              className={cx(
                'relative overflow-hidden rounded-2xl transition-all cursor-pointer outline-none',
                'bg-white border shadow-sm hover:shadow-md hover:-translate-y-[1px]',
                isPopular && !isCurrent ? 'border-blue-300 ring-1 ring-blue-100' : '',
                isCurrent ? 'border-emerald-300 ring-2 ring-emerald-200 shadow-md' : ''
              )}
            >
              {/* Top ribbon */}
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200" />
              {isPopular && !isCurrent && (
                <div className="absolute top-3 right-3 text-[11px] px-2.5 py-1 rounded-full border bg-blue-50 text-blue-700 border-blue-200 font-semibold">
                  MOST POPULAR
                </div>
              )}
              {isCurrent && (
                <div className="absolute top-3 right-3 text-[11px] px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold">
                  CURRENT PLAN
                </div>
              )}

              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl border bg-slate-50 flex items-center justify-center text-slate-900">
                      {planIcon(plan.name)}
                    </div>
                    <div>
                      <CardTitle className="text-base">{plan.name}</CardTitle>
                      <div
                        className={cx(
                          'mt-1 inline-flex items-center gap-2 text-[11px] px-2 py-1 rounded-full border font-medium',
                          badgeStyle(badgeVariant)
                        )}
                      >
                        {badgeLabel}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <div className="text-2xl font-extrabold text-slate-900">
                      ₹{formatINR(plan.price)}
                      <span className="text-xs font-medium text-slate-500">/year</span>
                    </div>
                    <div className="text-[12px] text-slate-500 mt-1">Tap card to view full details</div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Lead Limits compact */}
                <div className="rounded-xl border bg-slate-50 px-3 py-3">
                  <div className="text-[11px] font-semibold text-slate-700 mb-2">Lead Limits</div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-white border px-2 py-2">
                      <div className="text-[10px] text-slate-500">Daily</div>
                      <div className="text-sm font-bold text-slate-900">{plan.daily_limit}</div>
                    </div>
                    <div className="rounded-lg bg-white border px-2 py-2">
                      <div className="text-[10px] text-slate-500">Weekly</div>
                      <div className="text-sm font-bold text-slate-900">{plan.weekly_limit}</div>
                    </div>
                    <div className="rounded-lg bg-white border px-2 py-2">
                      <div className="text-[10px] text-slate-500">Yearly</div>
                      <div className="text-sm font-bold text-slate-900">{plan.yearly_limit}</div>
                    </div>
                  </div>
                </div>

                {/* Highlights (super short) */}
                {(meta.highlights || []).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {meta.highlights.slice(0, 2).map((t, idx) => (
                      <span key={idx} className="text-[11px] px-2 py-1 rounded-full border bg-white text-slate-700">
                        {t}
                      </span>
                    ))}
                    {meta.highlights.length > 2 && (
                      <span className="text-[11px] px-2 py-1 rounded-full border bg-white text-slate-500">
                        +{meta.highlights.length - 2} more
                      </span>
                    )}
                  </div>
                )}

                {/* Key benefits (only 3 lines) */}
                <div className="space-y-2">
                  {compactBenefits.map((b, i) => (
                    <div key={i} className="flex gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-[2px]" />
                      <span>{b.text}</span>
                    </div>
                  ))}
                  {moreCount > 0 && (
                    <div className="text-xs text-slate-500 pl-6">+ {moreCount} more benefits</div>
                  )}
                </div>
              </CardContent>

              <CardFooter className="pt-1">
                <Button
                  className={cx(
                    'w-full rounded-xl h-10 font-semibold',
                    isCurrent ? 'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50' : ''
                  )}
                  variant={isCurrent ? 'outline' : 'default'}
                  disabled={isCurrent}
                  onClick={(e) => {
                    // ✅ button click pe card modal open na ho
                    e.stopPropagation();
                    if (!isCurrent) handleSubscribe(plan);
                  }}
                >
                  {isCurrent ? 'Active Plan' : 'Upgrade'}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* ✅ Plan Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl">
          {!selectedPlan ? null : (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl border bg-slate-50 flex items-center justify-center text-slate-900">
                      {planIcon(selectedPlan.name)}
                    </div>
                    <div>
                      <DialogTitle className="text-xl">{selectedPlan.name}</DialogTitle>
                      <DialogDescription className="mt-1">
                        Full plan details • Price & benefits
                      </DialogDescription>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {selectedIsPopular && !selectedIsCurrent && (
                      <div className="text-[11px] px-2.5 py-1 rounded-full border bg-blue-50 text-blue-700 border-blue-200 font-semibold">
                        MOST POPULAR
                      </div>
                    )}
                    {selectedIsCurrent && (
                      <div className="text-[11px] px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold">
                        CURRENT PLAN
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-end justify-between">
                  <div className="text-3xl font-extrabold text-slate-900">
                    ₹{formatINR(selectedPlan.price)}
                    <span className="text-sm font-medium text-slate-500">/year</span>
                  </div>
                </div>
              </DialogHeader>

              {/* body scroll */}
              <div className="mt-4 max-h-[60vh] overflow-y-auto pr-2 space-y-4">
                {/* lead limits */}
                <div className="rounded-xl border bg-slate-50 p-4">
                  <div className="text-xs font-semibold text-slate-700 mb-2">Lead Limits</div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-white border p-2">
                      <div className="text-[11px] text-slate-500">Daily</div>
                      <div className="text-sm font-bold text-slate-900">{selectedPlan.daily_limit}</div>
                    </div>
                    <div className="rounded-lg bg-white border p-2">
                      <div className="text-[11px] text-slate-500">Weekly</div>
                      <div className="text-sm font-bold text-slate-900">{selectedPlan.weekly_limit}</div>
                    </div>
                    <div className="rounded-lg bg-white border p-2">
                      <div className="text-[11px] text-slate-500">Yearly</div>
                      <div className="text-sm font-bold text-slate-900">{selectedPlan.yearly_limit}</div>
                    </div>
                  </div>
                </div>

                {/* highlights full */}
                {selected?.meta?.highlights?.length > 0 && (
                  <div className="rounded-xl border p-4">
                    <div className="text-sm font-semibold text-slate-900 mb-2">Highlights</div>
                    <div className="flex flex-wrap gap-2">
                      {selected.meta.highlights.map((t, idx) => (
                        <span key={idx} className="text-[11px] px-2 py-1 rounded-full border bg-white text-slate-700">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* groups full */}
                <div className="space-y-3">
                  {selected?.groups?.map((g) => (
                    <div key={g.title} className="rounded-xl border p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <span className="text-slate-600">{g.icon}</span>
                        {g.title}
                      </div>
                      <div className="mt-3 space-y-2">
                        {g.items.map((line, i) => (
                          <div key={i} className="flex gap-2 text-sm text-slate-700">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-[2px]" />
                            <span>{line}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooterUI className="mt-4">
                <Button
                  className={cx(
                    'w-full rounded-xl h-11 font-semibold',
                    selectedIsCurrent ? 'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50' : ''
                  )}
                  variant={selectedIsCurrent ? 'outline' : 'default'}
                  disabled={selectedIsCurrent}
                  onClick={() => handleSubscribe(selectedPlan)}
                >
                  {selectedIsCurrent ? 'Active Plan' : 'Upgrade'}
                </Button>
              </DialogFooterUI>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Services;
