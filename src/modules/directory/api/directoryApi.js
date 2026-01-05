import { supabase } from '@/lib/customSupabaseClient';

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

  getMicroCategories: async (subSlug) => {
    const { data: sub } = await supabase.from('sub_categories').select('id').eq('slug', subSlug).single();
    if (!sub) return [];

    const { data, error } = await supabase
      .from('micro_categories')
      .select('id, name, slug, description')
      .eq('sub_category_id', sub.id)
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return data || [];
  },

  searchMicroCategories: async (q) => {
  if (!q || q.length < 2) return [];

  let results = [];

  // ✅ 1) First: search in micro_categories (same as before)
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

  // ✅ 2) If micro results are low, try product name -> map to its micro_category
  if (results.length < 6) {
    const { data: prodData, error: prodError } = await supabase
      .from('products')
      .select('id, micro_category_id, status')
      .ilike('name', `%${q}%`)
      .or('status.eq.ACTIVE,status.is.null')
      .limit(20);

    if (!prodError && prodData) {
      const microIds = Array.from(
        new Set((prodData || []).map(p => p.micro_category_id).filter(Boolean))
      );

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

          // merge (product-based microcategories should come first)
          results = [...mapped, ...results];
        }
      }
    }
  }

  // ✅ 3) If still low, fallback search sub_categories (same as before)
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

  // ✅ Deduplicate by type+slug (important)
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
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('products')
    .select(`
      *,
      vendors!inner (
        id, company_name, city, state, state_id, city_id,
        seller_rating, kyc_status, verification_badge, trust_score
      )
    `, { count: 'exact' })
    .eq('status', 'ACTIVE');

  // Search by product name
  if (q) query = query.ilike('name', `%${q}%`);

  // Filter by state
  if (stateId) query = query.eq('vendors.state_id', stateId);

  // Filter by city
  if (cityId) query = query.eq('vendors.city_id', cityId);

  // Sorting
  if (sort === 'price_asc') query = query.order('price', { ascending: true });
  else if (sort === 'price_desc') query = query.order('price', { ascending: false });
  else query = query.order('created_at', { ascending: false });

  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) throw error;

  return { data: data || [], count };
},

listProductsByMicro: async ({ microSlug, stateId, cityId, q, sort, page = 1, limit = 20 }) => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('products')
    .select(`
      *,
      vendors!inner (
        id, company_name, city, state, state_id, city_id,
        seller_rating, kyc_status, verification_badge, trust_score
      )
    `, { count: 'exact' })
    .eq('status', 'ACTIVE');

  // ✅ filter by micro category
  if (microSlug) {
    const { data: micro, error: microErr } = await supabase
      .from('micro_categories')
      .select('id')
      .eq('slug', microSlug)
      .single();

    if (microErr) throw microErr;
    if (micro) query = query.eq('micro_category_id', micro.id);
  }

  // ✅ search within micro
  if (q) query = query.ilike('name', `%${q}%`);

  // ✅ FIX: state filter (UUID) directly on vendors table
  if (stateId) query = query.eq('vendors.state_id', stateId);

  // ✅ optional city filter if used later
  if (cityId) query = query.eq('vendors.city_id', cityId);

  // ✅ sorting
  if (sort === 'price_asc') query = query.order('price', { ascending: true });
  else if (sort === 'price_desc') query = query.order('price', { ascending: false });
  else query = query.order('created_at', { ascending: false });

  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) throw error;

  return { data: data || [], count };
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
    
    // Fetch category separately if needed
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
  }
};