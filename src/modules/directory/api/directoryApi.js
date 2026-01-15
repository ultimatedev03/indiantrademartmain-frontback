import { supabase } from '@/lib/customSupabaseClient';

// ✅ Local vs Netlify API base (for server-side ranked search)
const isLocalHost = () => {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
};

const getDirBase = () => {
  const override = import.meta.env.VITE_DIR_API_BASE;
  if (override && String(override).trim()) return String(override).trim();
  return isLocalHost() ? '/api/dir' : '/.netlify/functions/dir';
};

async function safeReadJson(res) {
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return await res.json();
  const text = await res.text();
  throw new Error(`API returned non-JSON (${res.status}). Got: ${text.slice(0, 120)}...`);
}

async function fetchRankedProducts({ q, microSlug, stateId, cityId, sort = '', page = 1, limit = 20 }) {
  const sp = new URLSearchParams();
  if (q) sp.set('q', String(q));
  if (microSlug) sp.set('microSlug', String(microSlug));
  if (stateId) sp.set('stateId', String(stateId));
  if (cityId) sp.set('cityId', String(cityId));
  if (sort) sp.set('sort', String(sort));
  sp.set('page', String(page || 1));
  sp.set('limit', String(limit || 20));

  const url = `${getDirBase()}/products?${sp.toString()}`;
  const res = await fetch(url, { method: 'GET' });
  const json = await safeReadJson(res);
  if (!json?.success) throw new Error(json?.details || json?.error || 'Failed to load products');
  return { data: json.data || [], count: json.count || 0 };
}

export const directoryApi = {
  getHeadCategories: async () => {
    const { data, error } = await supabase
      .from('head_categories')
      .select('id, name, slug, image_url, description')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return data || [];
  },

  getSubCategories: async (headSlug) => {
    const { data: head } = await supabase.from('head_categories').select('id').eq('slug', headSlug).single();
    if (!head) return [];

    const { data, error } = await supabase
      .from('sub_categories')
      .select('id, name, slug, image_url, description')
      .eq('head_category_id', head.id)
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data || [];
  },

  // ✅ FIXED: micro_categories table me `description` column exist nahi karta
  getMicroCategories: async (subSlug, headSlug = null) => {
    if (!subSlug) return [];

    let subId = null;

    if (headSlug) {
      const { data: head, error: headErr } = await supabase
        .from('head_categories')
        .select('id')
        .eq('slug', headSlug)
        .limit(1);

      if (headErr) throw headErr;

      const headId = head?.[0]?.id;
      if (!headId) return [];

      const { data: subs, error: subErr } = await supabase
        .from('sub_categories')
        .select('id')
        .eq('slug', subSlug)
        .eq('head_category_id', headId)
        .limit(1);

      if (subErr) throw subErr;
      subId = subs?.[0]?.id || null;
    } else {
      const { data: subs, error: subErr } = await supabase
        .from('sub_categories')
        .select('id')
        .eq('slug', subSlug)
        .limit(1);

      if (subErr) throw subErr;
      subId = subs?.[0]?.id || null;
    }

    if (!subId) return [];

    const { data, error } = await supabase
      .from('micro_categories')
      .select('id, name, slug, sort_order') // ✅ only existing columns
      .eq('sub_category_id', subId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // ✅ cover images derived from products
  getMicroCategoryCovers: async (microIds = []) => {
    try {
      const ids = Array.isArray(microIds) ? microIds.filter(Boolean) : [];
      if (ids.length === 0) return {};

      const { data, error } = await supabase
        .from('products')
        .select('micro_category_id, images, created_at')
        .in('micro_category_id', ids)
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const map = {};
      for (const row of data || []) {
        const mid = row.micro_category_id;
        if (!mid || map[mid]) continue;

        const imgs = row.images;
        let url = null;

        if (Array.isArray(imgs) && imgs.length > 0) {
          const first = imgs[0];
          if (typeof first === 'string') url = first;
          else if (first && typeof first === 'object') url = first.url || first.image_url || first.src || null;
        }

        if (typeof url === 'string' && url.trim().length > 0) {
          map[mid] = url.trim();
        }
      }

      return map;
    } catch (e) {
      console.error('Error loading micro category covers:', e);
      return {};
    }
  },

  /**
   * ✅ NEW: micro-wise products preview (single query, then group client-side)
   * Returns: { [microId]: Product[] }
   */
  getProductsPreviewByMicroIds: async ({ microIds = [], perMicro = 6 }) => {
    try {
      const ids = Array.isArray(microIds) ? microIds.filter(Boolean) : [];
      const per = Math.max(1, Math.min(Number(perMicro) || 6, 12));
      if (ids.length === 0) return {};

      const fetchLimit = Math.min(ids.length * per * 3, 600);

      const { data, error } = await supabase
        .from('products')
        .select('id, name, slug, price, images, micro_category_id, created_at')
        .in('micro_category_id', ids)
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false })
        .limit(fetchLimit);

      if (error) throw error;

      const map = {};
      for (const row of data || []) {
        const mid = row.micro_category_id;
        if (!mid) continue;
        if (!map[mid]) map[mid] = [];
        if (map[mid].length >= per) continue;
        map[mid].push(row);
      }

      return map;
    } catch (e) {
      console.error('Error loading products preview:', e);
      // ✅ IMPORTANT: never break the page
      return {};
    }
  },

  searchMicroCategories: async (q) => {
    if (!q || q.length < 2) return [];

    let results = [];

    const { data: microData, error: microError } = await supabase
      .from('micro_categories')
      .select(`
        id, name, slug, 
        sub_categories(id, name, slug, head_categories(id, name, slug))
      `)
      .ilike('name', `%${q}%`)
      .limit(10);

    if (!microError && microData) {
      results = microData.map(item => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
        path: `${item.sub_categories?.head_categories?.name} > ${item.sub_categories?.name} > ${item.name}`,
        head_id: item.sub_categories?.head_categories?.id,
        sub_id: item.sub_categories?.id,
        sub_slug: item.sub_categories?.slug,
        head_slug: item.sub_categories?.head_categories?.slug,
        type: 'micro'
      }));
    }

    if (results.length < 6) {
      const { data: prodData, error: prodError } = await supabase
        .from('products')
        .select('id, micro_category_id, status')
        .ilike('name', `%${q}%`)
        .or('status.eq.ACTIVE,status.is.null')
        .limit(20);

      if (!prodError && prodData) {
        const microIds = Array.from(new Set((prodData || []).map(p => p.micro_category_id).filter(Boolean)));

        if (microIds.length > 0) {
          const { data: microFromProducts, error: mpErr } = await supabase
            .from('micro_categories')
            .select(`
              id, name, slug,
              sub_categories(id, name, slug, head_categories(id, name, slug))
            `)
            .in('id', microIds)
            .limit(10);

          if (!mpErr && microFromProducts) {
            const mapped = microFromProducts.map(item => ({
              id: item.id,
              name: item.name,
              slug: item.slug,
              path: `${item.sub_categories?.head_categories?.name} > ${item.sub_categories?.name} > ${item.name}`,
              head_id: item.sub_categories?.head_categories?.id,
              sub_id: item.sub_categories?.id,
              sub_slug: item.sub_categories?.slug,
              head_slug: item.sub_categories?.head_categories?.slug,
              type: 'micro'
            }));

            results = [...mapped, ...results];
          }
        }
      }
    }

    if (results.length < 5) {
      const { data: subData, error: subError } = await supabase
        .from('sub_categories')
        .select(`
          id, name, slug,
          head_categories(id, name, slug)
        `)
        .ilike('name', `%${q}%`)
        .limit(10);

      if (!subError && subData) {
        const subResults = subData.map(item => ({
          id: item.id,
          name: item.name,
          slug: item.slug,
          path: `${item.head_categories?.name} > ${item.name}`,
          head_id: item.head_categories?.id,
          sub_id: item.id,
          sub_slug: item.slug,
          head_slug: item.head_categories?.slug,
          type: 'sub'
        }));

        results = [...results, ...subResults];
      }
    }

    const seen = new Set();
    const unique = [];
    for (const r of results) {
      const key = `${r.type}:${r.slug}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(r);
      }
    }

    return unique.slice(0, 10);
  },

  searchProducts: async ({ q, stateId, cityId, sort = '', page = 1, limit = 20 }) => {
    // ✅ Ranked search by vendor plan (DIAMOND > GOLD > SILVER > BOOSTER > CERTIFIED > STARTUP > TRIAL)
    return fetchRankedProducts({ q, microSlug: '', stateId, cityId, sort, page, limit });
  },

  listProductsByMicro: async ({ microSlug, stateId, cityId, q, sort, page = 1, limit = 20 }) => {
    // ✅ Ranked search by vendor plan (server-side)
    return fetchRankedProducts({ q, microSlug, stateId, cityId, sort, page, limit });
  },

  getProductDetailBySlug: async (slug) => {
    const { data: product, error } = await supabase
      .from('products')
      .select(`
        *,
        vendors (*)
      `)
      .eq('slug', slug)
      .single();

    if (error) throw error;

    if (product && product.micro_category_id) {
      const { data: catData } = await supabase
        .from('micro_categories')
        .select(`
          id, name, slug,
          sub_categories (
            id, name, slug,
            head_categories (id, name, slug)
          )
        `)
        .eq('id', product.micro_category_id)
        .single();

      if (catData) {
        product.micro_categories = catData;
      }
    }

    if (product && product.extra_micro_categories) {
      try {
        let extraCategories = product.extra_micro_categories;
        if (typeof extraCategories === 'string') extraCategories = JSON.parse(extraCategories);

        if (Array.isArray(extraCategories) && extraCategories.length > 0) {
          const extraIds = extraCategories.map(c => c?.id).filter(Boolean);

          if (extraIds.length > 0) {
            const { data: metaData } = await supabase
              .from('micro_category_meta')
              .select('micro_categories, meta_tags, description')
              .in('micro_categories', extraIds);

            if (metaData && metaData.length > 0) {
              product.extra_micro_categories = extraCategories.map(cat => {
                const withMeta = metaData.find(m => m.micro_categories === cat?.id);
                return withMeta ? { ...cat, meta_tags: withMeta.meta_tags, description: withMeta.description } : cat;
              });
            }
          }
        }
      } catch (err) {
        console.warn('Error processing extra_micro_categories:', err);
      }
    }

    if (product && product.micro_category_id) {
      try {
        const { data: primaryMeta } = await supabase
          .from('micro_category_meta')
          .select('meta_tags, description')
          .eq('micro_categories', product.micro_category_id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (primaryMeta) {
          product.primary_meta_tags = primaryMeta.meta_tags;
          product.primary_meta_description = primaryMeta.description;
        } else {
          if (product.micro_categories?.name) {
            product.primary_meta_tags = `${product.name} | ${product.micro_categories.name}`;
          }
        }
      } catch (err) {
        console.warn('Error fetching primary micro category meta:', err);
      }
    }

    return product;
  },

  getStates: async () => {
    const { data } = await supabase.from('states').select('id, name, slug').order('name');
    return data || [];
  },

  getCities: async (stateId) => {
    if (!stateId) return [];
    const { data } = await supabase.from('cities').select('id, name, slug').eq('state_id', stateId).order('name');
    return data || [];
  },

  getMicroCategoryBySlug: async (microSlug) => {
    try {
      const { data: micro, error } = await supabase
        .from('micro_categories')
        .select(`
          id, name, slug,
          sub_categories (
            id, name, slug,
            head_categories (id, name, slug)
          )
        `)
        .eq('slug', microSlug)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !micro) return null;

      const { data: metaData } = await supabase
        .from('micro_category_meta')
        .select('meta_tags, description')
        .eq('micro_categories', micro.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        ...micro,
        meta_tags: metaData?.meta_tags,
        meta_description: metaData?.description
      };
    } catch (err) {
      console.warn('Error fetching micro category by slug:', err);
      return null;
    }
  },

  getProductsByMicroAndLocation: async ({ microSlug, stateId, cityId, page = 1, limit = 20 }) => {
    try {
      // ✅ Ranked search by vendor plan (server-side)
      return fetchRankedProducts({ q: '', microSlug, stateId, cityId, sort: '', page, limit });
    } catch (err) {
      console.warn('Error fetching products by micro and location:', err);
      return { data: [], count: 0 };
    }
  }
};
