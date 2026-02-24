import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fetchWithCsrf } from '@/lib/fetchWithCsrf';
import { apiUrl } from '@/lib/apiBase';
import { BadgeCheck, Check, Crown, Gem, ShieldCheck, Sparkles, Star, Zap } from 'lucide-react';

const cx = (...arr) => arr.filter(Boolean).join(' ');

const asObject = (value) => {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof value === 'object' && !Array.isArray(value) ? value : {};
};

const toNonNegativeNumber = (value, fallback = 0) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
};

const formatINR = (value) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '0';
  const hasFraction = !Number.isInteger(n);
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  });
};

const getPlanDisplayPricing = (plan) => {
  const nowPrice = toNonNegativeNumber(plan?.price, 0);
  const features = asObject(plan?.features);
  const pricing = asObject(features?.pricing);

  const configuredOriginalPrice = toNonNegativeNumber(pricing.original_price, 0);
  const configuredDiscountPercent = Number(pricing.discount_percent || 0);

  let originalPrice = configuredOriginalPrice;
  let discountPercent = Number.isFinite(configuredDiscountPercent)
    ? Math.max(0, Math.min(100, configuredDiscountPercent))
    : 0;

  if ((!Number.isFinite(originalPrice) || originalPrice <= nowPrice) && discountPercent > 0 && discountPercent < 100) {
    originalPrice = Number(((nowPrice * 100) / (100 - discountPercent)).toFixed(2));
  }

  if (!Number.isFinite(originalPrice) || originalPrice <= nowPrice) {
    originalPrice = 0;
  }

  if ((!discountPercent || discountPercent <= 0) && originalPrice > nowPrice && originalPrice > 0) {
    discountPercent = Number((((originalPrice - nowPrice) / originalPrice) * 100).toFixed(2));
  }

  const discountLabel = String(pricing.discount_label || '').trim();

  return {
    nowPrice,
    originalPrice,
    discountPercent,
    discountLabel,
  };
};

const getBillingPricing = (plan, billing) => {
  const yearly = getPlanDisplayPricing(plan);

  if (billing === 'yearly') {
    return yearly;
  }

  return {
    ...yearly,
    nowPrice: Number((yearly.nowPrice / 12).toFixed(2)),
    originalPrice: Number((yearly.originalPrice / 12).toFixed(2)),
  };
};

const getDiscountTag = (pricing) => {
  const label = String(pricing?.discountLabel || '').trim();
  if (label) return label;
  const percent = Number(pricing?.discountPercent || 0);
  if (percent > 0) return `${Math.round(percent)}% OFF`;
  return '';
};

const getCoverage = (plan) => {
  const features = asObject(plan?.features);
  const coverage = asObject(features?.coverage);

  const rawStates = coverage.states_limit ?? features.states_limit;
  const rawCities = coverage.cities_limit ?? features.cities_limit;

  const states = Number(rawStates);
  const cities = Number(rawCities);

  return {
    states: Number.isFinite(states) && states >= 0 ? Math.floor(states) : 0,
    cities: Number.isFinite(cities) && cities >= 0 ? Math.floor(cities) : 0,
  };
};

const getTopSlots = (plan) => {
  const features = asObject(plan?.features);
  const listing = asObject(features?.listing);
  const topSlots = Number(listing?.top_slots);
  if (Number.isFinite(topSlots) && topSlots > 0) return Math.floor(topSlots);
  return 0;
};

const getRankingText = (plan) => {
  const features = asObject(plan?.features);
  const listing = asObject(features?.listing);
  const ranking =
    String(features?.ranking || '').trim() ||
    String(features?.rank || '').trim() ||
    String(listing?.rank_text || '').trim() ||
    String(listing?.ranking_text || '').trim();
  if (ranking) return ranking;
  if (toNonNegativeNumber(plan?.price, 0) <= 0) return 'Remaining all';
  return `All ${String(plan?.name || 'Plan')} member`;
};

const getPlanTag = (plan) => {
  const badge = asObject(asObject(plan?.features)?.badge);
  const label = String(badge?.label || '').trim();
  if (label) return label;
  return String(plan?.name || 'Plan');
};

const isPlanPopularFromBadge = (plan) => {
  const badge = asObject(asObject(plan?.features)?.badge);
  const label = String(badge?.label || '').trim().toLowerCase();
  return label.includes('popular');
};

const getPlanIcon = (name) => {
  const n = String(name || '').toLowerCase();
  if (n.includes('trial')) return Star;
  if (n.includes('startup') || n.includes('starter')) return Zap;
  if (n.includes('certified') || n.includes('verified')) return ShieldCheck;
  if (n.includes('booster') || n.includes('boost')) return Sparkles;
  if (n.includes('silver')) return BadgeCheck;
  if (n.includes('gold')) return Crown;
  if (n.includes('diamond') || n.includes('dimond')) return Gem;
  return Star;
};

const Pricing = () => {
  const [billing, setBilling] = useState('yearly');
  const [open, setOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadPlans = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetchWithCsrf(apiUrl('/api/payment/plans'));
        const payload = await response.json().catch(() => ({}));

        if (!response.ok || payload?.success === false) {
          throw new Error(payload?.error || 'Failed to load plans');
        }

        const rawList = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.plans)
            ? payload.plans
            : [];

        const nextPlans = rawList
          .filter((plan) => plan && plan.is_active !== false)
          .sort((a, b) => toNonNegativeNumber(a?.price, 0) - toNonNegativeNumber(b?.price, 0));

        if (!cancelled) {
          setPlans(nextPlans);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load pricing');
          setPlans([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPlans();
    return () => {
      cancelled = true;
    };
  }, []);

  const mostPopularPlanId = useMemo(() => {
    if (!plans.length) return null;
    const paid = plans
      .filter((p) => toNonNegativeNumber(p?.price, 0) > 0)
      .sort((a, b) => toNonNegativeNumber(a?.price, 0) - toNonNegativeNumber(b?.price, 0));
    if (paid.length >= 2) return paid[Math.max(0, paid.length - 2)].id;
    if (paid.length === 1) return paid[0].id;
    return plans[0]?.id || null;
  }, [plans]);

  const openPlan = (plan) => {
    setSelectedPlan(plan);
    setOpen(true);
  };

  const selectedPricing = useMemo(() => {
    if (!selectedPlan) return null;
    return getBillingPricing(selectedPlan, billing);
  }, [selectedPlan, billing]);

  const selectedCoverage = useMemo(() => {
    if (!selectedPlan) return { states: 0, cities: 0 };
    return getCoverage(selectedPlan);
  }, [selectedPlan]);

  const selectedTopSlots = useMemo(() => {
    if (!selectedPlan) return 0;
    return getTopSlots(selectedPlan);
  }, [selectedPlan]);

  return (
    <>
      <Helmet>
        <title>Pricing - IndianTradeMart</title>
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 py-14">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border bg-white shadow-sm text-xs text-slate-700">
              <Crown className="w-4 h-4" />
              Vendor Subscription Plans
            </div>

            <h1 className="mt-4 text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">
              Choose your growth plan
            </h1>
            <p className="mt-3 text-slate-600">
              Same plan pricing as Vendor Dashboard. Monthly is auto-calculated from yearly pricing.
            </p>

            <div className="mt-6 flex items-center justify-center gap-3">
              <Link to="/vendor/register">
                <Button className="h-10 px-5">Register as Vendor</Button>
              </Link>
              <Link to="/vendor/login">
                <Button variant="outline" className="h-10 px-5">
                  Vendor Login
                </Button>
              </Link>
            </div>

            <div className="mt-8 inline-flex rounded-full border bg-white p-1 shadow-sm">
              <button
                onClick={() => setBilling('monthly')}
                className={cx(
                  'px-4 py-2 text-sm rounded-full transition',
                  billing === 'monthly' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'
                )}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling('yearly')}
                className={cx(
                  'px-4 py-2 text-sm rounded-full transition',
                  billing === 'yearly' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'
                )}
              >
                Yearly
              </button>
            </div>

            <div className="mt-3 text-xs text-slate-500">
              Live superadmin pricing. Monthly values are computed as yearly price / 12.
            </div>
          </div>

          {loading ? (
            <div className="mt-12 max-w-6xl mx-auto rounded-2xl border bg-white p-8 text-center text-slate-600">
              Loading pricing plans...
            </div>
          ) : null}

          {!loading && error ? (
            <div className="mt-12 max-w-6xl mx-auto rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
              <p className="text-red-700 font-semibold">Unable to load pricing right now.</p>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          ) : null}

          {!loading && !error && plans.length === 0 ? (
            <div className="mt-12 max-w-6xl mx-auto rounded-2xl border bg-white p-8 text-center text-slate-600">
              No active plans found.
            </div>
          ) : null}

          {!loading && !error && plans.length > 0 ? (
            <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {plans.map((plan) => {
                const Icon = getPlanIcon(plan?.name);
                const pricing = getBillingPricing(plan, billing);
                const coverage = getCoverage(plan);
                const topSlots = getTopSlots(plan);
                const ranking = getRankingText(plan);
                const discountTag = getDiscountTag(pricing);
                const isFree = toNonNegativeNumber(pricing?.nowPrice, 0) === 0;
                const hasOldPrice =
                  toNonNegativeNumber(pricing?.originalPrice, 0) > toNonNegativeNumber(pricing?.nowPrice, 0);
                const isPopular = plan?.id === mostPopularPlanId || isPlanPopularFromBadge(plan);
                const yearlyLimit = Math.max(
                  0,
                  Math.floor(
                    toNonNegativeNumber(plan?.yearly_limit, 0) ||
                      toNonNegativeNumber(plan?.weekly_limit, 0) * 52
                  )
                );

                return (
                  <motion.button
                    key={plan?.id || plan?.name}
                    type="button"
                    onClick={() => openPlan(plan)}
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.99 }}
                    className="group text-left"
                  >
                    <div
                      className={cx(
                        'rounded-2xl p-[1px] transition',
                        isPopular
                          ? 'bg-gradient-to-br from-blue-500 via-emerald-500 to-indigo-500'
                          : 'bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200'
                      )}
                    >
                      <div
                        className={cx(
                          'rounded-2xl bg-white/90 backdrop-blur px-5 py-5 shadow-sm transition',
                          'hover:shadow-xl',
                          isPopular ? 'ring-1 ring-emerald-500/20' : 'ring-1 ring-slate-200/60'
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={cx(
                                'h-10 w-10 rounded-xl grid place-items-center border',
                                isPopular ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
                              )}
                            >
                              <Icon className={cx('w-5 h-5', isPopular ? 'text-emerald-600' : 'text-slate-700')} />
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-lg font-bold text-slate-900">{plan?.name || 'Plan'}</h3>
                                <span className="text-xs px-2 py-0.5 rounded-full border bg-white text-slate-700">
                                  {getPlanTag(plan)}
                                </span>
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5">Tap card to view full details</div>
                            </div>
                          </div>

                          {isPopular ? (
                            <div className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                              MOST POPULAR
                            </div>
                          ) : null}
                        </div>

                        <div className="mt-4 flex items-end justify-between gap-3">
                          <div>
                            {isFree ? (
                              <div className="text-3xl font-extrabold text-slate-900">Rs.0</div>
                            ) : (
                              <div className="flex items-end gap-2">
                                <div className="text-3xl font-extrabold text-slate-900">
                                  Rs.{formatINR(pricing.nowPrice)}
                                </div>
                                <div className="text-sm text-slate-500">/{billing === 'monthly' ? 'month' : 'year'}</div>
                              </div>
                            )}

                            {hasOldPrice ? (
                              <div className="mt-1 text-xs text-slate-500">
                                <span className="line-through mr-2">Rs.{formatINR(pricing.originalPrice)}</span>
                                {discountTag ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                                    <Sparkles className="w-3.5 h-3.5" /> {discountTag}
                                  </span>
                                ) : null}
                              </div>
                            ) : null}
                          </div>

                          <div className="text-xs text-slate-500 text-right">
                            <div className="font-semibold text-slate-700">Ranking</div>
                            <div>{ranking || '-'}</div>
                          </div>
                        </div>

                        <div className="mt-4 rounded-xl border bg-slate-50 p-3">
                          <div className="text-xs font-semibold text-slate-700 mb-2">Lead Limits</div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="rounded-lg border bg-white p-2 text-center">
                              <div className="text-[11px] text-slate-500">Daily Bonus</div>
                              <div className="text-sm font-bold text-slate-900">{Math.floor(toNonNegativeNumber(plan?.daily_limit, 0))}</div>
                            </div>
                            <div className="rounded-lg border bg-white p-2 text-center">
                              <div className="text-[11px] text-slate-500">Weekly</div>
                              <div className="text-sm font-bold text-slate-900">{Math.floor(toNonNegativeNumber(plan?.weekly_limit, 0))}</div>
                            </div>
                            <div className="rounded-lg border bg-white p-2 text-center">
                              <div className="text-[11px] text-slate-500">Yearly</div>
                              <div className="text-sm font-bold text-slate-900">{yearlyLimit}</div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 space-y-2 text-sm text-slate-700">
                          <div className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-emerald-600" />
                            <span>Up to {coverage.states} states</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-emerald-600" />
                            <span>Up to {coverage.cities} cities</span>
                          </div>
                          {topSlots > 0 ? (
                            <div className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-emerald-600" />
                              <span>Top level listing: {topSlots}</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          {selectedPlan && selectedPricing ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between gap-3">
                  <span className="text-slate-900 font-extrabold">{selectedPlan.name} Plan Details</span>
                  {selectedPlan.id === mostPopularPlanId || isPlanPopularFromBadge(selectedPlan) ? (
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      MOST POPULAR
                    </span>
                  ) : null}
                </DialogTitle>
              </DialogHeader>

              <div className="grid md:grid-cols-2 gap-6 mt-2">
                <div className="rounded-2xl border bg-gradient-to-b from-slate-50 to-white p-5">
                  <div className="text-xs text-slate-500">Billing</div>
                  <div className="mt-1 text-sm font-semibold text-slate-800">
                    {billing === 'monthly' ? 'Monthly (derived from yearly)' : 'Yearly (superadmin value)'}
                  </div>

                  <div className="mt-4">
                    {toNonNegativeNumber(selectedPricing.nowPrice, 0) <= 0 ? (
                      <div className="text-4xl font-extrabold text-slate-900">Rs.0</div>
                    ) : (
                      <>
                        <div className="flex items-end gap-2">
                          <div className="text-4xl font-extrabold text-slate-900">Rs.{formatINR(selectedPricing.nowPrice)}</div>
                          <div className="text-sm text-slate-500">/{billing === 'monthly' ? 'month' : 'year'}</div>
                        </div>
                        {toNonNegativeNumber(selectedPricing.originalPrice, 0) > toNonNegativeNumber(selectedPricing.nowPrice, 0) ? (
                          <div className="mt-1 text-sm text-slate-500">
                            <span className="line-through mr-2">Rs.{formatINR(selectedPricing.originalPrice)}</span>
                            <span className="text-emerald-700 font-semibold">{getDiscountTag(selectedPricing) || 'Discount active'}</span>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <Link to="/vendor/register">
                      <Button className="w-full">Register as Vendor</Button>
                    </Link>
                    <Link to="/vendor/login">
                      <Button variant="outline" className="w-full">
                        Vendor Login
                      </Button>
                    </Link>
                  </div>

                  <div className="mt-4 text-xs text-slate-500">
                    Note: Final activation depends on payment and verification (if applicable).
                  </div>
                </div>

                <div className="rounded-2xl border bg-white p-5">
                  <div className="text-sm font-bold text-slate-900 mb-3">What you get</div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl border bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Daily Bonus</div>
                      <div className="text-lg font-extrabold text-slate-900">{Math.floor(toNonNegativeNumber(selectedPlan?.daily_limit, 0))}</div>
                    </div>
                    <div className="rounded-xl border bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Weekly Leads</div>
                      <div className="text-lg font-extrabold text-slate-900">{Math.floor(toNonNegativeNumber(selectedPlan?.weekly_limit, 0))}</div>
                    </div>
                    <div className="rounded-xl border bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">States</div>
                      <div className="text-lg font-extrabold text-slate-900">{selectedCoverage.states}</div>
                    </div>
                    <div className="rounded-xl border bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Cities</div>
                      <div className="text-lg font-extrabold text-slate-900">{selectedCoverage.cities}</div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-slate-700">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Ranking: {getRankingText(selectedPlan) || '-'}</span>
                    </div>

                    {selectedTopSlots > 0 ? (
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>Top Level (City/Services): {selectedTopSlots}</span>
                      </div>
                    ) : null}

                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>
                        Yearly Leads:{' '}
                        {Math.floor(
                          Math.max(
                            0,
                            toNonNegativeNumber(selectedPlan?.yearly_limit, 0) ||
                              toNonNegativeNumber(selectedPlan?.weekly_limit, 0) * 52
                          )
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl border bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      Premium look and better visibility
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      Higher plans get better placement and stronger profile trust to improve conversions.
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Pricing;
