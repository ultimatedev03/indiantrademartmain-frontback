
import { supabase } from '@/lib/customSupabaseClient';

export const supportApi = {
  getAllTickets: async () => {
    const { data, error } = await supabase
      .from('vendor_support_tickets') // and buyer_support_tickets union if needed
      .select('*, vendor:vendors(company_name)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  updateTicket: async (id, updates) => {
    const { error } = await supabase.from('vendor_support_tickets').update(updates).eq('id', id);
    if (error) throw error;
  },

  getTicketDetails: async (id) => {
    const { data, error } = await supabase
      .from('vendor_support_tickets')
      .select('*, vendor:vendors(company_name)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }
};
