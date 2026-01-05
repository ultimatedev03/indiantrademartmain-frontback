import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';

const PillBreadcrumbs = ({ className, overrideParams }) => {
  const location = useLocation();
  const routeParams = useParams();

  // Use override params if provided (from SearchResults parsing), otherwise route params
  const params = overrideParams || routeParams;

  // ------------------------------
  // Helpers
  // ------------------------------
  const prettify = (slug) => String(slug || '').replace(/-/g, ' ').trim();

  // Category browsing route params
  const headSlug = params.headSlug;
  const subSlug = params.subSlug;
  const microSlugFromRoute = params.microSlug;

  // Search route uses :service (micro/category slug) + optional state/city
  const serviceSlug = params.service || params.serviceSlug;
  const stateSlug = params.state || params.stateSlug;
  const citySlug = params.city || params.citySlug;

  const isDirectorySearch = useMemo(
    () => location.pathname.startsWith('/directory/search') || !!serviceSlug,
    [location.pathname, serviceSlug]
  );

  // When we're on /directory/search/:service..., we want:
  // IndianTradeMart -> Head -> Sub -> Micro -> Location
  const [microHierarchy, setMicroHierarchy] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!isDirectorySearch) return;

      if (!serviceSlug) {
        setMicroHierarchy(null);
        return;
      }

      // If route already provides full hierarchy (head/sub/micro), no need to fetch.
      if (headSlug && subSlug && microSlugFromRoute) {
        setMicroHierarchy({
          head: { slug: headSlug, name: prettify(headSlug) },
          sub: { slug: subSlug, name: prettify(subSlug) },
          micro: { slug: microSlugFromRoute, name: prettify(microSlugFromRoute) },
        });
        return;
      }

      try {
        const { data, error } = await supabase
          .from('micro_categories')
          .select(
            `
              id, name, slug,
              sub_categories (
                id, name, slug,
                head_categories (id, name, slug)
              )
            `
          )
          .eq('slug', serviceSlug)
          .single();

        if (cancelled) return;

        if (error || !data) {
          setMicroHierarchy(null);
          return;
        }

        setMicroHierarchy({
          head: {
            slug: data?.sub_categories?.head_categories?.slug,
            name: data?.sub_categories?.head_categories?.name,
          },
          sub: {
            slug: data?.sub_categories?.slug,
            name: data?.sub_categories?.name,
          },
          micro: { slug: data.slug, name: data.name },
        });
      } catch (_) {
        if (!cancelled) setMicroHierarchy(null);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [isDirectorySearch, serviceSlug, headSlug, subSlug, microSlugFromRoute]);

  // ------------------------------
  // Build breadcrumb items
  // ------------------------------
  let items = [{ label: 'IndianTradeMart', path: '/', icon: Home }];

  // ✅ Category browsing routes: /directory/:headSlug/:subSlug/:microSlug
  if (location.pathname.startsWith('/directory') && (headSlug || subSlug || microSlugFromRoute)) {
    if (headSlug) {
      items.push({ label: prettify(headSlug), path: `/directory/${headSlug}` });
    }
    if (headSlug && subSlug) {
      items.push({ label: prettify(subSlug), path: `/directory/${headSlug}/${subSlug}` });
    }
    if (headSlug && subSlug && microSlugFromRoute) {
      items.push({
        label: prettify(microSlugFromRoute),
        path: `/directory/${headSlug}/${subSlug}/${microSlugFromRoute}`,
      });
    }

    // Optional: if any location exists in route params, show at end
    const locationLabel = citySlug || stateSlug;
    if (locationLabel) {
      items.push({ label: prettify(locationLabel), path: location.pathname });
    }
  }
  // ✅ Search results routes: /directory/search/:service/:state?/:city?
  else if (isDirectorySearch) {
    const h = microHierarchy?.head;
    const s = microHierarchy?.sub;
    const m = microHierarchy?.micro;

    if (h?.slug) items.push({ label: h.name || prettify(h.slug), path: `/directory/${h.slug}` });
    if (h?.slug && s?.slug)
      items.push({ label: s.name || prettify(s.slug), path: `/directory/${h.slug}/${s.slug}` });
    if (h?.slug && s?.slug && m?.slug)
      items.push({
        label: m.name || prettify(m.slug),
        path: `/directory/${h.slug}/${s.slug}/${m.slug}`,
      });

    // Fallback: if hierarchy isn't found (typed random text), just show service text
    if (!m?.slug && serviceSlug) {
      items.push({ label: prettify(serviceSlug), path: `/directory/search/${serviceSlug}` });
    }

    // Location should be last
    const locLabel = citySlug || stateSlug;
    if (locLabel) {
      const base = `/directory/search/${serviceSlug || ''}`;
      const locPath =
        citySlug && stateSlug
          ? `${base}/${stateSlug}/${citySlug}`
          : stateSlug
            ? `${base}/${stateSlug}`
            : location.pathname;

      items.push({ label: prettify(locLabel), path: locPath });
    }
  }
  // ✅ Standard categories section
  else if (location.pathname.startsWith('/categories')) {
    items.push({ label: 'All Categories', path: '/categories' });
    if (params.slug) {
      items.push({ label: prettify(params.slug), path: `/categories/${params.slug}` });
    }
  }

  // ------------------------------
  // UI COMPACT SETTINGS ✅
  // ------------------------------
  const pillBase =
    'inline-flex items-center rounded-full border transition-colors leading-none';

  // smaller pills + smaller text
  const pillSize = 'px-3 py-1 text-xs'; // ✅ reduced padding + font size
  const pillGap = 'gap-1.5'; // ✅ reduce spacing

  // truncate to reduce width
  const labelClass =
    'capitalize truncate max-w-[140px] sm:max-w-[180px] md:max-w-[220px]'; // ✅ max width + truncate

  return (
    <nav className={cn('w-full overflow-x-auto pb-1 scrollbar-hide', className)} aria-label="Breadcrumb">
      <div className={cn('flex items-center whitespace-nowrap', pillGap)}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const Icon = item.icon;

          return (
            <React.Fragment key={`${item.path}-${index}`}>
              {index > 0 && (
                <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /> // ✅ smaller chevron
              )}

              <Link
                to={item.path}
                title={item.label} // ✅ hover pe full text dikh jaayega
                className={cn(
                  pillBase,
                  pillSize,
                  isLast
                    ? 'bg-[#003D82] text-white border-[#003D82] hover:bg-[#002a5c]'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                {Icon && <Icon className="w-3 h-3 mr-1.5 flex-shrink-0" />}
                <span className={labelClass}>{item.label}</span>
              </Link>
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
};

export default PillBreadcrumbs;