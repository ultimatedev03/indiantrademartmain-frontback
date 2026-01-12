
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: buyer } = await supabase.from('buyers').select('id, full_name').eq('user_id', user.id).single();
    
    const { data, error } = await supabase
      .from('proposals')
      .insert([{ ...proposalData, buyer_id: buyer.id, status: 'SENT' }])
      .select()
      .single();

    if (error) throw error;

    // Get vendor details to send notification
    const { data: vendor, error: vendorError } = await supabase
      .from('vendors')
      .select('id, user_id, company_name')
      .eq('id', proposalData.vendor_id)
      .single();

    if (vendorError) throw vendorError;

    // Create notification for vendor
    try {
      const notificationPayload = {
        user_id: vendor.user_id,
        title: 'New Proposal Received',
        message: `${buyer.full_name || 'A buyer'} sent a proposal for ${proposalData.product_name || 'a product'}`,
        type: 'PROPOSAL',
        reference_id: data.id,
        is_read: false,
        created_at: new Date().toISOString()
      };

      console.log('Creating notification with payload:', notificationPayload);
      
      const { data: notifData, error: notifError } = await supabase
        .from('notifications')
        .insert([notificationPayload])
        .select();

      if (notifError) {
        console.error('Failed to create notification:', notifError);
      } else {
        console.log('Notification created successfully:', notifData);
      }
    } catch (notifException) {
      console.error('Error creating notification:', notifException);
    }

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
