import { supabase } from '@/lib/customSupabaseClient';

// NOTE:
// In Supabase/PostgREST, `.single()` throws:
// "Cannot coerce the result to a single JSON object" when the query returns 0 rows.
// This usually happens when:
// 1) the filter doesn't match any row (wrong/undefined id), OR
// 2) RLS blocks UPDATE/DELETE (so 0 rows are affected).
//
// To avoid false "Success" and to show a clear message, we:
// - avoid `.single()` for UPDATE/DELETE
// - request returning rows with `.select()` and verify at least 1 row was affected

const firstRowOrThrow = (data, message) => {
  if (!data) throw new Error(message);
  if (Array.isArray(data)) {
    if (data.length === 0) throw new Error(message);
    return data[0];
  }
  return data;
};

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
      .select();

    if (error) throw error;
    return firstRowOrThrow(
      data,
      'Update failed. No head category was updated. (Possible RLS/permission issue or wrong id)'
    );
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

    const { data, error } = await supabase
      .from('head_categories')
      .delete()
      .eq('id', id)
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error('Delete failed. No head category was deleted. (Possible RLS/permission issue or wrong id)');
    }
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
      .select();

    if (error) throw error;
    return firstRowOrThrow(
      data,
      'Update failed. No sub category was updated. (Possible RLS/permission issue or wrong id)'
    );
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

    const { data, error } = await supabase
      .from('sub_categories')
      .delete()
      .eq('id', id)
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error('Delete failed. No sub category was deleted. (Possible RLS/permission issue or wrong id)');
    }
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
      .select();

    if (error) throw error;
    return firstRowOrThrow(
      data,
      'Update failed. No micro category was updated. (Possible RLS/permission issue or wrong id)'
    );
  },

  delete: async (id) => {
    // If meta exists, it can block deletion due to FK constraint.
    // So delete meta first (safe even if there is no meta row).
    const { error: metaErr } = await supabase
      .from('micro_category_meta')
      .delete()
      .eq('micro_categories', id);
    if (metaErr) throw metaErr;

    const { data, error } = await supabase
      .from('micro_categories')
      .delete()
      .eq('id', id)
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error('Delete failed. No micro category was deleted. (Possible RLS/permission issue or wrong id)');
    }
  }
};
