import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useSearchParams, useParams, useLocation } from 'react-router-dom';
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

const SearchResults = () => {
  const [searchParams] = useSearchParams();
  const params = useParams(); // { service, state, city } OR { slug }
  const location = useLocation();

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

  // 1) Parse URL
  useEffect(() => {
    let service = '';
    let state = '';
    let city = '';

    // ✅ NEW: /directory/search/:service/:state?/:city?
    if (params.service) {
      service = params.service;
      state = params.state || '';
      city = params.city || '';
    }
    // ✅ OLD: /directory/:slug (seo format)
    else if (params.slug) {
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
  }, [params, location.pathname]);

  // 2) Fetch Products directly (FIX ✅)
  useEffect(() => {
    const fetchResults = async () => {
      if (!parsedParams.serviceSlug) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // service slug -> readable search text
        const serviceText = (parsedParams.serviceSlug || '').replace(/-/g, ' ').trim();
        const extraQ = (searchParams.get('q') || '').trim();

        // Resolve state/city IDs from slugs (needed for vendors.state_id / city_id filter)
        const { state, city } = await locationService.getLocationBySlug(
          parsedParams.stateSlug,
          parsedParams.citySlug
        );

        const stateId = state?.id || null;
        const cityId = city?.id || null;

        // ✅ Search in products table and INNER JOIN vendors (so we can filter by vendor location)
        let query = supabase
          .from('products')
          .select(
            `
            *,
            vendors!inner (
              id, company_name, city, state, state_id, city_id,
              seller_rating, kyc_status, verification_badge, trust_score
            )
          `,
            { count: 'exact' }
          )
          .eq('status', 'ACTIVE');

        // ✅ location filters
        if (stateId) query = query.eq('vendors.state_id', stateId);
        if (cityId) query = query.eq('vendors.city_id', cityId);

        // ✅ MAIN SEARCH: match product name + category fields + description
        const q1 = serviceText;
        const q2 = extraQ;

        const orParts = [];
        if (q1) {
          orParts.push(
            `name.ilike.%${q1}%`,
            `category.ilike.%${q1}%`,
            `category_path.ilike.%${q1}%`,
            `category_other.ilike.%${q1}%`,
            `description.ilike.%${q1}%`
          );
        }
        if (q2) {
          orParts.push(
            `name.ilike.%${q2}%`,
            `category.ilike.%${q2}%`,
            `category_path.ilike.%${q2}%`,
            `category_other.ilike.%${q2}%`,
            `description.ilike.%${q2}%`
          );
        }

        if (orParts.length) query = query.or(orParts.join(','));

        // ✅ order & limit
        query = query.order('created_at', { ascending: false }).limit(120);

        const { data, error } = await query;
        if (error) throw error;

        // Convert response to the format your UI expects
        const mapped = (data || []).map((p) => ({
          ...p,
          vendorName: p.vendors?.company_name,
          vendorId: p.vendors?.id,
          vendorCity: p.vendors?.city,
          vendorState: p.vendors?.state,
          vendorRating: p.vendors?.seller_rating || 4.5,
          vendorVerified: p.vendors?.kyc_status === 'VERIFIED' || !!p.vendors?.verification_badge,
        }));

        setResults(mapped);
      } catch (error) {
        console.error('Search failed', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [parsedParams.serviceSlug, parsedParams.stateSlug, parsedParams.citySlug, searchParams]);

  // Client-side filtering
  const filteredResults = results.filter((item) => {
    if (filters.verified && !item.vendorVerified) return false;
    if (filters.inStock && !item.inStock) return false;
    return true;
  });

  // SEO text
  const formatName = (s) => (s ? s.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) : '');
  const serviceName = formatName(parsedParams.serviceSlug);
  const cityName = formatName(parsedParams.citySlug);
  const stateName = formatName(parsedParams.stateSlug);

  const pageTitle = serviceName
    ? `${serviceName} Suppliers & Manufacturers${cityName ? ` in ${cityName}` : ''}${
        stateName && !cityName ? ` in ${stateName}` : ''
      }`
    : 'Search Results';

  // Canonical
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

      <div className="min-h-screen bg-neutral-50 pb-20">
        {/* Sticky Header */}
        <div className="bg-white border-b sticky top-16 z-10 shadow-sm pt-4 pb-4">
          <div className="container mx-auto px-4">
            <PillBreadcrumbs className="mb-4" overrideParams={parsedParams} />

            <div className="mb-4 max-w-4xl">
              <DirectorySearchBar
                enableSuggestions
                className="shadow-xl"
                initialService={parsedParams.serviceSlug}
                initialState={parsedParams.stateSlug}
                initialCity={parsedParams.citySlug}
              />
            </div>

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xl md:text-2xl font-bold text-gray-900"
                >
                  {pageTitle}
                </motion.h1>
                <p className="text-sm text-gray-500 mt-1">{filteredResults.length} products found</p>
              </div>
            </div>

            {parsedParams.stateSlug && (
              <NearbyLocationNav
                serviceSlug={parsedParams.serviceSlug}
                stateSlug={parsedParams.stateSlug}
                currentCitySlug={parsedParams.citySlug}
              />
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col lg:flex-row gap-8">
            <aside className="w-full lg:w-64 flex-shrink-0 hidden lg:block">
              <SearchFilters filters={filters} setFilters={setFilters} />
            </aside>

            <main className="flex-1">
              {loading ? (
                <div className="flex justify-center py-20">
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