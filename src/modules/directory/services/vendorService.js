
import { supabase } from '@/lib/customSupabaseClient';

export const vendorService = {
  getFeaturedVendors: async () => {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .limit(6);
    
    if (error) {
      console.error('Error fetching featured vendors:', error);
      return [];
    }
    return data;
  },

  getVendorById: async (vendorId) => {
    const { data, error } = await supabase
      .from('vendors')
      .select('*, products(*)')
      .eq('id', vendorId)
      .single();
    
    if (error) {
      console.error('Error fetching vendor:', error);
      return null;
    }
    return data;
  },

  searchVendors: async ({ serviceSlug, stateSlug, citySlug, query }) => {
    try {
      // Start building the query on 'vendors' table
      let dbQuery = supabase
        .from('vendors')
        .select(`
          *,
          products (*),
          city:city_id (slug, name),
          state:state_id (slug, name)
        `)
        .eq('kyc_status', 'VERIFIED'); // Only verified vendors

      // 1. Filter by Location (State)
      if (stateSlug) {
        // Find state ID first (Optimization: could use join filter if Supabase supported it easily deep down)
        const { data: stateData } = await supabase
           .from('states')
           .select('id')
           .eq('slug', stateSlug)
           .single();
        
        if (stateData) {
            dbQuery = dbQuery.eq('state_id', stateData.id);
        }
      }

      // 2. Filter by Location (City)
      if (citySlug) {
        const { data: cityData } = await supabase
           .from('cities')
           .select('id')
           .eq('slug', citySlug)
           .single();
        
        if (cityData) {
            dbQuery = dbQuery.eq('city_id', cityData.id);
        }
      }
      
      // Execute Vendor Query
      const { data: vendors, error } = await dbQuery;
      
      if (error) throw error;
      if (!vendors) return [];

      // 3. Filter by Service/Category (Client-side or complex Join)
      // Since 'serviceSlug' matches product categories, we filter the products inside vendors
      // OR filtered vendors who have at least one product in that category.
      
      let filteredVendors = vendors;

      if (serviceSlug) {
          // Normalize slug for comparison (very basic fuzzy match)
          const searchTerm = serviceSlug.replace(/-/g, ' ').toLowerCase();
          
          filteredVendors = vendors.filter(v => {
              // Check if vendor has products matching the service
              const hasMatchingProduct = v.products?.some(p => 
                  (p.category && p.category.toLowerCase().includes(searchTerm)) ||
                  (p.name && p.name.toLowerCase().includes(searchTerm)) ||
                  (p.description && p.description.toLowerCase().includes(searchTerm))
              );
              
              // Also check if company name matches (e.g. "ABC Electronics" matches "electronics")
              const companyMatch = v.company_name.toLowerCase().includes(searchTerm);
              
              return hasMatchingProduct || companyMatch;
          });
      }

      // 4. General Query Filter
      if (query) {
         const q = query.toLowerCase();
         filteredVendors = filteredVendors.filter(v => 
             v.company_name.toLowerCase().includes(q) ||
             v.products?.some(p => p.name.toLowerCase().includes(q))
         );
      }

      return filteredVendors;

    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  }
};
