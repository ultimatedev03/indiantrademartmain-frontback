import { supabase } from '@/lib/customSupabaseClient';

export const categoryApi = {
  // Fetch top-level categories (Head Categories)
  getTopLevelCategories: async () => {
    try {
      const { data, error } = await supabase
        .from('head_categories')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) {
        console.error('Error fetching head categories:', error);
        return [];
      }
      return data || [];
    } catch (err) {
      console.error('Unexpected error fetching categories:', err);
      return [];
    }
  },

  // Fetch children of a specific category ID
  // This function needs to be smart:
  // If parent is a Head Category -> return Sub Categories
  // If parent is a Sub Category -> return Micro Categories
  getCategoryChildren: async (parentId, parentType = 'HEAD') => {
    try {
      let table = 'sub_categories';
      let foreignKey = 'head_category_id';

      if (parentType === 'SUB') {
        table = 'micro_categories';
        foreignKey = 'sub_category_id';
      }

      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq(foreignKey, parentId)
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error(`Error fetching children from ${table}:`, error);
        return [];
      }
      return data || [];
    } catch (err) {
      console.error('Unexpected error fetching children:', err);
      return [];
    }
  },

  // Fetch full category details by slug
  // We need to check all three tables to find where the slug belongs
  getCategoryBySlug: async (slug) => {
    try {
      // 1. Check Head Categories
      const { data: headData } = await supabase
        .from('head_categories')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();

      if (headData) return { ...headData, type: 'HEAD' };

      // 2. Check Sub Categories
      const { data: subData } = await supabase
        .from('sub_categories')
        .select(`
          *,
          parent:head_categories (
            id, name, slug
          )
        `)
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();

      if (subData) return { ...subData, type: 'SUB' };

      // 3. Check Micro Categories
      const { data: microData } = await supabase
        .from('micro_categories')
        .select(`
          *,
          parent:sub_categories (
            id, name, slug,
            grandparent:head_categories (
              id, name, slug
            )
          )
        `)
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

  // Helper to get full hierarchy for breadcrumbs
  getCategoryHierarchy: async (slug) => {
     // This is implicitly handled by getCategoryBySlug returning parent objects
     // but we can add a specific helper if needed later.
     return await categoryApi.getCategoryBySlug(slug);
  },

  // Method to invoke the seeder (Admin only)
  seedCategories: async (jsonData) => {
    const { data, error } = await supabase.functions.invoke('seed-categories', {
      body: jsonData
    });
    if (error) throw error;
    return data;
  }
};