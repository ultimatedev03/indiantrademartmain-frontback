import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';

import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter as DialogFooterUI,
} from '@/components/ui/dialog';

import {
  Crown,
  Star,
  Zap,
  ShieldCheck,
  Rocket,
  Gem,
  BadgeCheck,
  CheckCircle2,
  MapPin,
  BarChart3,
  Headphones,
  Loader2,
} from 'lucide-react';

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

const safeJson = (v) => {
  if (!v) return v;
  if (typeof v === 'object') return v;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }
  return v;
};

const parsePlanMeta = (plan) => {
  let f = safeJson(plan?.features);

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

const buildGroups = (plan) => {
  const meta = parsePlanMeta(plan);
  const groups = [
    { title: 'Visibility', icon: <Star className="w-4 h-4" />, items: meta.visibility },
    { title: 'Leads', icon: <Rocket className="w-4 h-4" />, items: meta.leads },
    { title: 'Support', icon: <Headphones className="w-4 h-4" />, items: meta.support },
    { title: 'Analytics', icon: <BarChart3 className="w-4 h-4" />, items: meta.analytics },
    { title: 'Coverage', icon: <MapPin className="w-4 h-4" />, items: meta.coverage },
  ].filter((g) => (g.items || []).length > 0);

  const keyBenefits = groups.flatMap((g) => g.items.map((it) => ({ group: g.title, text: it })));
  return { meta, groups, keyBenefits };
};

const Pricing = () => {
  const navigate = useNavigate();

  const [authUser, setAuthUser] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setAuthUser(user || null);

        const { data: plansData, error: plansErr } = await supabase
          .from('vendor_plans')
          .select('*')
          .eq('is_active', true)
          .order('price', { ascending: true });

        if (plansErr) throw plansErr;
        setPlans(plansData || []);
      } catch (e) {
        console.error('Pricing load error:', e);
        setPlans([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const openPlanDetails = (plan) => {
    setSelectedPlan(plan);
    setDetailsOpen(true);
  };

  const selected = selectedPlan ? buildGroups(selectedPlan) : null;

  const primaryCTA = authUser ? 'Open Vendor Subscriptions' : 'Register as Vendor';
  const primaryCTAHref = authUser ? '/vendor/subscriptions' : '/vendor/register';

  return (
    <>
      <Helmet>
        <title>Pricing - IndianTradeMart</title>
        <meta
          name="description"
          content="Choose a vendor subscription plan to get more visibility, more leads, and premium support on IndianTradeMart."
        />
      </Helmet>

      <div className="min-h-screen bg-slate-50 py-14">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border bg-white text-xs font-semibold text-slate-700">
              <Crown className="w-4 h-4" />
              Vendor Subscription Plans
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mt-4">
              Choose your growth plan
            </h1>
            <p className="text-slate-600 mt-3">
              Same plans as Vendor Portal. Higher plan = more visibility + more leads + better support.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => navigate(primaryCTAHref)} className="h-11">
                {primaryCTA}
              </Button>
              <Button variant="outline" onClick={() => navigate('/vendor/login')} className="h-11 bg-white">
                Vendor Login
              </Button>
            </div>
          </div>

          {/* Plans */}
          <div className="mt-12">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-600">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Loading plans...
              </div>
            ) : plans.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-lg font-semibold text-slate-900">No plans found</div>
                <p className="text-slate-600 mt-2">Please check vendor_plans table (is_active=true).</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 max-w-7xl mx-auto">
                {plans.map((plan) => {
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
                        isPopular ? 'border-blue-300 ring-1 ring-blue-100' : 'border-slate-200'
                      )}
                    >
                      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200" />

                      {isPopular && (
                        <div className="absolute top-3 right-3 text-[11px] px-2.5 py-1 rounded-full border bg-blue-50 text-blue-700 border-blue-200 font-semibold">
                          MOST POPULAR
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

                        <div className="mt-3">
                          <div className="text-2xl font-extrabold text-slate-900">
                            ₹{formatINR(plan.price)}
                            <span className="text-xs font-medium text-slate-500">/year</span>
                          </div>
                          <div className="text-[12px] text-slate-500 mt-1">Tap card to view full details</div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-3">
                        {/* Lead limits (compact) */}
                        <div className="rounded-xl border bg-slate-50 px-3 py-3">
                          <div className="text-[11px] font-semibold text-slate-700 mb-2">Lead Limits</div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-lg bg-white border px-2 py-2">
                              <div className="text-[10px] text-slate-500">Daily</div>
                              <div className="text-sm font-bold text-slate-900">{plan.daily_limit ?? '-'}</div>
                            </div>
                            <div className="rounded-lg bg-white border px-2 py-2">
                              <div className="text-[10px] text-slate-500">Weekly</div>
                              <div className="text-sm font-bold text-slate-900">{plan.weekly_limit ?? '-'}</div>
                            </div>
                            <div className="rounded-lg bg-white border px-2 py-2">
                              <div className="text-[10px] text-slate-500">Yearly</div>
                              <div className="text-sm font-bold text-slate-900">{plan.yearly_limit ?? '-'}</div>
                            </div>
                          </div>
                        </div>

                        {/* Key Benefits (compact) */}
                        <div className="space-y-2">
                          {compactBenefits.length === 0 ? (
                            <div className="text-sm text-slate-500">No feature details available.</div>
                          ) : (
                            compactBenefits.map((b, idx) => (
                              <div key={`${b.group}-${idx}`} className="flex items-start gap-2 text-sm text-slate-700">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                                <span>{b.text}</span>
                              </div>
                            ))
                          )}
                          {moreCount > 0 && (
                            <div className="text-xs text-slate-500">+ {moreCount} more benefits</div>
                          )}
                        </div>
                      </CardContent>

                      <CardFooter className="pt-2">
                        <Button className="w-full" onClick={(e) => { e.stopPropagation(); navigate(primaryCTAHref); }}>
                          {primaryCTA}
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Details dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedPlan ? planIcon(selectedPlan.name) : null}
                {selectedPlan?.name || 'Plan Details'}
              </DialogTitle>
              <DialogDescription>
                Full feature breakdown (same as Vendor Subscriptions).
              </DialogDescription>
            </DialogHeader>

            {selectedPlan && selected ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border bg-slate-50 p-4">
                  <div>
                    <div className="text-2xl font-extrabold text-slate-900">
                      ₹{formatINR(selectedPlan.price)}
                      <span className="text-xs font-medium text-slate-500">/year</span>
                    </div>
                    <div
                      className={cx(
                        'mt-2 inline-flex items-center gap-2 text-[11px] px-2 py-1 rounded-full border font-medium',
                        badgeStyle(selected.meta.badge?.variant)
                      )}
                    >
                      {selected.meta.badge?.label || selectedPlan.name}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-white border px-3 py-2">
                      <div className="text-[10px] text-slate-500">Daily</div>
                      <div className="text-sm font-bold text-slate-900">{selectedPlan.daily_limit ?? '-'}</div>
                    </div>
                    <div className="rounded-lg bg-white border px-3 py-2">
                      <div className="text-[10px] text-slate-500">Weekly</div>
                      <div className="text-sm font-bold text-slate-900">{selectedPlan.weekly_limit ?? '-'}</div>
                    </div>
                    <div className="rounded-lg bg-white border px-3 py-2">
                      <div className="text-[10px] text-slate-500">Yearly</div>
                      <div className="text-sm font-bold text-slate-900">{selectedPlan.yearly_limit ?? '-'}</div>
                    </div>
                  </div>
                </div>

                {selected.groups.length === 0 ? (
                  <div className="text-sm text-slate-600">No feature groups found in this plan.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selected.groups.map((g) => (
                      <div key={g.title} className="rounded-xl border bg-white p-4">
                        <div className="flex items-center gap-2 font-bold text-slate-900">
                          {g.icon} {g.title}
                        </div>
                        <ul className="mt-3 space-y-2">
                          {g.items.map((it) => (
                            <li key={it} className="flex items-start gap-2 text-sm text-slate-700">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                              {it}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            <DialogFooterUI className="gap-2 sm:gap-3">
              <Button variant="outline" className="bg-white" onClick={() => navigate('/vendor/login')}>
                Vendor Login
              </Button>
              <Button onClick={() => navigate(primaryCTAHref)}>
                {primaryCTA}
              </Button>
            </DialogFooterUI>

            <div className="text-xs text-slate-500 mt-2">
              Want to purchase/activate? Open Vendor Subscriptions inside vendor portal.
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default Pricing;
