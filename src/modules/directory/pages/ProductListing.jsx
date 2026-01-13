import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Home, ChevronRight, Loader2 } from 'lucide-react';

import DirectorySearchBar from '@/modules/directory/components/DirectorySearchBar';
import SearchFilters from '@/modules/directory/components/SearchFilters';
import SearchResultsList from '@/modules/directory/components/SearchResultsList';

import { directoryApi } from '@/modules/directory/api/directoryApi';
import { supabase } from '@/lib/customSupabaseClient';

const safeStr = (v) => (typeof v === 'string' ? v.trim() : '');

const stripHtml = (s) => safeStr(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const truncate = (s, n = 160) => {
  const t = stripHtml(s);
  if (!t) return '';
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1).trim()}…`;
};

const toTitleCase = (slug) =>
  safeStr(slug)
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const numOrNull = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/[₹,\s]/g, '').trim());
  return Number.isFinite(n) ? n : null;
};

/**
 * ✅ Category micro listing page
 * URL supports:
 *  - /directory/:headSlug/:subSlug/:microSlug
 *  - /directory/:headSlug/:subSlug/:microSlug/:stateSlug
 *  - /directory/:headSlug/:subSlug/:microSlug/:stateSlug/:citySlug
 *
 * Requirement:
 *  - same UI as "SearchResults" cards (image, rating, price/unit)
 *  - if URL contains state/city => auto-filter results
 */
const ProductListing = () => {
  const { headSlug, subSlug, microSlug, stateSlug = '', citySlug = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const [microInfo, setMicroInfo] = useState(null);
  const [seoLoading, setSeoLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState([]);

  // UI filters
  const [filters, setFilters] = useState({
    priceRange: [0, 100000],
    rating: 0,
    verified: false,
    inStock: false,
  });

  // Search query inside category
  const [q, setQ] = useState(searchParams.get('q') || '');

  // cache ids for location slugs
  const resolvedRef = useRef({ key: '', stateId: null, cityId: null });

  const microTitle = useMemo(() => microInfo?.name || toTitleCase(microSlug), [microInfo, microSlug]);

  // ✅ SEO info (meta tags/description)
  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (!microSlug) return;
      setSeoLoading(true);
      try {
        const m = await directoryApi.getMicroCategoryBySlug(microSlug);
        if (!alive) return;
        setMicroInfo(m || null);
      } catch (e) {
        if (!alive) return;
        setMicroInfo(null);
      } finally {
        if (!alive) return;
        setSeoLoading(false);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [microSlug]);

  const pageTitle = useMemo(() => {
    const metaTitle = safeStr(microInfo?.meta_tags);
    if (metaTitle) return metaTitle;
    const h = microInfo?.sub_categories?.head_categories?.name || toTitleCase(headSlug);
    const s = microInfo?.sub_categories?.name || toTitleCase(subSlug);
    const m = microInfo?.name || toTitleCase(microSlug);
    return `${m} | ${s} - ${h} Suppliers & Products | IndianTradeMart`;
  }, [microInfo, headSlug, subSlug, microSlug]);

  const pageDescription = useMemo(() => {
    const metaDesc = safeStr(microInfo?.meta_description);
    if (metaDesc) return truncate(metaDesc);
    const m = microInfo?.name || toTitleCase(microSlug);
    return truncate(`Browse ${m} products and verified suppliers in India. Compare prices, view details, and get quotations on IndianTradeMart.`);
  }, [microInfo, microSlug]);

  const canonicalUrl = useMemo(() => {
    try {
      const origin = window.location?.origin || '';
      if (!origin) return '';
      let u = `${origin}/directory/${headSlug}/${subSlug}/${microSlug}`;
      if (stateSlug) u += `/${stateSlug}`;
      if (citySlug) u += `/${citySlug}`;
      return u;
    } catch {
      return '';
    }
  }, [headSlug, subSlug, microSlug, stateSlug, citySlug]);

  const updateUrlParams = (updates) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([k, v]) => {
      if (v === null || v === undefined || v === '') next.delete(k);
      else next.set(k, String(v));
    });
    setSearchParams(next);
  };

  // ✅ Resolve stateSlug/citySlug -> ids
  const resolveLocationIds = async () => {
    const key = `${stateSlug || ''}::${citySlug || ''}`;
    if (resolvedRef.current.key === key) return resolvedRef.current;

    let stateId = null;
    let cityId = null;

    try {
      if (stateSlug) {
        const { data: st } = await supabase
          .from('states')
          .select('id')
          .eq('slug', stateSlug)
          .maybeSingle();
        stateId = st?.id || null;
      }

      if (citySlug) {
        // try match city within state first
        if (stateId) {
          const { data: ct } = await supabase
            .from('cities')
            .select('id')
            .eq('slug', citySlug)
            .eq('state_id', stateId)
            .maybeSingle();
          cityId = ct?.id || null;
        }

        // fallback: city by slug only
        if (!cityId) {
          const { data: ct2 } = await supabase
            .from('cities')
            .select('id, state_id')
            .eq('slug', citySlug)
            .maybeSingle();
          cityId = ct2?.id || null;
          if (!stateId) stateId = ct2?.state_id || null;
        }
      }
    } catch {
      // ignore
    }

    resolvedRef.current = { key, stateId, cityId };
    return resolvedRef.current;
  };

  // ✅ Fetch products (micro + optional state/city)
  useEffect(() => {
    let alive = true;

    const fetchData = async () => {
      setLoading(true);
      try {
        const { stateId, cityId } = await resolveLocationIds();

        // base query: micro + vendor join + location filter by vendor state/city
        const { data } = await directoryApi.getProductsByMicroAndLocation({
          microSlug,
          stateId,
          cityId,
          page: 1,
          limit: 200,
        });

        if (!alive) return;

        // flatten vendor fields so SearchResultsList renders like marketplace cards
        const flat = (data || []).map((p) => {
          const v = p?.vendors || {};
          return {
            ...p,
            vendorName: v?.company_name || p?.vendorName,
            vendorCity: v?.city || p?.vendorCity,
            vendorState: v?.state || p?.vendorState,
            vendorRating: v?.seller_rating || p?.vendorRating,
            vendorVerified: !!(v?.verification_badge || v?.is_verified || String(v?.kyc_status || '').toUpperCase() === 'APPROVED'),
            seller_rating: v?.seller_rating,
            verification_badge: v?.verification_badge,
            // keep units for price display
            price_unit: p?.price_unit,
            qty_unit: p?.qty_unit,
          };
        });

        setResults(flat);
      } catch (e) {
        console.error('ProductListing fetch error:', e);
        if (!alive) return;
        setResults([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };

    fetchData();
    return () => {
      alive = false;
    };
  }, [microSlug, stateSlug, citySlug]);

  // ✅ Apply filters client-side (fast + reliable)
  const filtered = useMemo(() => {
    const list = Array.isArray(results) ? results : [];

    // q
    const query = safeStr(q).toLowerCase();
    let out = list;
    if (query) {
      out = out.filter((p) => {
        const name = String(p?.name || '').toLowerCase();
        const desc = String(p?.description || '').toLowerCase();
        return name.includes(query) || desc.includes(query);
      });
    }

    // price range
    const [minP, maxP] = filters.priceRange || [0, 100000];
    out = out.filter((p) => {
      const price = numOrNull(p?.price);
      if (price === null) return true; // keep "price on request"
      return price >= minP && price <= maxP;
    });

    // rating
    if (filters.rating > 0) {
      out = out.filter((p) => {
        const r = numOrNull(p?.rating) ?? numOrNull(p?.vendorRating) ?? 0;
        return r >= filters.rating;
      });
    }

    // verified
    if (filters.verified) {
      out = out.filter((p) => !!p?.vendorVerified);
    }

    // in stock
    if (filters.inStock) {
      out = out.filter((p) => {
        const stock = numOrNull(p?.stock);
        return stock === null ? true : stock > 0;
      });
    }

    return out;
  }, [results, q, filters]);

  const locationLabel = useMemo(() => {
    if (citySlug) return toTitleCase(citySlug);
    if (stateSlug) return toTitleCase(stateSlug);
    return 'All India';
  }, [stateSlug, citySlug]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        {canonicalUrl ? <link rel="canonical" href={canonicalUrl} /> : null}
      </Helmet>

      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          {/* Breadcrumb */}
          <nav className="flex text-sm text-gray-500 mb-4 items-center flex-wrap">
            <Link to="/directory" className="hover:text-blue-700 flex items-center">
              <Home className="w-3 h-3 mr-1" /> Directory
            </Link>
            <ChevronRight className="w-4 h-4 mx-2" />
            <Link to={`/directory/${headSlug}`} className="hover:text-blue-700 capitalize">
              {toTitleCase(headSlug)}
            </Link>
            <ChevronRight className="w-4 h-4 mx-2" />
            <Link to={`/directory/${headSlug}/${subSlug}`} className="hover:text-blue-700 capitalize">
              {toTitleCase(subSlug)}
            </Link>
            <ChevronRight className="w-4 h-4 mx-2" />
            <span className="font-semibold text-gray-900 capitalize">{microTitle}</span>
          </nav>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 capitalize">{microTitle}</h1>
              <p className="mt-1 text-sm text-slate-600 max-w-3xl">
                {seoLoading
                  ? 'Loading description...'
                  : safeStr(microInfo?.meta_description) || 'Browse products and suppliers in this micro-category.'}
              </p>
            </div>

            <div className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{locationLabel}</span>
            </div>
          </div>

          {/* Main search bar (same UI as directory search) */}
          <div className="mt-5">
            <DirectorySearchBar
              initialService={microTitle}
              initialState={stateSlug}
              initialCity={citySlug}
              className="w-full"
              enableSuggestions
            />
          </div>

          {/* In-category search */}
          <div className="mt-4">
            <input
              value={q}
              placeholder="Search in this category..."
              onChange={(e) => {
                const v = e.target.value;
                setQ(v);
                updateUrlParams({ q: v });
              }}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#003D82]"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-14">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-3">
              <SearchFilters filters={filters} setFilters={setFilters} />
            </div>
            <div className="lg:col-span-9">
              <SearchResultsList products={filtered} query={microTitle} city={citySlug} category={microSlug} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductListing;
