import { supabase } from '@/lib/customSupabaseClient';

const isMissingColumnErr = (error, columnName) => {
  const msg = String(error?.message || error || '').toLowerCase();
  return msg.includes('column') && msg.includes(String(columnName).toLowerCase()) && msg.includes('does not exist');
};

export const categoryApi = {
  // ✅ Fetch top-level categories (Head Categories)
  getTopLevelCategories: async () => {
    try {
      // try sort_order first (if exists)
      let res = await supabase
        .from('head_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (res.error && isMissingColumnErr(res.error, 'sort_order')) {
        res = await supabase
          .from('head_categories')
          .select('*')
          .eq('is_active', true)
          .order('name', { ascending: true });
      }

      if (res.error) {
        console.error('Error fetching head categories:', res.error);
        return [];
      }
      return res.data || [];
    } catch (err) {
      console.error('Unexpected error fetching categories:', err);
      return [];
    }
  },

  /**
   * ✅ Home/Directory Showcase Data (NO hardcode)
   * Returns:
   * [
   *  { id,name,slug,image_url, subcategories: [
   *     { id,name,slug,image_url, micros:[{id,name,slug}] }
   *  ]}
   * ]
   */
  getHomeShowcaseCategories: async () => {
    try {
      // 1) Heads
      let headRes = await supabase
        .from('head_categories')
        .select('id, name, slug, image_url, description')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (headRes.error && isMissingColumnErr(headRes.error, 'sort_order')) {
        headRes = await supabase
          .from('head_categories')
          .select('id, name, slug, image_url, description')
          .eq('is_active', true)
          .order('name', { ascending: true });
      }

      if (headRes.error) {
        console.error('Error fetching head categories:', headRes.error);
        return [];
      }

      const heads = headRes.data || [];
      if (heads.length === 0) return [];

      const headIds = heads.map((h) => h.id);

      // 2) Subs
      let subRes = await supabase
        .from('sub_categories')
        .select('id, head_category_id, name, slug, image_url, description')
        .in('head_category_id', headIds)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (subRes.error && isMissingColumnErr(subRes.error, 'sort_order')) {
        subRes = await supabase
          .from('sub_categories')
          .select('id, head_category_id, name, slug, image_url, description')
          .in('head_category_id', headIds)
          .eq('is_active', true)
          .order('name', { ascending: true });
      }

      if (subRes.error) {
        console.error('Error fetching sub categories:', subRes.error);
        return heads.map((h) => ({ ...h, subcategories: [] }));
      }

      const subs = subRes.data || [];
      const subIds = subs.map((s) => s.id);

      // 3) Micros
      let micros = [];
      if (subIds.length > 0) {
        let microRes = await supabase
          .from('micro_categories')
          .select('id, sub_category_id, name, slug')
          .in('sub_category_id', subIds)
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true });

        if (microRes.error && isMissingColumnErr(microRes.error, 'sort_order')) {
          microRes = await supabase
            .from('micro_categories')
            .select('id, sub_category_id, name, slug')
            .in('sub_category_id', subIds)
            .eq('is_active', true)
            .order('name', { ascending: true });
        }

        if (microRes.error) {
          console.error('Error fetching micro categories:', microRes.error);
          micros = [];
        } else {
          micros = microRes.data || [];
        }
      }

      // Group micros by sub
      const microsBySub = micros.reduce((acc, m) => {
        if (!acc[m.sub_category_id]) acc[m.sub_category_id] = [];
        acc[m.sub_category_id].push({ id: m.id, name: m.name, slug: m.slug });
        return acc;
      }, {});

      // Group subs by head and attach micros
      const subsByHead = subs.reduce((acc, s) => {
        if (!acc[s.head_category_id]) acc[s.head_category_id] = [];
        acc[s.head_category_id].push({
          id: s.id,
          name: s.name,
          slug: s.slug,
          image_url: s.image_url,
          description: s.description,
          micros: microsBySub[s.id] || []
        });
        return acc;
      }, {});

      // Attach subs to heads
      return heads.map((h) => ({
        ...h,
        subcategories: subsByHead[h.id] || []
      }));
    } catch (err) {
      console.error('Unexpected error building showcase categories:', err);
      return [];
    }
  },

  // ✅ Children fetch (HEAD -> SUB, SUB -> MICRO)
  getCategoryChildren: async (parentId, parentType = 'HEAD') => {
    try {
      let table = 'sub_categories';
      let foreignKey = 'head_category_id';

      if (parentType === 'SUB') {
        table = 'micro_categories';
        foreignKey = 'sub_category_id';
      }

      let res = await supabase
        .from(table)
        .select('*')
        .eq(foreignKey, parentId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (res.error && isMissingColumnErr(res.error, 'sort_order')) {
        res = await supabase
          .from(table)
          .select('*')
          .eq(foreignKey, parentId)
          .eq('is_active', true)
          .order('name', { ascending: true });
      }

      if (res.error) {
        console.error(`Error fetching children from ${table}:`, res.error);
        return [];
      }
      return res.data || [];
    } catch (err) {
      console.error('Unexpected error fetching children:', err);
      return [];
    }
  },

  // ✅ slug resolver
  getCategoryBySlug: async (slug) => {
    try {
      const { data: headData } = await supabase
        .from('head_categories')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();

      if (headData) return { ...headData, type: 'HEAD' };

      const { data: subData } = await supabase
        .from('sub_categories')
        .select(
          `
          *,
          parent:head_categories (
            id, name, slug
          )
        `
        )
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();

      if (subData) return { ...subData, type: 'SUB' };

      const { data: microData } = await supabase
        .from('micro_categories')
        .select(
          `
          *,
          parent:sub_categories (
            id, name, slug,
            grandparent:head_categories (
              id, name, slug
            )
          )
        `
        )
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();

      if (microData) return { ...microData, type: 'MICRO' };

      return null;
    } catch (err) {
      console.error('Unexpected error fetching category by slug:', err);
      return null;
    }
  },

  getCategoryHierarchy: async (slug) => {
    return await categoryApi.getCategoryBySlug(slug);
  },

  seedCategories: async (jsonData) => {
    const { data, error } = await supabase.functions.invoke('seed-categories', { body: jsonData });
    if (error) throw error;
    return data;
  }
};
