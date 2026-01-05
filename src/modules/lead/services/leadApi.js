// File: src/modules/lead/services/leadApi.js
import { supabase } from '@/lib/customSupabaseClient';

// ============ HELPER FUNCTIONS ============

// Get current vendor ID
const getVendorId = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data: vendor } = await supabase
    .from('vendors')
    .select('id')
    .eq('user_id', user.id)
    .single();
  if (!vendor?.id) throw new Error('Vendor profile not found');
  return vendor.id;
};

const calculateDaysLeft = (endDate) => {
  if (!endDate) return 0;
  const end = new Date(endDate);
  const now = new Date();
  const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  return Math.max(0, daysLeft);
};

const isSubscriptionActive = (subscription) => {
  if (!subscription) return false;
  if (subscription.status !== 'ACTIVE') return false;
  const daysLeft = calculateDaysLeft(subscription.end_date);
  return daysLeft > 0;
};

export const leadApi = {
  // --- LEADS API ---
  list: async (filters = {}) => {
    let query = supabase
      .from('leads')
      .select('*');

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.vendorId) query = query.eq('vendor_id', filters.vendorId);
    if (filters.category) query = query.eq('category', filters.category);

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(filters.limit || 100);
    if (error) throw error;
    return data || [];
  },

  listActive: async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('status', 'AVAILABLE')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return data || [];
  },

  listByVendor: async (vendorId) => {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  get: async (id) => {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  create: async (leadData) => {
    const { data, error } = await supabase
      .from('leads')
      .insert([{
        ...leadData,
        status: leadData.status || 'AVAILABLE',
        created_at: new Date().toISOString()
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  update: async (id, updates) => {
    const { data, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  updateStatus: async (id, status) => {
    const validStatuses = ['AVAILABLE', 'PENDING', 'CONVERTED', 'CLOSED'];
    if (!validStatuses.includes(status)) throw new Error(`Invalid status: ${status}`);

    const { data, error } = await supabase
      .from('leads')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  delete: async (id) => {
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (error) throw error;
  },

  // --- LEAD CONTACTS API ---
  contacts: {
    list: async (leadId) => {
      const { data, error } = await supabase
        .from('lead_contacts')
        .select('*')
        .eq('lead_id', leadId)
        .order('contact_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    getByVendor: async (vendorId, leadId) => {
      const { data, error } = await supabase
        .from('lead_contacts')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('lead_id', leadId)
        .order('contact_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    create: async (leadId, vendorId, contactData) => {
      const { data, error } = await supabase
        .from('lead_contacts')
        .insert([{
          lead_id: leadId,
          vendor_id: vendorId,
          contact_type: contactData.contact_type,
          contact_date: contactData.contact_date || new Date().toISOString(),
          notes: contactData.notes || '',
          status: contactData.status || 'PENDING',
          created_at: new Date().toISOString()
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    update: async (id, updates) => {
      const { data, error } = await supabase
        .from('lead_contacts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    updateStatus: async (id, status) => {
      const validStatuses = ['PENDING', 'CONNECTED', 'NO_RESPONSE', 'CONVERTED'];
      if (!validStatuses.includes(status)) throw new Error(`Invalid status: ${status}`);

      const { data, error } = await supabase
        .from('lead_contacts')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    delete: async (id) => {
      const { error } = await supabase.from('lead_contacts').delete().eq('id', id);
      if (error) throw error;
    },

    getStats: async (leadId) => {
      const { count: total } = await supabase
        .from('lead_contacts')
        .select('*', { count: 'exact', head: true })
        .eq('lead_id', leadId);

      const { count: converted } = await supabase
        .from('lead_contacts')
        .select('*', { count: 'exact', head: true })
        .eq('lead_id', leadId)
        .eq('status', 'CONVERTED');

      const { count: noResponse } = await supabase
        .from('lead_contacts')
        .select('*', { count: 'exact', head: true })
        .eq('lead_id', leadId)
        .eq('status', 'NO_RESPONSE');

      return {
        total: total || 0,
        converted: converted || 0,
        noResponse: noResponse || 0
      };
    }
  },

  // --- LEAD PURCHASES API ---
  purchases: {
    list: async (vendorId) => {
      // FIX: Don't specify columns to avoid RLS violation
      const { data, error } = await supabase
        .from('lead_purchases')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('purchase_date', { ascending: false });
      if (error) throw error;
      
      // Join with leads manually
      if (data && data.length > 0) {
        for (let i = 0; i < data.length; i++) {
          const { data: lead } = await supabase
            .from('leads')
            .select('*')
            .eq('id', data[i].lead_id)
            .single();
          data[i].lead = lead;
          data[i].leads = lead; // Support both naming conventions
        }
      }
      return data || [];
    },

    get: async (id) => {
      const { data, error } = await supabase
        .from('lead_purchases')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      
      if (data) {
        const { data: lead } = await supabase
          .from('leads')
          .select('*')
          .eq('id', data.lead_id)
          .single();
        data.lead = lead;
        data.leads = lead;
      }
      return data;
    },

    create: async (vendorId, leadId, amount) => {
      // FIX: Check max 5 vendors limit
      const { count: purchaseCount } = await supabase
        .from('lead_purchases')
        .select('*', { count: 'exact', head: true })
        .eq('lead_id', leadId);

      if (purchaseCount >= 5) {
        throw new Error('This lead has reached maximum 5 vendors limit');
      }

      const { data, error } = await supabase
        .from('lead_purchases')
        .insert([{
          vendor_id: vendorId,
          lead_id: leadId,
          amount: amount || 0,
          payment_status: 'COMPLETED',
          purchase_date: new Date().toISOString()
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    delete: async (id) => {
      const { error } = await supabase.from('lead_purchases').delete().eq('id', id);
      if (error) throw error;
    },

    getStats: async (vendorId) => {
      const { count: totalPurchases } = await supabase
        .from('lead_purchases')
        .select('*', { count: 'exact', head: true })
        .eq('vendor_id', vendorId);

      const { data: purchases } = await supabase
        .from('lead_purchases')
        .select('amount')
        .eq('vendor_id', vendorId);

      const totalAmount = purchases?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

      return {
        totalPurchases: totalPurchases || 0,
        totalSpent: totalAmount
      };
    }
  },

  // --- MARKETPLACE API (merged from leadsMarketplaceApi) ---
  marketplace: {
    // Get leads for marketplace (excludes direct leads with vendor_id and purchased leads)
    listAvailable: async () => {
      const vendorId = await getVendorId();
      
      // Get all marketplace leads (where vendor_id is null)
      const { data: available, error: availError } = await supabase
        .from('leads')
        .select('*')
        .eq('status', 'AVAILABLE')
        .is('vendor_id', null) // Only leads without a vendor (true marketplace)
        .order('created_at', { ascending: false })
        .limit(100);

      if (availError) throw availError;

      // Get leads already purchased by this vendor
      const { data: purchases, error: purchError } = await supabase
        .from('lead_purchases')
        .select('lead_id')
        .eq('vendor_id', vendorId);

      if (purchError) throw purchError;

      const purchasedIds = new Set((purchases || []).map(p => p.lead_id));

      // Filter out purchased leads
      return (available || []).filter(l => !purchasedIds.has(l.id));
    },

    // Get buyer-created direct leads (seller receives directly from buyer, not marketplace)
    listDirect: async () => {
      const vendorId = await getVendorId();
      
      // Get leads that were created by this vendor (direct from buyer)
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('status', 'AVAILABLE')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },

    // Get My Leads (purchased + direct + proposals)
    getMyLeads: async () => {
      const vendorId = await getVendorId();

      // Get purchased leads
      const { data: purchases } = await supabase
        .from('lead_purchases')
        .select('*')
        .eq('vendor_id', vendorId);

      const purchasedLeads = purchases ? await Promise.all(
        purchases.map(async (p) => {
          const lead = await leadApi.get(p.lead_id);
          return { ...lead, source: 'Purchased', purchase_date: p.purchase_date };
        })
      ) : [];

      // Get direct leads from buyer
      const { data: direct } = await supabase
        .from('leads')
        .select('*')
        .eq('vendor_id', vendorId);

      const directLeads = (direct || []).map(l => ({ ...l, source: 'Direct', purchase_date: l.created_at }));

      // Combine and sort
      return [...purchasedLeads, ...directLeads].sort((a, b) => 
        new Date(b.created_at || 0) - new Date(a.created_at || 0)
      );
    }
  }
};
