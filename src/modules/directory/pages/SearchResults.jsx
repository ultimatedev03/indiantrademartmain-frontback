import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { useSearchParams, useParams, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import SearchFilters from '@/modules/directory/components/SearchFilters';
import SearchResultsList from '@/modules/directory/components/SearchResultsList';
import PillBreadcrumbs from '@/shared/components/PillBreadcrumbs';
import NearbyLocationNav from '@/modules/directory/components/NearbyLocationNav';
import DirectorySearchBar from '@/modules/directory/components/DirectorySearchBar';
import { urlParser } from '@/shared/utils/urlParser';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { locationService } from '@/shared/services/locationService';
import { toast } from '@/components/ui/use-toast';

const normalizeText = (t) =>
  String(t || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// light stemming
const stemWord = (w = '') => {
  const s = String(w || '');
  if (s.length <= 3) return s;
  if (s.endsWith('ies') && s.length > 4) return s.slice(0, -3) + 'y';
  if (s.endsWith('es') && s.length > 3) return s.slice(0, -2);
  if (s.endsWith('s') && s.length > 3) return s.slice(0, -1);
  return s;
};

const normalizeForFuzzy = (t) =>
  normalizeText(t)
    .split(' ')
    .filter(Boolean)
    .map(stemWord)
    .join(' ');

const slugify = (text = '') =>
  String(text || '')
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const safeJsonParse = (s) => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

// ✅ Levenshtein distance
const levenshtein = (a = '', b = '') => {
  a = String(a);
  b = String(b);
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
};

const getTargetLocations = (raw) => {
  if (!raw) return { tl: null, rawStr: null };
  if (typeof raw === 'object') return { tl: raw, rawStr: null };
  if (typeof raw === 'string') {
    const parsed = safeJsonParse(raw);
    if (parsed && typeof parsed === 'object') return { tl: parsed, rawStr: null };
    return { tl: null, rawStr: raw };
  }
  return { tl: null, rawStr: null };
};

const productMatchesLocation = (product, stateId, cityId, stateCityIdSet) => {
  if (!stateId && !cityId) return true;

  const { tl, rawStr } = getTargetLocations(product?.target_locations);

  const vendorFallback = () => {
    const vState = product?.vendors?.state_id ? String(product.vendors.state_id) : '';
    const vCity = product?.vendors?.city_id ? String(product.vendors.city_id) : '';

    if (cityId) return vCity === String(cityId) || (stateId ? vState === String(stateId) : false);
    if (stateId) return vState === String(stateId);
    return false;
  };

  if (!tl && rawStr) {
    const s = rawStr.replace(/\s+/g, '').toLowerCase();
    const pan = s.includes('"pan_india":true') || s.includes('"panindia":true');
    if (pan) return true;

    if (cityId && rawStr.includes(String(cityId))) return true;
    if (stateId && rawStr.includes(String(stateId))) return true;

    return vendorFallback();
  }

  if (!tl) return vendorFallback();
  if (!!tl.pan_india) return true;

  const targetStateIds = (tl.states || []).map((x) => String(x?.id)).filter(Boolean);
  const targetCityIds = (tl.cities || []).map((x) => String(x?.id)).filter(Boolean);

  const hasTargets = targetStateIds.length > 0 || targetCityIds.length > 0;
  if (!hasTargets) return vendorFallback();

  if (cityId) {
    if (targetCityIds.includes(String(cityId))) return true;
    if (stateId && targetStateIds.includes(String(stateId))) return true;
    return false;
  }

  if (stateId) {
    if (targetStateIds.includes(String(stateId))) return true;

    if (stateCityIdSet && targetCityIds.length > 0) {
      for (const cid of targetCityIds) {
        if (stateCityIdSet.has(String(cid))) return true;
      }
    }
    return false;
  }

  return true;
};

const resolveCategoryContext = async (slug) => {
  const s = String(slug || '').trim();
  if (!s) return { type: 'text' };

  // micro
  {
    const { data } = await supabase.from('micro_categories').select('id, sub_category_id').eq('slug', s).maybeSingle();
    if (data?.id) return { type: 'micro', microId: data.id, subId: data.sub_category_id || null };
  }

  // sub
  {
    const { data } = await supabase.from('sub_categories').select('id, head_category_id').eq('slug', s).maybeSingle();
    if (data?.id) return { type: 'sub', subId: data.id, headId: data.head_category_id || null };
  }

  // head
  {
    const { data } = await supabase.from('head_categories').select('id').eq('slug', s).maybeSingle();
    if (data?.id) return { type: 'head', headId: data.id };
  }

  return { type: 'text' };
};

// ✅ helper: detect bad request (400) coming from invalid filter / missing column
const isBadRequest400 = (err) => {
  const status = err?.status ?? err?.code;
  const msg = String(err?.message || '').toLowerCase();
  return (
    status === 400 ||
    String(status) === '400' ||
    msg.includes('bad request') ||
    msg.includes('failed to parse') ||
    msg.includes('column') ||
    msg.includes('unknown') ||
    msg.includes('unexpected')
  );
};

const SearchResults = () => {
  const [searchParams] = useSearchParams();
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [parsedParams, setParsedParams] = useState({
    serviceSlug: '',
    stateSlug: '',
    citySlug: '',
  });

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    priceRange: [0, 100000],
    rating: 0,
    verified: false,
    inStock: false,
  });

  const autoCorrectedRef = useRef(false);

  const buildSearchUrl = (svc, st, ct) => {
    if (!svc) return '/directory';
    let u = `/directory/search/${svc}`;
    if (st) u += `/${st}`;
    if (ct) u += `/${ct}`;
    return u;
  };

  // Parse URL
  useEffect(() => {
    let service = '';
    let state = '';
    let city = '';

    if (params.service) {
      service = params.service;
      state = params.state || '';
      city = params.city || '';
    } else if (params.slug) {
      const parsed = urlParser.parseSeoSlug(params.slug);
      service = parsed?.serviceSlug || '';
      state = parsed?.stateSlug || '';
      city = parsed?.citySlug || '';
    }

    setParsedParams({
      serviceSlug: service || '',
      stateSlug: state || '',
      citySlug: city || '',
    });

    autoCorrectedRef.current = false;
  }, [params, location.pathname, location.search]);

  // ✅ Auto-correct (includes PRODUCTS table candidates)
  const tryAutoCorrect = async ({ wrongSlug, stateSlug, citySlug }) => {
    if (!wrongSlug) return null;
    if (autoCorrectedRef.current) return null;

    const wrongRaw = String(wrongSlug || '');
    const wrong = normalizeForFuzzy(wrongRaw);
    if (wrong.length < 4) return null;

    const tokens = normalizeText(wrongRaw.replace(/[^a-z0-9]+/g, ' '))
      .split(' ')
      .map((x) => x.trim())
      .filter((x) => x.length >= 3)
      .slice(0, 4);

    // candidate: { slug, name }
    const candidateMap = new Map();

    const addCandidate = (slug, name) => {
      if (!slug) return;
      const key = String(slug);
      if (!candidateMap.has(key)) candidateMap.set(key, { slug: key, name: name || slug });
    };

    const addRows = (rows = []) => {
      (rows || []).forEach((r) => {
        if (!r) return;
        addCandidate(r.slug, r.name);
      });
    };

    const fetchFromTable = async (table, tok) => {
      const { data, error } = await supabase
        .from(table)
        .select('id, name, slug')
        .or(`slug.ilike.%${tok}%,name.ilike.%${tok}%`)
        .limit(800);

      if (!error && Array.isArray(data)) addRows(data);
    };

    const fetchFromProducts = async (tok) => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, category, category_slug')
        .eq('status', 'ACTIVE')
        .or(`category_slug.ilike.%${tok}%,category.ilike.%${tok}%,name.ilike.%${tok}%`)
        .limit(900);

      if (error || !Array.isArray(data)) return;

      for (const p of data) {
        const s = p?.category_slug || slugify(p?.category) || '';
        const nm = p?.category || p?.category_slug || p?.name || s;
        if (s) addCandidate(s, nm);
      }
    };

    // 1) token based
    for (const tok of tokens) {
      await fetchFromTable('micro_categories', tok);
      await fetchFromTable('sub_categories', tok);
      await fetchFromTable('head_categories', tok);
      await fetchFromProducts(tok);
    }

    // 2) fallback
    if (candidateMap.size === 0) {
      const { data: microAll } = await supabase
        .from('micro_categories')
        .select('id, name, slug')
        .order('slug', { ascending: true })
        .limit(8000);
      addRows(microAll);

      const { data: subAll } = await supabase
        .from('sub_categories')
        .select('id, name, slug')
        .order('slug', { ascending: true })
        .limit(8000);
      addRows(subAll);

      const { data: headAll } = await supabase
        .from('head_categories')
        .select('id, name, slug')
        .order('slug', { ascending: true })
        .limit(8000);
      addRows(headAll);

      const { data: prodCats } = await supabase
        .from('products')
        .select('category, category_slug')
        .eq('status', 'ACTIVE')
        .limit(9000);

      (prodCats || []).forEach((p) => {
        const s = p?.category_slug || slugify(p?.category) || '';
        const nm = p?.category || p?.category_slug || s;
        if (s) addCandidate(s, nm);
      });
    }

    const candidates = Array.from(candidateMap.values());
    if (candidates.length === 0) return null;

    let best = null;
    let bestDist = Number.POSITIVE_INFINITY;

    for (const c of candidates) {
      const candSlug = normalizeForFuzzy(c.slug);
      const candName = normalizeForFuzzy(c.name);

      const d1 = candSlug ? levenshtein(wrong, candSlug) : Number.POSITIVE_INFINITY;
      const d2 = candName ? levenshtein(wrong, candName) : Number.POSITIVE_INFINITY;
      const d = Math.min(d1, d2);

      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
      if (bestDist === 0) break;
    }

    const allowed = Math.max(2, Math.min(6, Math.ceil(wrong.length * 0.3)));
    if (!best || bestDist > allowed) return null;

    if (String(best.slug) === String(wrongSlug)) return null;

    autoCorrectedRef.current = true;

    const correctedUrl = buildSearchUrl(best.slug, stateSlug, citySlug);
    navigate(correctedUrl, { replace: true });

    toast({
      title: 'Auto-corrected search',
      description: `Showing results for "${best.name}" (corrected from "${wrongRaw.replace(/-/g, ' ')}")`,
    });

    return best;
  };

  // ✅ keyword search with safe fallback (prevents 400 due to missing columns)
  const runKeywordProductsQueryWithFallback = async ({
    servicePhrase,
    serviceSlug,
    selectString,
  }) => {
    // attempts in decreasing “risk”
    const attempts = [
      // safest/common columns first
      [
        `category_slug.eq.${serviceSlug}`,
        `name.ilike.%${servicePhrase}%`,
        `category.ilike.%${servicePhrase}%`,
        `description.ilike.%${servicePhrase}%`,
      ],
      // fewer columns
      [`category_slug.eq.${serviceSlug}`, `name.ilike.%${servicePhrase}%`, `category.ilike.%${servicePhrase}%`],
      // name only
      [`category_slug.eq.${serviceSlug}`, `name.ilike.%${servicePhrase}%`],
      // category slug only
      [`category_slug.eq.${serviceSlug}`],
    ];

    let lastErr = null;

    for (const orParts of attempts) {
      const q = supabase
        .from('products')
        .select(selectString)
        .eq('status', 'ACTIVE')
        .or(orParts.join(','))
        .order('created_at', { ascending: false })
        .limit(300);

      const { data, error } = await q;
      if (!error) return data || [];

      lastErr = error;

      // if it's NOT a 400-type filter error, stop early
      if (!isBadRequest400(error)) throw error;
    }

    // all attempts failed
    if (lastErr) throw lastErr;
    return [];
  };

  // Fetch products
  useEffect(() => {
    const fetchResults = async () => {
      if (!parsedParams.serviceSlug) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const serviceSlug = parsedParams.serviceSlug;
        const servicePhrase = normalizeText(serviceSlug.replace(/-/g, ' '));

        const { state, city } = await locationService.getLocationBySlug(parsedParams.stateSlug, parsedParams.citySlug);
        const stateId = state?.id || null;
        const cityId = city?.id || null;

        let stateCityIdSet = null;
        if (stateId) {
          const allCities = await locationService.getCities(stateId);
          stateCityIdSet = new Set((allCities || []).map((c) => String(c.id)));
        }

        const ctx = await resolveCategoryContext(serviceSlug);

        // ✅ if slug is NOT a real category => try autocorrect first (fixes “land-servery”)
        if (ctx.type === 'text') {
          const corrected = await tryAutoCorrect({
            wrongSlug: serviceSlug,
            stateSlug: parsedParams.stateSlug,
            citySlug: parsedParams.citySlug,
          });
          if (corrected) {
            setResults([]);
            return; // redirect already happened
          }
        }

        const selectString = `
          *,
          vendors (
            id, company_name, city, state, state_id, city_id,
            seller_rating, kyc_status, verification_badge, trust_score
          )
        `;

        let data = [];

        if (ctx.type === 'micro' && ctx.microId) {
          const { data: d, error } = await supabase
            .from('products')
            .select(selectString)
            .eq('status', 'ACTIVE')
            .eq('micro_category_id', ctx.microId)
            .order('created_at', { ascending: false })
            .limit(300);
          if (error) throw error;
          data = d || [];
        } else if (ctx.type === 'sub' && ctx.subId) {
          const { data: d, error } = await supabase
            .from('products')
            .select(selectString)
            .eq('status', 'ACTIVE')
            .eq('sub_category_id', ctx.subId)
            .order('created_at', { ascending: false })
            .limit(300);
          if (error) throw error;
          data = d || [];
        } else if (ctx.type === 'head' && ctx.headId) {
          const { data: d, error } = await supabase
            .from('products')
            .select(selectString)
            .eq('status', 'ACTIVE')
            .eq('head_category_id', ctx.headId)
            .order('created_at', { ascending: false })
            .limit(300);
          if (error) throw error;
          data = d || [];
        } else {
          // keyword mode (safe fallback avoids 400)
          data = await runKeywordProductsQueryWithFallback({
            servicePhrase,
            serviceSlug,
            selectString,
          });
        }

        const mapped = (data || []).map((p) => ({
          ...p,
          vendorName: p.vendors?.company_name,
          vendorId: p.vendors?.id,
          vendorCity: p.vendors?.city,
          vendorState: p.vendors?.state,
          vendorRating: p.vendors?.seller_rating || 4.5,
          vendorVerified: p.vendors?.kyc_status === 'VERIFIED' || !!p.vendors?.verification_badge,
        }));

        const locationFiltered = mapped.filter((p) => productMatchesLocation(p, stateId, cityId, stateCityIdSet));

        // ✅ if no results -> try autocorrect (once)
        if (locationFiltered.length === 0) {
          await tryAutoCorrect({
            wrongSlug: serviceSlug,
            stateSlug: parsedParams.stateSlug,
            citySlug: parsedParams.citySlug,
          });
          setResults([]);
          return;
        }

        const sorted = locationFiltered
          .map((p) => {
            const nm = normalizeText(p?.name);
            const exact = nm === servicePhrase ? 1000 : 0;
            const contains = nm.includes(servicePhrase) ? 200 : 0;
            return { ...p, __sortScore: exact + contains };
          })
          .sort((a, b) => (b.__sortScore || 0) - (a.__sortScore || 0));

        setResults(sorted);
      } catch (err) {
        console.error('Search failed', err);

        // ✅ even if query throws (e.g. 400), try autocorrect once
        try {
          await tryAutoCorrect({
            wrongSlug: parsedParams.serviceSlug,
            stateSlug: parsedParams.stateSlug,
            citySlug: parsedParams.citySlug,
          });
        } catch (e) {
          // ignore autocorrect errors
        }

        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [parsedParams.serviceSlug, parsedParams.stateSlug, parsedParams.citySlug, searchParams]);

  const filteredResults = (results || []).filter((item) => {
    if (filters.verified && !item.vendorVerified) return false;
    if (filters.inStock && !item.inStock) return false;
    return true;
  });

  const formatName = (s) => (s ? s.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) : '');
  const serviceName = formatName(parsedParams.serviceSlug);
  const cityName = formatName(parsedParams.citySlug);
  const stateName = formatName(parsedParams.stateSlug);

  const pageTitle = serviceName
    ? `${serviceName} Suppliers & Manufacturers${cityName ? ` in ${cityName}` : ''}${stateName && !cityName ? ` in ${stateName}` : ''}`
    : 'Search Results';

  const canonicalPath =
    parsedParams.citySlug && parsedParams.stateSlug
      ? `/directory/${parsedParams.serviceSlug}-in-${parsedParams.citySlug}-${parsedParams.stateSlug}`
      : parsedParams.stateSlug
        ? `/directory/${parsedParams.serviceSlug}-in-${parsedParams.stateSlug}`
        : `/directory/${parsedParams.serviceSlug}`;

  const canonicalUrl = `https://www.indiantrademart.com${canonicalPath}`;

  return (
    <>
      <Helmet>
        <title>{pageTitle} | IndianTradeMart</title>
        <meta
          name="description"
          content={`Find best ${serviceName} suppliers in ${cityName || stateName || 'India'}. Get quotes, compare prices and buy from verified manufacturers.`}
        />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <div className="min-h-screen bg-neutral-50 pb-16">
        <div className="bg-white border-b sticky top-16 z-10 shadow-sm">
          <div className="container mx-auto px-4 py-2">
            <PillBreadcrumbs className="mb-2" overrideParams={parsedParams} />

            <div className="max-w-4xl mb-2">
              <DirectorySearchBar
                enableSuggestions
                className="shadow-sm"
                initialService={parsedParams.serviceSlug}
                initialState={parsedParams.stateSlug}
                initialCity={parsedParams.citySlug}
              />
            </div>

            <div className="flex items-start md:items-center justify-between gap-3">
              <motion.h1
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-base md:text-lg font-bold text-gray-900 leading-snug line-clamp-2"
              >
                {pageTitle}
              </motion.h1>

              <div className="flex-shrink-0 text-xs md:text-sm text-gray-500 pt-1 md:pt-0">
                {filteredResults.length} found
              </div>
            </div>

            {parsedParams.stateSlug && (
              <div className="mt-0 overflow-x-auto scrollbar-hide">
                <div className="min-w-max">
                  <NearbyLocationNav
                    serviceSlug={parsedParams.serviceSlug}
                    stateSlug={parsedParams.stateSlug}
                    currentCitySlug={parsedParams.citySlug}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="container mx-auto px-4 py-5">
          <div className="flex flex-col lg:flex-row gap-6">
            <aside className="w-full lg:w-64 flex-shrink-0 hidden lg:block">
              <SearchFilters filters={filters} setFilters={setFilters} />
            </aside>

            <main className="flex-1">
              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-[#003D82]" />
                </div>
              ) : (
                <SearchResultsList products={filteredResults} city={cityName || stateName} category={serviceName} />
              )}
            </main>
          </div>
        </div>
      </div>
    </>
  );
};

export default SearchResults;