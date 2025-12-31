import { supabase } from '@/lib/customSupabaseClient';
import { vendorApi } from './vendorApi';

export const quotationApi = {
  // Send quotation to buyer (registered or not)
  sendQuotation: async (quotationData) => {
    const vendor = await vendorApi.auth.me();
    if (!vendor?.id) throw new Error('Vendor not found');

    try {
      // Call backend API to send quotation with email (using Nodemailer)
      const backendPayload = {
        quotation_title: quotationData.quotation_title,
        quotation_amount: quotationData.quotation_amount,
        quantity: quotationData.quantity || null,
        unit: quotationData.unit || 'pieces',
        validity_days: quotationData.validity_days || 30,
        delivery_days: quotationData.delivery_days || null,
        terms_conditions: quotationData.terms_conditions || '',
        buyer_email: quotationData.buyer_email,
        buyer_id: quotationData.buyer_id || null,
        vendor_id: vendor.id,
        vendor_name: vendor.owner_name,
        vendor_company: vendor.company_name,
        vendor_phone: vendor.phone,
        vendor_email: vendor.email
      };

      // Send via backend (handles email, notification, and database)
      const result = await sendQuotationViaBackend(backendPayload);
      return result;
    } catch (error) {
      console.error('Error sending quotation:', error);
      throw error;
    }
  },

  // Get quotations sent by vendor
  getSentQuotations: async (filters = {}) => {
    const vendor = await vendorApi.auth.me();
    if (!vendor?.id) throw new Error('Vendor not found');

    let query = supabase
      .from('proposals')
      .select('*')
      .eq('vendor_id', vendor.id)
      .eq('status', 'SENT')
      .order('created_at', { ascending: false });

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // Get quotations received by buyer (for buyer dashboard)
  getReceivedQuotations: async (buyerId) => {
    if (!buyerId) throw new Error('Buyer ID required');

    const { data, error } = await supabase
      .from('proposals')
      .select(`
        id, title, budget, quantity, description, status, created_at,
        vendors:vendor_id(id, company_name, owner_name, phone, email)
      `)
      .eq('buyer_id', buyerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get unregistered buyer quotations
  getUnregisteredQuotations: async (email) => {
    if (!email) throw new Error('Email required');

    const { data: unregistered, error: uError } = await supabase
      .from('quotation_unregistered')
      .select(`
        id, quotation_id, created_at,
        proposals(*)
      `)
      .eq('email', email);

    if (uError) throw uError;

    return (unregistered || []).map(item => ({
      ...item.proposals,
      unregisteredId: item.id
    }));
  },

  // Update quotation status
  updateQuotationStatus: async (quotationId, status) => {
    const { data, error } = await supabase
      .from('proposals')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', quotationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};

// Send quotation via Netlify serverless function
async function sendQuotationViaBackend(quotationData) {
  try {
    // Use Netlify serverless function
    const apiUrl = '/.netlify/functions/quotation/send';
    
    console.log('Sending quotation to:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quotationData)
    });

    if (!response.ok) {
      let errorMessage = 'Failed to send quotation';
      try {
        const error = await response.json();
        errorMessage = error.error || errorMessage;
      } catch (e) {
        // Response was not JSON
        errorMessage = `Server error: ${response.status} ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    console.error('Netlify quotation function error:', error);
    throw error;
  }
}
