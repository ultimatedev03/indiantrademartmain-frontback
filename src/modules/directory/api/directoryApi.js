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
    
    // First search in micro_categories
    const { data: microData, error: microError } = await supabase
      .from('micro_categories')
      .select(`
        id, name, slug, 
        sub_categories(name, slug, head_categories(name, slug))
      `)
      .ilike('name', `%${q}%`)
      .limit(10);

    let results = [];
    
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
    
    // If micro results < 5, search in sub_categories for fallback
    if (results.length < 5) {
      const { data: subData, error: subError } = await supabase
        .from('sub_categories')
        .select(`
          id, name, slug,
          head_categories(name, slug, id)
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
        
        // Combine results, prioritizing micro categories
        results = [...results, ...subResults].slice(0, 10);
      }
    }
    
    return results;
  },

  listProductsByMicro: async ({ microSlug, stateId, cityId, q, sort, page = 1, limit = 20 }) => {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('products')
      .select(`
        *,
        vendors (
          id, company_name, city, state, seller_rating, kyc_status, verification_badge, trust_score
        )
      `, { count: 'exact' })
      .eq('status', 'ACTIVE');

    if (microSlug) {
      const { data: micro } = await supabase.from('micro_categories').select('id').eq('slug', microSlug).single();
      if (micro) {
        query = query.eq('micro_category_id', micro.id);
      }
    }

    if (q) {
      query = query.ilike('name', `%${q}%`);
    }

    if (sort === 'price_asc') query = query.order('price', { ascending: true });
    if (sort === 'price_desc') query = query.order('price', { ascending: false });
    if (!sort) query = query.order('created_at', { ascending: false });

    query = query.range(from, to);

    const { data, count, error } = await query;
    
    let filteredData = data || [];
    if (stateId || cityId) {
        filteredData = filteredData.filter(p => {
             if (stateId && p.vendors?.state_id !== stateId && p.vendors?.state !== stateId) return false;
             if (cityId && p.vendors?.city_id !== cityId && p.vendors?.city !== cityId) return false;
             return true;
        });
    }

    if (error) throw error;
    return { data: filteredData, count };
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