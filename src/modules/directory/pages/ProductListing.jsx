import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { directoryApi } from '@/modules/directory/api/directoryApi';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronRight, Home, MapPin, Filter, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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

const ProductsListingPage = () => {
  const { headSlug, subSlug, microSlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ SEO data for micro category (meta_tags + description from micro_category_meta)
  const [microInfo, setMicroInfo] = useState(null);
  const [seoLoading, setSeoLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'relevance');
  const [location, setLocation] = useState(searchParams.get('location') || '');

  // ✅ Load micro seo info
  useEffect(() => {
    let alive = true;

    const loadSeo = async () => {
      if (!microSlug) return;

      setSeoLoading(true);
      try {
        const m = await directoryApi.getMicroCategoryBySlug(microSlug);
        if (!alive) return;
        setMicroInfo(m || null);
      } catch (e) {
        console.warn('Micro SEO fetch failed:', e);
        if (!alive) return;
        setMicroInfo(null);
      } finally {
        if (!alive) return;
        setSeoLoading(false);
      }
    };

    loadSeo();
    return () => {
      alive = false;
    };
  }, [microSlug]);

  const pageTitle = useMemo(() => {
    const microName = microInfo?.name || toTitleCase(microSlug);
    const headName = microInfo?.head_category?.name || toTitleCase(headSlug);
    const subName = microInfo?.sub_category?.name || toTitleCase(subSlug);

    // ✅ Prefer meta_tags as title if available
    const metaTitle = safeStr(microInfo?.meta_tags);
    if (metaTitle) return metaTitle;

    return `${microName} | ${subName} - ${headName} Suppliers & Products | IndianTradeMart`;
  }, [microInfo, microSlug, headSlug, subSlug]);

  const pageDescription = useMemo(() => {
    const microName = microInfo?.name || toTitleCase(microSlug);

    // ✅ Prefer meta_description from micro_category_meta.description
    const metaDesc = safeStr(microInfo?.meta_description);
    if (metaDesc) return truncate(metaDesc);

    return truncate(
      `Browse ${microName} products and verified suppliers in India. Compare prices, view details, and get quotations on IndianTradeMart.`
    );
  }, [microInfo, microSlug]);

  const pageKeywords = useMemo(() => {
    const microName = microInfo?.name || toTitleCase(microSlug);
    const headName = microInfo?.head_category?.name || toTitleCase(headSlug);
    const subName = microInfo?.sub_category?.name || toTitleCase(subSlug);

    const metaTags = safeStr(microInfo?.meta_tags);
    if (metaTags) return metaTags;

    return `${microName}, ${subName}, ${headName}, suppliers, products, IndianTradeMart`;
  }, [microInfo, microSlug, headSlug, subSlug]);

  const canonicalUrl = useMemo(() => {
    try {
      const origin = window.location?.origin || '';
      return origin ? `${origin}/directory/${headSlug}/${subSlug}/${microSlug}` : '';
    } catch {
      return '';
    }
  }, [headSlug, subSlug, microSlug]);

  // ✅ Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const filters = {
          q: searchQuery || null,
          sort: sortBy || 'relevance',
          location: location || null,
        };

        const data = await directoryApi.getDirectoryProducts({
          headSlug,
          subSlug,
          microSlug,
          ...filters,
        });

        setProducts(data || []);
      } catch (error) {
        console.error('Error fetching products:', error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [headSlug, subSlug, microSlug, searchQuery, sortBy, location]);

  const updateUrlParams = (updates) => {
    const next = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([k, v]) => {
      if (v === null || v === undefined || v === '') next.delete(k);
      else next.set(k, String(v));
    });

    setSearchParams(next);
  };

  const microTitle = microInfo?.name || toTitleCase(microSlug);

  return (
    <div className="min-h-screen bg-slate-50">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta name="keywords" content={pageKeywords} />
        {canonicalUrl ? <link rel="canonical" href={canonicalUrl} /> : null}
      </Helmet>

      {/* Header */}
      <div className="bg-white border-b py-4">
        <div className="container mx-auto px-4">
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

          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 capitalize">{microTitle}</h1>

              {/* ✅ show micro meta description if available */}
              <p className="mt-1 text-sm text-slate-600 max-w-3xl">
                {seoLoading ? 'Loading description...' : (safeStr(microInfo?.meta_description) || 'Browse products and suppliers in this micro-category.')}
              </p>
            </div>

            <div className="flex gap-2 items-center">
              <Badge variant="secondary" className="gap-1">
                <Filter className="w-3.5 h-3.5" />
                Filters
              </Badge>
              <Badge variant="outline" className="gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {location ? toTitleCase(location) : 'All India'}
              </Badge>
            </div>
          </div>

          {/* Filters row */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-6">
              <Input
                value={searchQuery}
                placeholder="Search in this category..."
                onChange={(e) => {
                  const v = e.target.value;
                  setSearchQuery(v);
                  updateUrlParams({ q: v });
                }}
              />
            </div>

            <div className="md:col-span-3">
              <Select
                value={sortBy}
                onValueChange={(v) => {
                  setSortBy(v);
                  updateUrlParams({ sort: v });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">Relevance</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="price_low">Price: Low to High</SelectItem>
                  <SelectItem value="price_high">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-3">
              <Input
                value={location}
                placeholder="Location (city/state)"
                onChange={(e) => {
                  const v = e.target.value;
                  setLocation(v);
                  updateUrlParams({ location: v });
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-slate-500">
            No products found.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {products.map((p) => {
              const slug = p?.slug || p?.id;
              return (
                <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="text-lg font-bold text-slate-900 line-clamp-2">{p?.name}</div>
                  <div className="mt-2 text-sm text-slate-600 line-clamp-3">{p?.description || '—'}</div>

                  <div className="mt-4 flex justify-end">
                    <Link
                      to={slug ? `/p/${slug}` : '/directory'}
                      className="text-sm font-semibold text-blue-700 hover:text-blue-900 underline underline-offset-4"
                    >
                      View details →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductsListingPage;
