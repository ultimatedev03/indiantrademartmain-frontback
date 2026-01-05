
import { supabase } from '@/lib/customSupabaseClient';

export const directoryApi = {
  getVendors: async (filters = {}) => {
    let query = supabase
      .from('vendors')
      .select('*');

    if (filters.verified) {
      query = query.eq('kyc_status', 'VERIFIED');
    }
    
    if (filters.city) {
      query = query.ilike('city', `%${filters.city}%`);
    }

    if (filters.search) {
      query = query.ilike('company_name', `%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching vendors:', error);
      return [];
    }
    return data;
  },

  getVendorById: async (id) => {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', id)
      .single();
      
    if (error) throw error;
    return data;
  },

  getTopCities: async (limit = 10) => {
    const { data, error } = await supabase
      .from('cities')
      .select('*')
      .gt('supplier_count', 0)
      .order('supplier_count', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching top cities:', error);
      return [];
    }
    return data;
  },

  getBrands: async () => {
    // Brands table doesn't exist in schema - return empty array
    return [];
  }
};
