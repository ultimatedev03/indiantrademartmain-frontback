
import { supabase } from '@/lib/customSupabaseClient';

export const buyerProposalApi = {
  list: async (status = 'ALL') => {
    const { data: buyer } = await supabase.from('buyers').select('id').eq('user_id', (await supabase.auth.getUser()).data.user.id).single();
    if (!buyer) throw new Error('Buyer profile not found');

    let query = supabase
      .from('proposals')
      .select('*, vendor:vendors(company_name, id)')
      .eq('buyer_id', buyer.id)
      .order('created_at', { ascending: false });

    if (status !== 'ALL') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  get: async (id) => {
    const { data, error } = await supabase
      .from('proposals')
      .select('*, vendor:vendors(*)')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  create: async (proposalData) => {
    const { data: buyer } = await supabase.from('buyers').select('id').eq('user_id', (await supabase.auth.getUser()).data.user.id).single();
    
    const { data, error } = await supabase
      .from('proposals')
      .insert([{ ...proposalData, buyer_id: buyer.id, status: 'SENT' }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  close: async (id) => {
    const { data, error } = await supabase
      .from('proposals')
      .update({ status: 'CLOSED' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
