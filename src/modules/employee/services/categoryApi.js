import { supabase } from '@/lib/customSupabaseClient';

// HEAD CATEGORIES
export const headCategoryApi = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('head_categories')
      .select('*')
      .order('name');
    if (error) throw error;
    return data;
  },

  getActive: async () => {
    const { data, error } = await supabase
      .from('head_categories')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return data;
  },

  create: async (categoryData) => {
    const { name, slug, description, is_active } = categoryData;
    
    const { data, error } = await supabase
      .from('head_categories')
      .insert([{
        name: name.trim(),
        slug: slug.trim(),
        description: description?.trim() || null,
        is_active: is_active !== false
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  update: async (id, categoryData) => {
    const { name, slug, description, is_active } = categoryData;
    
    const { data, error } = await supabase
      .from('head_categories')
      .update({
        name: name.trim(),
        slug: slug.trim(),
        description: description?.trim() || null,
        is_active: is_active !== false
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  delete: async (id) => {
    // Check if has sub categories
    const { data: subCats, error: countError } = await supabase
      .from('sub_categories')
      .select('id', { count: 'exact' })
      .eq('head_category_id', id);
    
    if (countError) throw countError;
    
    if (subCats && subCats.length > 0) {
      throw new Error(`Cannot delete. This head category has ${subCats.length} sub-categories.`);
    }
    
    const { error } = await supabase
      .from('head_categories')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // Get count of child categories
  getChildCount: async (id) => {
    const { count, error } = await supabase
      .from('sub_categories')
      .select('id', { count: 'exact' })
      .eq('head_category_id', id);
    
    if (error) throw error;
    return count || 0;
  }
};

// SUB CATEGORIES
export const subCategoryApi = {
  getByHeadCategory: async (headCategoryId) => {
    const { data, error } = await supabase
      .from('sub_categories')
      .select('*')
      .eq('head_category_id', headCategoryId)
      .order('name');
    
    if (error) throw error;
    return data;
  },

  getActiveByHeadCategory: async (headCategoryId) => {
    const { data, error } = await supabase
      .from('sub_categories')
      .select('*')
      .eq('head_category_id', headCategoryId)
      .eq('is_active', true)
      .order('name');
    
    if (error) throw error;
    return data;
  },

  create: async (categoryData, headCategoryId) => {
    const { name, slug, description, is_active } = categoryData;
    
    const { data, error } = await supabase
      .from('sub_categories')
      .insert([{
        head_category_id: headCategoryId,
        name: name.trim(),
        slug: slug.trim(),
        description: description?.trim() || null,
        is_active: is_active !== false
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  update: async (id, categoryData) => {
    const { name, slug, description, is_active } = categoryData;
    
    const { data, error } = await supabase
      .from('sub_categories')
      .update({
        name: name.trim(),
        slug: slug.trim(),
        description: description?.trim() || null,
        is_active: is_active !== false
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  delete: async (id) => {
    // Check if has micro categories
    const { data: microCats, error: countError } = await supabase
      .from('micro_categories')
      .select('id', { count: 'exact' })
      .eq('sub_category_id', id);
    
    if (countError) throw countError;
    
    if (microCats && microCats.length > 0) {
      throw new Error(`Cannot delete. This sub-category has ${microCats.length} micro-categories.`);
    }
    
    const { error } = await supabase
      .from('sub_categories')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // Get count of child categories
  getChildCount: async (id) => {
    const { count, error } = await supabase
      .from('micro_categories')
      .select('id', { count: 'exact' })
      .eq('sub_category_id', id);
    
    if (error) throw error;
    return count || 0;
  }
};

// MICRO CATEGORIES
export const microCategoryApi = {
  getBySubCategory: async (subCategoryId) => {
    const { data, error } = await supabase
      .from('micro_categories')
      .select('*')
      .eq('sub_category_id', subCategoryId)
      .order('name');
    
    if (error) throw error;
    return data;
  },

  getActiveBySubCategory: async (subCategoryId) => {
    const { data, error } = await supabase
      .from('micro_categories')
      .select('*')
      .eq('sub_category_id', subCategoryId)
      .eq('is_active', true)
      .order('name');
    
    if (error) throw error;
    return data;
  },

  create: async (categoryData, subCategoryId) => {
    const { name, slug, is_active } = categoryData;
    
    const { data, error } = await supabase
      .from('micro_categories')
      .insert([{
        sub_category_id: subCategoryId,
        name: name.trim(),
        slug: slug.trim(),
        is_active: is_active !== false
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  update: async (id, categoryData) => {
    const { name, slug, is_active } = categoryData;
    
    const { data, error } = await supabase
      .from('micro_categories')
      .update({
        name: name.trim(),
        slug: slug.trim(),
        is_active: is_active !== false
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  delete: async (id) => {
    const { error } = await supabase
      .from('micro_categories')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};
