
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useSearchParams, useParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import SearchFilters from '@/modules/directory/components/SearchFilters';
import SearchResultsList from '@/modules/directory/components/SearchResultsList';
import PillBreadcrumbs from '@/shared/components/PillBreadcrumbs';
import NearbyLocationNav from '@/modules/directory/components/NearbyLocationNav';
import DirectorySearchBar from '@/modules/directory/components/DirectorySearchBar';
import { vendorService } from '@/modules/directory/services/vendorService';
import { urlParser } from '@/shared/utils/urlParser';
import { Loader2 } from 'lucide-react';

const SearchResults = () => {
  const [searchParams] = useSearchParams();
  const params = useParams(); // Can be { service, state, city } OR { slug }
  const location = useLocation();

  // Unified State for parsed params
  const [parsedParams, setParsedParams] = useState({
    serviceSlug: '',
    stateSlug: '',
    citySlug: ''
  });

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    priceRange: [0, 100000],
    rating: 0,
    verified: false,
    inStock: false,
  });

  // 1. Parse URL on mount or change
  useEffect(() => {
    let service, state, city;

    if (params.service && params.state) {
        // Structured Format: /directory/:service/:state/:city?
        service = params.service;
        state = params.state;
        city = params.city || '';
    } else if (params.slug) {
        // Single Slug Format: /directory/:slug (Could be category OR seo-string)
        const parsed = urlParser.parseSeoSlug(params.slug);
        service = parsed.serviceSlug;
        state = parsed.stateSlug;
        city = parsed.citySlug;
    }

    setParsedParams({ 
        serviceSlug: service || '', 
        stateSlug: state || '', 
        citySlug: city || '' 
    });

  }, [params, location.pathname]);


  // 2. Fetch Data based on parsed params
  useEffect(() => {
    const fetchResults = async () => {
      if (!parsedParams.serviceSlug) return;

      setLoading(true);
      try {
        const data = await vendorService.searchVendors({
          serviceSlug: parsedParams.serviceSlug,
          stateSlug: parsedParams.stateSlug,
          citySlug: parsedParams.citySlug,
          query: searchParams.get('q') // Optional extra query param support
        });
        
        const flattenedProducts = data.flatMap(vendor => 
          (vendor.products || []).map(product => ({
            ...product,
            vendorName: vendor.company_name,
            vendorId: vendor.id,
            vendorCity: vendor.city,
            vendorState: vendor.state,
            vendorRating: 4.5,
            vendorVerified: vendor.kyc_status === 'VERIFIED'
          }))
        );

        setResults(flattenedProducts);
      } catch (error) {
        console.error("Search failed", error);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [parsedParams, searchParams]);

  // Client-side filtering
  const filteredResults = results.filter(item => {
    if (filters.verified && !item.vendorVerified) return false;
    if (filters.inStock && !item.inStock) return false;
    return true;
  });

  // Dynamic Content Generation
  const formatName = (s) => s ? s.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '';
  const serviceName = formatName(parsedParams.serviceSlug);
  const cityName = formatName(parsedParams.citySlug);
  const stateName = formatName(parsedParams.stateSlug);
  
  const pageTitle = serviceName 
    ? `${serviceName} Suppliers & Manufacturers${cityName ? ` in ${cityName}` : ''}${stateName && !cityName ? ` in ${stateName}` : ''}`
    : 'Search Results';

  // Canonical URL construction for SEO
  const canonicalPath = parsedParams.citySlug && parsedParams.stateSlug
      ? `/directory/${parsedParams.serviceSlug}-in-${parsedParams.citySlug}-${parsedParams.stateSlug}`
      : `/directory/${parsedParams.serviceSlug}`;
  const canonicalUrl = `https://www.indiantrademart.com${canonicalPath}`;

  return (
    <>
      <Helmet>
        <title>{pageTitle} | IndianTradeMart</title>
        <meta name="description" content={`Find best ${serviceName} suppliers in ${cityName || stateName || 'India'}. Get quotes, compare prices and buy from verified manufacturers.`} />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <div className="min-h-screen bg-neutral-50 pb-20">
        {/* Sticky Header with Search Bar */}
        <div className="bg-white border-b sticky top-16 z-10 shadow-sm pt-4 pb-4">
           <div className="container mx-auto px-4">
              {/* Breadcrumbs */}
              <PillBreadcrumbs 
                className="mb-4" 
                overrideParams={parsedParams}
              />
              
              {/* Search Bar - Compact Version */}
              <div className="mb-4 max-w-4xl">
                  <DirectorySearchBar 
                     initialService={parsedParams.serviceSlug}
                     initialState={parsedParams.stateSlug}
                     initialCity={parsedParams.citySlug}
                  />
              </div>

              {/* Title & Stats */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xl md:text-2xl font-bold text-gray-900"
                    >
                    {pageTitle}
                    </motion.h1>
                    <p className="text-sm text-gray-500 mt-1">
                    {filteredResults.length} verified products found
                    </p>
                </div>
              </div>

              {/* Nearby Cities Pills */}
              {parsedParams.stateSlug && (
                 <NearbyLocationNav 
                    serviceSlug={parsedParams.serviceSlug} 
                    stateSlug={parsedParams.stateSlug} 
                    currentCitySlug={parsedParams.citySlug} 
                 />
              )}
           </div>
        </div>

        {/* Main Content with Padding for Sticky Header */}
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
                <SearchResultsList 
                  products={filteredResults} 
                  city={cityName || stateName} 
                  category={serviceName} 
                />
              )}
            </main>
          </div>
        </div>
      </div>
    </>
  );
};

export default SearchResults;
