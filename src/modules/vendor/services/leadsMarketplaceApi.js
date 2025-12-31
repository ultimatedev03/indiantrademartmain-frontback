// Lead Marketplace API - Comprehensive lead discovery and purchase system
import { supabase } from '@/lib/customSupabaseClient';
import { vendorApi } from './vendorApi';

export const leadsMarketplaceApi = {
  // ============ VENDOR PREFERENCES ============
  
  // Get vendor's preferences
  getPreferences: async () => {
    const vendor = await vendorApi.auth.me();
    if (!vendor?.id) throw new Error('Vendor not found');
    
    const { data, error } = await supabase
      .from('vendor_preferences')
      .select('*')
      .eq('vendor_id', vendor.id)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  },

  // Save/update vendor preferences
  savePreferences: async (preferences) => {
    const vendor = await vendorApi.auth.me();
    if (!vendor?.id) throw new Error('Vendor not found');

    const { data: existing } = await supabase
      .from('vendor_preferences')
      .select('id')
      .eq('vendor_id', vendor.id)
      .maybeSingle();

    const payloadData = {
      vendor_id: vendor.id,
      preferred_micro_categories: preferences.preferred_micro_categories || [],
      preferred_states: preferences.preferred_states || [],
      preferred_cities: preferences.preferred_cities || [],
      min_budget: preferences.min_budget || 0,
      max_budget: preferences.max_budget || 999999,
      auto_lead_filter: preferences.auto_lead_filter !== false,
      updated_at: new Date().toISOString()
    };

    let result;
    if (existing) {
      const { data, error } = await supabase
        .from('vendor_preferences')
        .update(payloadData)
        .eq('vendor_id', vendor.id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      payloadData.created_at = new Date().toISOString();
      const { data, error } = await supabase
        .from('vendor_preferences')
        .insert([payloadData])
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    return result;
  },

  // ============ LEAD DISCOVERY & FILTERING ============

  // Get available leads filtered by vendor preferences
  getAvailableLeads: async (filters = {}) => {
    const vendor = await vendorApi.auth.me();
    if (!vendor?.id) throw new Error('Vendor not found');

    // Get vendor preferences
    const preferences = await leadsMarketplaceApi.getPreferences();
    
    // Get vendor's quota
    const { data: quota } = await supabase
      .from('vendor_lead_quota')
      .select('*')
      .eq('vendor_id', vendor.id)
      .maybeSingle();

    // Check quota limits
    if (quota) {
      if (quota.daily_limit > 0 && quota.daily_used >= quota.daily_limit) {
        return { data: [], quota, message: 'Daily lead limit reached' };
      }
      if (quota.weekly_limit > 0 && quota.weekly_used >= quota.weekly_limit) {
        return { data: [], quota, message: 'Weekly lead limit reached' };
      }
      if (quota.yearly_limit > 0 && quota.yearly_used >= quota.yearly_limit) {
        return { data: [], quota, message: 'Yearly lead limit reached' };
      }
    }

    // Build filter query
    let query = supabase
      .from('leads')
      .select(`
        id, title, product_name, budget, quantity, 
        location, status, created_at, message,
        buyer_name, buyer_email, buyer_phone, company_name
      `)
      .eq('status', 'AVAILABLE')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days

    // Apply preferences filter if auto-filtering enabled
    if (preferences?.auto_lead_filter) {
      // Note: Since leads table doesn't have micro_category_id, we'll need to match by product_name
      // In production, you'd want to add these foreign keys to leads table
    }

    // Apply custom filters
    if (filters.budget_min) {
      query = query.gte('budget', filters.budget_min);
    }
    if (filters.budget_max) {
      query = query.lte('budget', filters.budget_max);
    }
    if (filters.search) {
      query = query.ilike('product_name', `%${filters.search}%`);
    }

    // Apply pagination
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      data: data || [],
      quota,
      preferences,
      pagination: { page, limit, total: count }
    };
  },

  // Get lead summary (before purchase)
  getLeadSummary: async (leadId) => {
    const { data, error } = await supabase
      .from('leads')
      .select(`
        id, title, product_name, budget, quantity, location,
        created_at, company_name
      `)
      .eq('id', leadId)
      .single();

    if (error) throw error;
    return data;
  },

  // ============ LEAD PURCHASE ============

  // Purchase a lead
  purchaseLead: async (leadId) => {
    const vendor = await vendorApi.auth.me();
    if (!vendor?.id) throw new Error('Vendor not found');

    // Get lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();
    
    if (leadError) throw leadError;
    if (lead.status !== 'AVAILABLE') throw new Error('Lead no longer available');

    // Check if already purchased by this vendor
    const { data: alreadyPurchased } = await supabase
      .from('lead_purchases')
      .select('id')
      .eq('vendor_id', vendor.id)
      .eq('lead_id', leadId)
      .maybeSingle();

    if (alreadyPurchased) throw new Error('You already purchased this lead');

    // Check quota
    const { data: quota } = await supabase
      .from('vendor_lead_quota')
      .select('*')
      .eq('vendor_id', vendor.id)
      .maybeSingle();

    if (quota) {
      if (quota.daily_limit > 0 && quota.daily_used >= quota.daily_limit) {
        throw new Error('Daily lead limit reached');
      }
    }

    // Calculate lead price (placeholder - adjust based on your pricing model)
    const leadPrice = 50; // ₹50 per lead (default)

    // Create purchase record
    const { data: purchase, error: purchaseError } = await supabase
      .from('lead_purchases')
      .insert([{
        vendor_id: vendor.id,
        lead_id: leadId,
        amount: leadPrice,
        payment_status: 'COMPLETED',
        purchase_date: new Date().toISOString()
      }])
      .select()
      .single();

    if (purchaseError) throw purchaseError;

    // Update lead status
    await supabase
      .from('leads')
      .update({ status: 'PURCHASED' })
      .eq('id', leadId);

    // Update quota
    if (quota) {
      await supabase
        .from('vendor_lead_quota')
        .update({
          daily_used: quota.daily_used + 1,
          weekly_used: quota.weekly_used + 1,
          yearly_used: quota.yearly_used + 1,
          updated_at: new Date().toISOString()
        })
        .eq('vendor_id', vendor.id);
    }

    return purchase;
  },

  // ============ PURCHASED LEAD DETAILS ============

  // Get full lead details (only for purchased leads)
  getPurchasedLeadDetails: async (leadId) => {
    const vendor = await vendorApi.auth.me();
    if (!vendor?.id) throw new Error('Vendor not found');

    // Verify purchase
    const { data: purchase, error: purchaseError } = await supabase
      .from('lead_purchases')
      .select('*')
      .eq('vendor_id', vendor.id)
      .eq('lead_id', leadId)
      .maybeSingle();

    if (purchaseError) throw purchaseError;
    if (!purchase) throw new Error('You have not purchased this lead');

    // Get full lead details
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError) throw leadError;

    // Get contact history
    const { data: contacts } = await supabase
      .from('lead_contacts')
      .select('*')
      .eq('vendor_id', vendor.id)
      .eq('lead_id', leadId)
      .order('contact_date', { ascending: false });

    return {
      lead,
      purchase,
      contacts: contacts || [],
      buyer: {
        name: lead.buyer_name,
        email: lead.buyer_email,
        phone: lead.buyer_phone,
        company: lead.company_name
      }
    };
  },

  // ============ CONTACT MANAGEMENT ============

  // Log a contact attempt
  logContact: async (leadId, contactType, notes = '') => {
    const vendor = await vendorApi.auth.me();
    if (!vendor?.id) throw new Error('Vendor not found');

    // Verify purchase
    const { data: purchase } = await supabase
      .from('lead_purchases')
      .select('id')
      .eq('vendor_id', vendor.id)
      .eq('lead_id', leadId)
      .maybeSingle();

    if (!purchase) throw new Error('You have not purchased this lead');

    // Create contact record
    const { data, error } = await supabase
      .from('lead_contacts')
      .insert([{
        vendor_id: vendor.id,
        lead_id: leadId,
        contact_type: contactType, // CALL, WHATSAPP, EMAIL
        status: 'PENDING',
        notes,
        contact_date: new Date().toISOString(),
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update contact status
  updateContactStatus: async (contactId, status, notes = '') => {
    const { data, error } = await supabase
      .from('lead_contacts')
      .update({
        status,
        notes,
        contact_date: new Date().toISOString()
      })
      .eq('id', contactId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get contact history for a lead
  getContactHistory: async (leadId) => {
    const { data, error } = await supabase
      .from('lead_contacts')
      .select('*')
      .eq('lead_id', leadId)
      .order('contact_date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // ============ LEAD HISTORY ============

  // Get all purchased leads
  getPurchasedLeads: async (filters = {}) => {
    const vendor = await vendorApi.auth.me();
    if (!vendor?.id) throw new Error('Vendor not found');

    let query = supabase
      .from('lead_purchases')
      .select(`
        id, lead_id, purchase_date, amount,
        leads (
          id, title, product_name, budget, location,
          buyer_name, buyer_email, company_name
        )
      `)
      .eq('vendor_id', vendor.id);

    // Apply filters
    if (filters.status) {
      query = query.eq('payment_status', filters.status);
    }

    // Apply sorting
    if (filters.sort_by === 'recent') {
      query = query.order('purchase_date', { ascending: false });
    } else if (filters.sort_by === 'oldest') {
      query = query.order('purchase_date', { ascending: true });
    }

    // Pagination
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      data: data || [],
      pagination: { page, limit, total: count }
    };
  },

  // Get lead with contact summary
  getLeadWithContactSummary: async (leadId) => {
    const vendor = await vendorApi.auth.me();
    if (!vendor?.id) throw new Error('Vendor not found');

    // Get lead details
    const { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    // Get contacts
    const { data: contacts } = await supabase
      .from('lead_contacts')
      .select('*')
      .eq('vendor_id', vendor.id)
      .eq('lead_id', leadId);

    // Get last contact
    const lastContact = contacts && contacts.length > 0 ? contacts[0] : null;

    return {
      lead,
      totalContacts: contacts?.length || 0,
      lastContact,
      contactSummary: {
        calls: contacts?.filter(c => c.contact_type === 'CALL').length || 0,
        whatsapp: contacts?.filter(c => c.contact_type === 'WHATSAPP').length || 0,
        emails: contacts?.filter(c => c.contact_type === 'EMAIL').length || 0,
        converted: contacts?.filter(c => c.status === 'CONVERTED').length || 0
      }
    };
  },

  // ============ STATS & ANALYTICS ============

  // Get vendor's lead stats
  getLeadStats: async () => {
    const vendor = await vendorApi.auth.me();
    if (!vendor?.id) throw new Error('Vendor not found');

    // Total purchased
    const { count: totalPurchased } = await supabase
      .from('lead_purchases')
      .select('*', { count: 'exact', head: true })
      .eq('vendor_id', vendor.id);

    // Total contacted
    const { count: totalContacted } = await supabase
      .from('lead_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('vendor_id', vendor.id);

    // Converted
    const { count: converted } = await supabase
      .from('lead_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('vendor_id', vendor.id)
      .eq('status', 'CONVERTED');

    // Get quota
    const { data: quota } = await supabase
      .from('vendor_lead_quota')
      .select('*')
      .eq('vendor_id', vendor.id)
      .maybeSingle();

    return {
      totalPurchased: totalPurchased || 0,
      totalContacted: totalContacted || 0,
      converted: converted || 0,
      conversionRate: totalPurchased ? ((converted || 0) / totalPurchased * 100).toFixed(2) : 0,
      quota: quota || null
    };
  }
};
