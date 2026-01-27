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

// ------------ Lead filtering helpers ------------
const normalizeText = (value) =>
  (value || '')
    .toString()
    .toLowerCase()
    .trim();

const dedupe = (arr = []) => Array.from(new Set(arr.filter(Boolean)));

// Pull city/state out of common lead fields
const extractLocation = (lead = {}) => {
  const city = (lead.city || lead.city_name || '').toString().trim();
  const state = (lead.state || lead.state_name || '').toString().trim();

  if (city || state) return { city, state };

  const raw = (lead.location || '').toString();
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return { city: parts[0], state: parts.slice(1).join(', ') };
  if (parts.length === 1) return { city: parts[0], state: '' };
  return { city: '', state: '' };
};

const buildLeadTokens = (lead = {}) =>
  dedupe([
    lead.category,
    lead.category_name,
    lead.head_category,
    lead.sub_category,
    lead.product_name,
    lead.product,
    lead.service_name,
    lead.title,
    lead.requirement_title,
  ].map(normalizeText));

const fuzzyMatch = (value, target) => {
  if (!value || !target) return false;
  return value.includes(target) || target.includes(value);
};

const matchesAny = (leadTokens, allowedSet) => {
  if (!allowedSet || allowedSet.size === 0) return false;
  for (const token of leadTokens) {
    for (const allowed of allowedSet) {
      if (fuzzyMatch(token, allowed)) return true;
    }
  }
  return false;
};

// Load vendor-selected categories/products/states/cities for filtering
const loadVendorLeadContext = async (vendorId) => {
  const ctx = {
    categorySet: new Set(),
    productSet: new Set(),
    microIdSet: new Set(),
    stateSet: new Set(),
    citySet: new Set(),
  };

  try {
    const { data: prefs } = await supabase
      .from('vendor_preferences')
      .select('preferred_micro_categories, preferred_states, preferred_cities')
      .eq('vendor_id', vendorId)
      .maybeSingle();

    const preferredCategoryIds = prefs?.preferred_micro_categories || [];
    const preferredStateIds = prefs?.preferred_states || [];
    const preferredCityIds = prefs?.preferred_cities || [];

    if (preferredCategoryIds.length) {
      const { data: microRows } = await supabase
        .from('micro_categories')
        .select('id, name, sub_categories(head_categories(name))')
        .in('id', preferredCategoryIds);
      microRows?.forEach((row) => {
        ctx.microIdSet.add(row.id);
        if (row?.name) ctx.categorySet.add(normalizeText(row.name));
        const headName = row?.sub_categories?.head_categories?.name;
        if (headName) ctx.categorySet.add(normalizeText(headName));
      });

      const { data: headCats } = await supabase
        .from('head_categories')
        .select('id, name')
        .in('id', preferredCategoryIds);
      headCats?.forEach((row) => row?.name && ctx.categorySet.add(normalizeText(row.name)));
    }

    // Vendor products -> micro category names + product names
    const { data: products } = await supabase
      .from('products')
      .select('name, micro_category_id')
      .eq('vendor_id', vendorId)
      .eq('status', 'ACTIVE');

    const productNames = dedupe(products?.map((p) => p?.name) || []);
    productNames.forEach((name) => ctx.productSet.add(normalizeText(name)));

    const microIds = dedupe(products?.map((p) => p?.micro_category_id).filter(Boolean) || []);
    microIds.forEach((id) => ctx.microIdSet.add(id));
    if (microIds.length) {
      const { data: microRows } = await supabase
        .from('micro_categories')
        .select('id, name, sub_categories(head_categories(name))')
        .in('id', microIds);

      microRows?.forEach((row) => {
        if (row?.name) ctx.categorySet.add(normalizeText(row.name));
        const headName = row?.sub_categories?.head_categories?.name;
        if (headName) ctx.categorySet.add(normalizeText(headName));
      });
    }

    if (preferredStateIds.length) {
      const { data: stateRows } = await supabase
        .from('states')
        .select('id, name')
        .in('id', preferredStateIds);
      stateRows?.forEach((row) => row?.name && ctx.stateSet.add(normalizeText(row.name)));
    }

    if (preferredCityIds.length) {
      const { data: cityRows } = await supabase
        .from('cities')
        .select('id, name')
        .in('id', preferredCityIds);
      cityRows?.forEach((row) => row?.name && ctx.citySet.add(normalizeText(row.name)));
    }
  } catch (e) {
    console.error('[leadApi] Failed to load vendor lead context:', e);
  }

  return ctx;
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
      const ctx = await loadVendorLeadContext(vendorId);
      const shouldFilterCategory = ctx.categorySet.size > 0 || ctx.productSet.size > 0;
      const shouldFilterLocation = ctx.stateSet.size > 0 || ctx.citySet.size > 0;
      
      // Get all marketplace leads (where vendor_id is null)
      const { data: available, error: availError } = await supabase
        .from('leads')
        .select('*')
        .eq('status', 'AVAILABLE')
        .is('vendor_id', null) // Only leads without a vendor (true marketplace)
        .order('created_at', { ascending: false })
        .limit(300);

      if (availError) throw availError;

      // Get leads already purchased by this vendor
      const { data: purchases, error: purchError } = await supabase
        .from('lead_purchases')
        .select('lead_id')
        .eq('vendor_id', vendorId);

      if (purchError) throw purchError;

      const purchasedIds = new Set((purchases || []).map(p => p.lead_id));

      const filtered = (available || []).filter((lead) => {
        if (purchasedIds.has(lead.id)) return false;

        const tokens = buildLeadTokens(lead);
        const categoryHit = matchesAny(tokens, ctx.categorySet);
        const productHit = matchesAny(tokens, ctx.productSet);
        const microHit = lead?.micro_category_id && ctx.microIdSet.has(lead.micro_category_id);

        if (shouldFilterCategory && !(microHit || categoryHit || productHit)) return false;

        if (shouldFilterLocation) {
          const { city, state } = extractLocation(lead);
          const nCity = normalizeText(city);
          const nState = normalizeText(state);

          if (ctx.citySet.size && (!nCity || !matchesAny([nCity], ctx.citySet))) return false;
          if (ctx.stateSet.size && (!nState || !matchesAny([nState], ctx.stateSet))) return false;
        }

        return true;
      });

      // If vendor set prefs/products/coverage, return filtered list.
      // If not, return all unpurchased leads (keeps marketplace visible for new vendors).
      if (shouldFilterCategory || shouldFilterLocation) return filtered;

      return (available || []).filter((lead) => !purchasedIds.has(lead.id));
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
