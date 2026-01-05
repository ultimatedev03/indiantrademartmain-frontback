// ✅ File: src/modules/vendor/pages/Leads.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { leadApi } from '@/modules/lead/services/leadApi';
import { vendorApi } from '@/modules/vendor/services/vendorApi';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  MapPin,
  Calendar,
  Search,
  Phone,
  Mail,
  Lock,
  ShoppingCart,
  Filter,
  X,
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { phoneUtils } from '@/shared/utils/phoneUtils';
import LeadStatsPanel from '@/modules/vendor/components/LeadStatsPanel';

const safeDate = (v) => {
  try {
    const d = v ? new Date(v) : null;
    return d && !Number.isNaN(d.getTime()) ? d : null;
  } catch {
    return null;
  }
};

const parseLocation = (lead) => {
  // Prefer explicit fields
  const city = (lead?.city || '').toString().trim();
  const state = (lead?.state || lead?.state_name || '').toString().trim();
  if (city || state) return { city, state };

  // Fallback to "City, State" from lead.location
  const raw = (lead?.location || '').toString();
  const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length >= 2) return { city: parts[0], state: parts.slice(1).join(', ') };
  if (parts.length === 1) return { city: parts[0], state: '' };
  return { city: '', state: '' };
};

const getLeadMeta = (lead) => {
  const title =
    lead?.title ||
    lead?.product_name ||
    lead?.service_name ||
    lead?.requirement_title ||
    'Untitled Lead';

  const { city, state } = parseLocation(lead);
  const location =
    (lead?.location || '').toString().trim() ||
    [city, state].filter(Boolean).join(', ') ||
    'India';

  const category =
    lead?.category ||
    lead?.category_name ||
    lead?.categoryTitle ||
    lead?.head_category ||
    '';

  const product =
    lead?.product ||
    lead?.product_name ||
    lead?.service_name ||
    lead?.service ||
    lead?.sub_category ||
    '';

  const createdAt =
    safeDate(lead?.created_at) ||
    safeDate(lead?.createdAt) ||
    safeDate(lead?.date) ||
    null;

  const isRecommended =
    lead?.is_recommended === true ||
    lead?.recommended === true ||
    lead?.isRecommended === true;

  return { title, location, city, state, category, product, createdAt, isRecommended };
};

const topNFromCountMap = (map, n = 8) =>
  [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label, count]) => ({ label, count }));

const anySelected = (obj) => Object.values(obj || {}).some(Boolean);
const selectedKeys = (obj) => Object.keys(obj || {}).filter(k => obj[k]);

const Leads = () => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('marketplace');
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  // Marketplace search + filters
  const [searchTerm, setSearchTerm] = useState('');
  const [marketFilters, setMarketFilters] = useState({
    recommendedOnly: false,
    indiaOnly: true,
    cities: {},
    states: {},
    categories: {},
    products: {},
    sort: 'recent', // recent | relevant
  });

  // ✅ My Leads filters (only required)
  const [myFilters, setMyFilters] = useState({
    fromDate: '',      // yyyy-mm-dd
    toDate: '',        // yyyy-mm-dd
    categories: {},    // { [category]: true }
    locations: {},     // { [location]: true }
    source: 'all',     // all | purchased | direct
    sort: 'recent_bought', // only one for now
  });

  const [stats, setStats] = useState(null);
  const [purchasing, setPurchasing] = useState({});

  useEffect(() => {
    loadLeads();
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const loadStats = async () => {
    try {
      // Get stats from vendor API which has the stats calculation
      const data = await vendorApi.dashboard.getStats();
      setStats({
        totalPurchased: 0, // Calculate from lead purchases
        totalContacted: 0, // Calculate from lead contacts
        converted: 0, // Calculate from converted leads
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  // ✅ IMPORTANT: Marketplace => hide leads that current vendor already purchased
  const loadLeads = async () => {
    setLoading(true);
    try {
      if (activeTab === 'my_leads') {
        // Fetch purchased + direct leads from new marketplace API
        const myLeads = await leadApi.marketplace.getMyLeads();
        
        // Apply source filter
        let filtered = myLeads || [];
        if (myFilters.source === 'purchased') {
          filtered = filtered.filter(l => l.source === 'Purchased');
        } else if (myFilters.source === 'direct') {
          filtered = filtered.filter(l => l.source === 'Direct');
        }
        
        setLeads(filtered);
        return;
      }

      // Marketplace load - only true marketplace leads (vendor_id is null)
      const available = await leadApi.marketplace.listAvailable();
      setLeads(available);
    } catch (error) {
      console.error(error);
      toast({ title: "Failed to load leads", variant: "destructive" });
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseLead = async (leadId) => {
    setPurchasing(prev => ({ ...prev, [leadId]: true }));
    try {
      // Get the lead and purchase it using marketplace API
      const lead = leads.find(l => l.id === leadId);
      if (!lead) throw new Error('Lead not found');

      // Use leadsMarketplaceApi.purchaseLead which handles RLS properly
      const { leadsMarketplaceApi } = await import('@/modules/vendor/services/leadsMarketplaceApi');
      await leadsMarketplaceApi.purchaseLead(leadId);

      toast({ title: "Lead purchased successfully!" });

      // ✅ instant hide from marketplace (no flicker)
      setLeads(prev => (prev || []).filter(l => l?.id !== leadId));

      await loadStats();
      // My leads will auto refresh when user switches tab
    } catch (error) {
      toast({
        title: "Failed to purchase lead",
        description: error?.message || "Something went wrong",
        variant: "destructive"
      });
    } finally {
      setPurchasing(prev => ({ ...prev, [leadId]: false }));
    }
  };

  // ✅ Normalize rows: marketplace => lead itself, my_leads => row.leads wrapped
  const normalizedLeads = useMemo(() => {
    return (leads || []).map((row) => {
      const leadObj = row?.leads || row;
      const purchaseDate = row?.purchase_date || row?.purchaseDate || row?.purchased_at || null;
      return { __raw: row, __lead: leadObj, __purchaseDate: purchaseDate };
    });
  }, [leads]);

  // Marketplace facets (same as before)
  const marketFacets = useMemo(() => {
    const cityCount = new Map();
    const stateCount = new Map();
    const categoryCount = new Map();
    const productCount = new Map();

    normalizedLeads.forEach(({ __lead }) => {
      const m = getLeadMeta(__lead);
      if (m.city) cityCount.set(m.city, (cityCount.get(m.city) || 0) + 1);
      if (m.state) stateCount.set(m.state, (stateCount.get(m.state) || 0) + 1);
      if (m.category) categoryCount.set(m.category, (categoryCount.get(m.category) || 0) + 1);
      if (m.product) productCount.set(m.product, (productCount.get(m.product) || 0) + 1);
    });

    return {
      topCities: topNFromCountMap(cityCount, 6),
      topStates: topNFromCountMap(stateCount, 6),
      topCategories: topNFromCountMap(categoryCount, 6),
      topProducts: topNFromCountMap(productCount, 6),
    };
  }, [normalizedLeads]);

  // ✅ My Leads facets (only Category + Location)
  const myFacets = useMemo(() => {
    const categoryCount = new Map();
    const locationCount = new Map();

    normalizedLeads.forEach(({ __lead }) => {
      const m = getLeadMeta(__lead);
      if (m.category) categoryCount.set(m.category, (categoryCount.get(m.category) || 0) + 1);
      if (m.location) locationCount.set(m.location, (locationCount.get(m.location) || 0) + 1);
    });

    return {
      topCategories: topNFromCountMap(categoryCount, 10),
      topLocations: topNFromCountMap(locationCount, 10),
    };
  }, [normalizedLeads]);

  const toggleKey = (setter, group, key) => {
    setter(prev => ({
      ...prev,
      [group]: {
        ...(prev[group] || {}),
        [key]: !prev?.[group]?.[key],
      }
    }));
  };

  const clearMarketFilters = () => {
    setMarketFilters({
      recommendedOnly: false,
      indiaOnly: true,
      cities: {},
      states: {},
      categories: {},
      products: {},
      sort: 'recent',
    });
    setSearchTerm('');
  };

  const clearMyFilters = () => {
    setMyFilters({
      fromDate: '',
      toDate: '',
      categories: {},
      locations: {},
      source: 'all',
      sort: 'recent_bought',
    });
  };

  // ✅ Marketplace filtered list
  const filteredMarketplaceLeads = useMemo(() => {
    const term = (searchTerm || '').toLowerCase().trim();

    const selectedCities = selectedKeys(marketFilters.cities);
    const selectedStates = selectedKeys(marketFilters.states);
    const selectedCategories = selectedKeys(marketFilters.categories);
    const selectedProducts = selectedKeys(marketFilters.products);

    const hasCityFilter = selectedCities.length > 0;
    const hasStateFilter = selectedStates.length > 0;
    const hasCategoryFilter = selectedCategories.length > 0;
    const hasProductFilter = selectedProducts.length > 0;

    let rows = normalizedLeads.filter(({ __lead }) => {
      const m = getLeadMeta(__lead);

      if (term) {
        const hay = [m.title, m.location, m.city, m.state, m.category, m.product]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(term)) return false;
      }

      if (marketFilters.recommendedOnly && !m.isRecommended) return false;

      if (hasCityFilter && !selectedCities.includes(m.city)) return false;
      if (hasStateFilter && !selectedStates.includes(m.state)) return false;
      if (hasCategoryFilter && !selectedCategories.includes(m.category)) return false;
      if (hasProductFilter && !selectedProducts.includes(m.product)) return false;

      return true;
    });

    rows = rows.sort((a, b) => {
      const aMeta = getLeadMeta(a.__lead);
      const bMeta = getLeadMeta(b.__lead);

      const aT = aMeta.createdAt?.getTime?.() || 0;
      const bT = bMeta.createdAt?.getTime?.() || 0;

      if (marketFilters.sort === 'relevant') {
        const ar = aMeta.isRecommended ? 1 : 0;
        const br = bMeta.isRecommended ? 1 : 0;
        if (br !== ar) return br - ar;
        return bT - aT;
      }

      return bT - aT; // recent
    });

    return rows;
  }, [normalizedLeads, searchTerm, marketFilters]);

  // ✅ My Leads filtered list (date wise + category + location + recent bought)
  const filteredMyLeads = useMemo(() => {
    const selectedCategories = selectedKeys(myFilters.categories);
    const selectedLocations = selectedKeys(myFilters.locations);

    const hasCategoryFilter = selectedCategories.length > 0;
    const hasLocationFilter = selectedLocations.length > 0;

    const from = myFilters.fromDate ? new Date(`${myFilters.fromDate}T00:00:00`) : null;
    const to = myFilters.toDate ? new Date(`${myFilters.toDate}T23:59:59`) : null;

    let rows = normalizedLeads.filter(({ __lead, __purchaseDate }) => {
      const m = getLeadMeta(__lead);
      const pDate = safeDate(__purchaseDate);

      // date wise (purchase date)
      if (from && (!pDate || pDate < from)) return false;
      if (to && (!pDate || pDate > to)) return false;

      if (hasCategoryFilter && !selectedCategories.includes(m.category)) return false;
      if (hasLocationFilter && !selectedLocations.includes(m.location)) return false;

      return true;
    });

    // recent bought leads (purchase_date desc)
    rows = rows.sort((a, b) => {
      const aP = safeDate(a.__purchaseDate)?.getTime?.() || 0;
      const bP = safeDate(b.__purchaseDate)?.getTime?.() || 0;
      return bP - aP;
    });

    return rows;
  }, [normalizedLeads, myFilters]);

  const marketAppliedCount =
    (marketFilters.recommendedOnly ? 1 : 0) +
    (anySelected(marketFilters.cities) ? 1 : 0) +
    (anySelected(marketFilters.states) ? 1 : 0) +
    (anySelected(marketFilters.categories) ? 1 : 0) +
    (anySelected(marketFilters.products) ? 1 : 0) +
    (marketFilters.sort !== 'recent' ? 1 : 0) +
    (searchTerm?.trim() ? 1 : 0);

  const myAppliedCount =
    (myFilters.fromDate ? 1 : 0) +
    (myFilters.toDate ? 1 : 0) +
    (anySelected(myFilters.categories) ? 1 : 0) +
    (anySelected(myFilters.locations) ? 1 : 0);

  const handleViewDetails = (leadId) => {
    if (!leadId) return;
    navigate(`/vendor/leads/${leadId}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Buy Leads</h1>
          <p className="text-gray-500">Access verified buyer requirements</p>
        </div>

        {stats && (
          <div className="flex gap-6 text-sm">
            <div className="text-center">
              <p className="text-gray-500">Purchased</p>
              <p className="text-lg font-bold text-[#003D82]">{stats.totalPurchased}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-500">Contacted</p>
              <p className="text-lg font-bold text-[#003D82]">{stats.totalContacted}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-500">Converted</p>
              <p className="text-lg font-bold text-green-600">{stats.converted}</p>
            </div>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
          <TabsTrigger value="my_leads">My Leads</TabsTrigger>
        </TabsList>

        {/* ✅ FILTER BAR: Marketplace vs My Leads different */}
        <Card className="mt-4 border bg-white">
          <CardContent className="p-4">
            {activeTab === 'marketplace' ? (
              <div className="flex flex-col lg:flex-row gap-4 lg:items-start">
                {/* Search (Marketplace only) */}
                <div className="relative w-full lg:max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search product / location..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="grid w-full grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {/* Location */}
                  <div className="rounded-md border bg-gray-50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-sm text-gray-800">Location</div>
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Filter className="h-3.5 w-3.5" />
                        {(anySelected(marketFilters.cities) || anySelected(marketFilters.states)) ? (
                          <span className="font-medium text-gray-800">
                            {selectedKeys(marketFilters.cities).length + selectedKeys(marketFilters.states).length} selected
                          </span>
                        ) : (
                          <span>All</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 mb-2">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={marketFilters.recommendedOnly}
                          onChange={() => setMarketFilters(p => ({ ...p, recommendedOnly: !p.recommendedOnly }))}
                        />
                        <span>Recommended</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={marketFilters.indiaOnly}
                          onChange={() => setMarketFilters(p => ({ ...p, indiaOnly: !p.indiaOnly }))}
                        />
                        <span>India</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {(marketFacets.topCities || []).map(({ label, count }) => (
                        <label key={label} className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!marketFilters.cities[label]}
                            onChange={() => toggleKey(setMarketFilters, 'cities', label)}
                          />
                          <span className="truncate">{label}</span>
                          <span className="ml-auto text-[11px] text-gray-500">{count}</span>
                        </label>
                      ))}
                    </div>

                    {!!marketFacets.topStates?.length && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="text-[11px] font-semibold text-gray-600 mb-2">Nearby / States</div>
                        <div className="grid grid-cols-2 gap-2">
                          {(marketFacets.topStates || []).map(({ label, count }) => (
                            <label key={label} className="flex items-center gap-2 text-xs cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!marketFilters.states[label]}
                                onChange={() => toggleKey(setMarketFilters, 'states', label)}
                              />
                              <span className="truncate">{label}</span>
                              <span className="ml-auto text-[11px] text-gray-500">{count}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Categories / Products */}
                  <div className="rounded-md border bg-gray-50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-sm text-gray-800">Categories / Product</div>
                      <div className="text-xs text-gray-600">
                        {(anySelected(marketFilters.categories) || anySelected(marketFilters.products)) ? (
                          <span className="font-medium text-gray-800">
                            {selectedKeys(marketFilters.categories).length + selectedKeys(marketFilters.products).length} selected
                          </span>
                        ) : (
                          <span>All</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {(marketFacets.topProducts || []).map(({ label, count }) => (
                        <label key={label} className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!marketFilters.products[label]}
                            onChange={() => toggleKey(setMarketFilters, 'products', label)}
                          />
                          <span className="truncate">{label}</span>
                          <span className="ml-auto text-[11px] text-gray-500">{count}</span>
                        </label>
                      ))}
                    </div>

                    {!!marketFacets.topCategories?.length && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="text-[11px] font-semibold text-gray-600 mb-2">Categories</div>
                        <div className="grid grid-cols-2 gap-2">
                          {(marketFacets.topCategories || []).map(({ label, count }) => (
                            <label key={label} className="flex items-center gap-2 text-xs cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!marketFilters.categories[label]}
                                onChange={() => toggleKey(setMarketFilters, 'categories', label)}
                              />
                              <span className="truncate">{label}</span>
                              <span className="ml-auto text-[11px] text-gray-500">{count}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sort + Clear */}
                  <div className="rounded-md border bg-gray-50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-sm text-gray-800">Sort</div>
                      {marketAppliedCount > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {marketAppliedCount} filter{marketAppliedCount > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="radio"
                          name="sort"
                          checked={marketFilters.sort === 'relevant'}
                          onChange={() => setMarketFilters(p => ({ ...p, sort: 'relevant' }))}
                        />
                        <span>Relevant (Recommended first)</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="radio"
                          name="sort"
                          checked={marketFilters.sort === 'recent'}
                          onChange={() => setMarketFilters(p => ({ ...p, sort: 'recent' }))}
                        />
                        <span>Recent</span>
                      </label>

                      <div className="pt-2 mt-2 border-t flex gap-2">
                        <Button variant="outline" className="w-full" onClick={clearMarketFilters}>
                          <X className="h-4 w-4 mr-2" />
                          Clear
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // ✅ MY LEADS FILTER BAR (with source filter)
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* Source Filter */}
                <div className="rounded-md border bg-gray-50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-sm text-gray-800">Source</div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="source"
                        checked={myFilters.source === 'all'}
                        onChange={() => setMyFilters(p => ({ ...p, source: 'all' }))}
                      />
                      <span>All</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="source"
                        checked={myFilters.source === 'purchased'}
                        onChange={() => setMyFilters(p => ({ ...p, source: 'purchased' }))}
                      />
                      <span>Purchased</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="source"
                        checked={myFilters.source === 'direct'}
                        onChange={() => setMyFilters(p => ({ ...p, source: 'direct' }))}
                      />
                      <span>Direct Leads</span>
                    </label>
                  </div>
                </div>

                {/* Date wise */}
                <div className="rounded-md border bg-gray-50 p-3">
                  <div className="font-semibold text-sm text-gray-800 mb-2">Date wise</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[11px] text-gray-600 mb-1">From</div>
                      <Input
                        type="date"
                        value={myFilters.fromDate}
                        onChange={(e) => setMyFilters(p => ({ ...p, fromDate: e.target.value }))}
                      />
                    </div>
                    <div>
                      <div className="text-[11px] text-gray-600 mb-1">To</div>
                      <Input
                        type="date"
                        value={myFilters.toDate}
                        onChange={(e) => setMyFilters(p => ({ ...p, toDate: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Category */}
                <div className="rounded-md border bg-gray-50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-sm text-gray-800">Category</div>
                    <div className="text-xs text-gray-600">
                      {anySelected(myFilters.categories) ? `${selectedKeys(myFilters.categories).length} selected` : 'All'}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {(myFacets.topCategories || []).map(({ label, count }) => (
                      <label key={label} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!myFilters.categories[label]}
                          onChange={() => toggleKey(setMyFilters, 'categories', label)}
                        />
                        <span className="truncate">{label}</span>
                        <span className="ml-auto text-[11px] text-gray-500">{count}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Location */}
                <div className="rounded-md border bg-gray-50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-sm text-gray-800">Location</div>
                    <div className="text-xs text-gray-600">
                      {anySelected(myFilters.locations) ? `${selectedKeys(myFilters.locations).length} selected` : 'All'}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {(myFacets.topLocations || []).map(({ label, count }) => (
                      <label key={label} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!myFilters.locations[label]}
                          onChange={() => toggleKey(setMyFilters, 'locations', label)}
                        />
                        <span className="truncate">{label}</span>
                        <span className="ml-auto text-[11px] text-gray-500">{count}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Sort + Clear */}
                <div className="rounded-md border bg-gray-50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-sm text-gray-800">Recent Bought Leads</div>
                    {myAppliedCount > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {myAppliedCount} filter{myAppliedCount > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>

                  <div className="text-xs text-gray-600 mb-3">
                    Sorted by latest purchase date
                  </div>

                  <Button variant="outline" className="w-full" onClick={clearMyFilters}>
                    <X className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Marketplace */}
        <TabsContent value="marketplace" className="space-y-4">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : filteredMarketplaceLeads.length === 0 ? (
            <div className="p-8 text-center border rounded bg-white">No new leads available</div>
          ) : (
            filteredMarketplaceLeads.map(({ __lead }) => (
              <LeadCard
                key={__lead.id}
                lead={__lead}
                purchased={false}
                onBuy={handlePurchaseLead}
                isPurchasing={purchasing[__lead.id]}
                onView={handleViewDetails}
              />
            ))
          )}
        </TabsContent>

        {/* My Leads */}
        <TabsContent value="my_leads" className="">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main content */}
            <div className="lg:col-span-2 space-y-4">
              {loading ? (
                <div className="p-8 text-center text-gray-500">Loading...</div>
              ) : filteredMyLeads.length === 0 ? (
                <div className="p-8 text-center border rounded bg-white">You haven't purchased any leads yet.</div>
              ) : (
                filteredMyLeads.map(({ __raw, __lead, __purchaseDate }) => (
                  <LeadCard
                    key={__raw?.id || __lead?.id}
                    lead={__lead}
                    source={__raw?.source || 'Purchased'}
                    purchaseDate={__purchaseDate}
                    onView={handleViewDetails}
                  />
                ))
              )}
            </div>
            
            {/* Right sidebar - Stats Panel */}
            <div className="lg:col-span-1">
              <LeadStatsPanel stats={stats} loading={loading} />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const LeadCard = ({ lead, purchased, source, onBuy, isPurchasing, purchaseDate, onView }) => {
  const meta = getLeadMeta(lead);

  const displayTitle = meta.title;
  const displayLocation = meta.location;

  const isPurchased = purchased || source === 'Purchased';
  const isDirect = source === 'Direct';

  const dateObj = safeDate(isPurchased || isDirect ? purchaseDate : (lead?.created_at || lead?.createdAt)) || meta.createdAt;
  const displayDate = dateObj ? dateObj.toLocaleDateString() : '—';

  const maskPhone = (phone) => phone ? phoneUtils.maskPhoneWithCode(phone) : 'N/A';

  return (
    <Card
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onView?.(lead?.id)}
    >
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold text-lg text-[#003D82] truncate">{displayTitle}</h3>
                <div className="mt-1 flex flex-wrap gap-2">
                  {meta.product ? <Badge variant="outline" className="text-xs">{meta.product}</Badge> : null}
                  {meta.category ? <Badge variant="outline" className="text-xs">{meta.category}</Badge> : null}
                  {meta.isRecommended && !isPurchased && !isDirect ? (
                    <Badge className="text-xs bg-[#fff3c4] text-[#7a5b00] hover:bg-[#ffeaa0] border border-[#ffe08a]">
                      Recommended
                    </Badge>
                  ) : null}
                </div>
              </div>

              <Badge variant={isPurchased || isDirect ? 'success' : 'outline'}>
                {isDirect ? 'Direct Lead' : isPurchased ? 'Purchased' : 'Fresh Lead'}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {displayLocation}</div>
              <div className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {displayDate}</div>
              {lead?.quantity && (
                <div className="font-medium">
                  Qty: {lead.quantity} {lead.unit || 'units'}
                </div>
              )}
              {lead?.budget && (
                <div className="font-medium">
                  Budget: ₹{lead.budget?.toLocaleString?.() || lead.budget}
                </div>
              )}
            </div>

            {isPurchased || isDirect || (lead?.buyer_name && lead?.buyer_email) ? (
              <div className="mt-4 p-3 bg-green-50 border border-green-100 rounded-md space-y-1">
                <p className="text-sm font-semibold text-green-800">Buyer Details:</p>
                <div className="flex flex-wrap gap-4 text-sm text-green-700">
                  <span className="font-medium">{lead?.buyer_name || 'N/A'}</span>
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {maskPhone(lead?.buyer_phone)}</span>
                  {lead?.buyer_email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {lead.buyer_email}</span>}
                </div>
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-2 text-sm text-gray-500 bg-gray-50 p-2 rounded w-fit">
                <Lock className="h-3 w-3" /> Buyer details locked
              </div>
            )}
          </div>

          <div className="flex flex-col justify-center items-end gap-2 min-w-[160px]">
            {!isPurchased && !isDirect && (
              <>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Price</p>
                  <p className="text-xl font-bold text-gray-900">₹50</p>
                </div>

                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onBuy?.(lead.id);
                  }}
                  disabled={isPurchasing}
                  className="w-full bg-[#00A699] hover:bg-[#00857A]"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" /> {isPurchasing ? 'Buying...' : 'Buy Now'}
                </Button>
              </>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                onView?.(lead?.id);
              }}
            >
              View Details
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default Leads;
