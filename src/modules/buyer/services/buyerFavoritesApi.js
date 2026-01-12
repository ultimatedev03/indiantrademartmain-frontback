
import { supabase } from '@/lib/customSupabaseClient';

export const buyerFavoritesApi = {
  list: async () => {
    const { data: buyer } = await supabase.from('buyers').select('id').eq('user_id', (await supabase.auth.getUser()).data.user.id).single();
    
    const { data, error } = await supabase
      .from('favorites')
      .select('*, vendor:vendors(*)')
      .eq('buyer_id', buyer.id);

    if (error) throw error;
    return data;
  },

  add: async (vendorId) => {
    const { data: buyer } = await supabase.from('buyers').select('id').eq('user_id', (await supabase.auth.getUser()).data.user.id).single();
    
    const { data, error } = await supabase
      .from('favorites')
      .insert([{ buyer_id: buyer.id, vendor_id: vendorId }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  remove: async (vendorId) => {
    const { data: buyer } = await supabase.from('buyers').select('id').eq('user_id', (await supabase.auth.getUser()).data.user.id).single();
    
    const { error } = await supabase
      .from('favorites')
      .delete()
      .match({ buyer_id: buyer.id, vendor_id: vendorId });

    if (error) throw error;
    return true;
  }
};
