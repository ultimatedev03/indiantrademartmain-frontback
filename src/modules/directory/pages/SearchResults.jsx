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

    // ✅ /directory/search/:service/:state?/:city?
    if (params.service) {
      service = params.service;
      state = params.state || '';
      city = params.city || '';
    }
    // ✅ /directory/:slug (seo format)
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

  // 2) Fetch Products
  useEffect(() => {
    const fetchResults = async () => {
      if (!parsedParams.serviceSlug) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const serviceText = (parsedParams.serviceSlug || '').replace(/-/g, ' ').trim();
        const extraQ = (searchParams.get('q') || '').trim();

        // Resolve state/city IDs from slugs
        const { state, city } = await locationService.getLocationBySlug(
          parsedParams.stateSlug,
          parsedParams.citySlug
        );

        const stateId = state?.id || null;
        const cityId = city?.id || null;

        // products + vendors join
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

        // location filters
        if (stateId) query = query.eq('vendors.state_id', stateId);
        if (cityId) query = query.eq('vendors.city_id', cityId);

        // search (service + optional q)
        const orParts = [];
        if (serviceText) {
          orParts.push(
            `name.ilike.%${serviceText}%`,
            `category.ilike.%${serviceText}%`,
            `category_path.ilike.%${serviceText}%`,
            `category_other.ilike.%${serviceText}%`,
            `description.ilike.%${serviceText}%`
          );
        }
        if (extraQ) {
          orParts.push(
            `name.ilike.%${extraQ}%`,
            `category.ilike.%${extraQ}%`,
            `category_path.ilike.%${extraQ}%`,
            `category_other.ilike.%${extraQ}%`,
            `description.ilike.%${extraQ}%`
          );
        }
        if (orParts.length) query = query.or(orParts.join(','));

        query = query.order('created_at', { ascending: false }).limit(120);

        const { data, error } = await query;
        if (error) throw error;

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

  // Client-side filtering (basic)
  const filteredResults = results.filter((item) => {
    if (filters.verified && !item.vendorVerified) return false;
    if (filters.inStock && !item.inStock) return false;
    return true;
  });

  // SEO text helpers
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

      <div className="min-h-screen bg-neutral-50 pb-16">
        {/* ✅ Compact Sticky Header (Nearby always visible) */}
        <div className="bg-white border-b sticky top-16 z-10 shadow-sm">
          <div className="container mx-auto px-4 py-2">
            {/* Breadcrumbs */}
            <PillBreadcrumbs className="mb-2" overrideParams={parsedParams} />

            {/* Search Bar (keep suggestions) */}
            <div className="max-w-4xl mb-2">
              <DirectorySearchBar
                enableSuggestions
                className="shadow-sm"
                initialService={parsedParams.serviceSlug}
                initialState={parsedParams.stateSlug}
                initialCity={parsedParams.citySlug}
              />
            </div>

            {/* Title + count in one compact row */}
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

            {/* ✅ Nearby always visible but compact (horizontal scroll to save height) */}
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

        {/* Main content (reduced top padding) */}
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