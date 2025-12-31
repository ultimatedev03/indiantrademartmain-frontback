
import { supabase } from '@/lib/customSupabaseClient';

export const salesApi = {
  getStats: async () => {
    const { count: totalLeads } = await supabase.from('leads').select('*', { count: 'exact', head: true });
    const { count: converted } = await supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'CLOSED');
    
    // Revenue logic similar to admin
    return {
       totalLeads: totalLeads || 0,
       conversionRate: totalLeads ? Math.round((converted / totalLeads) * 100) : 0,
       revenue: '₹ 0' // Placeholder dynamic
    };
  },

  getAllLeads: async () => {
    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  updateLeadStatus: async (id, status) => {
    const { error } = await supabase.from('leads').update({ status }).eq('id', id);
    if (error) throw error;
  }
};
