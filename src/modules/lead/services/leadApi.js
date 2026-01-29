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
    lead.category_slug,
    lead.product_interest,
    lead.description,
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
    headIdSet: new Set(),
    subIdSet: new Set(),
    stateSet: new Set(),
    citySet: new Set(),
    stateIdSet: new Set(),
    cityIdSet: new Set(),
    autoLeadFilter: true,
    minBudget: null,
    maxBudget: null,
  };

  try {
    const { data: prefs } = await supabase
      .from('vendor_preferences')
      .select('preferred_micro_categories, preferred_states, preferred_cities, auto_lead_filter, min_budget, max_budget')
      .eq('vendor_id', vendorId)
      .maybeSingle();

    const preferredCategoryIds = prefs?.preferred_micro_categories || [];
    const preferredStateIds = prefs?.preferred_states || [];
    const preferredCityIds = prefs?.preferred_cities || [];

    ctx.autoLeadFilter = prefs?.auto_lead_filter !== false;
    const minBudgetNum = Number(prefs?.min_budget);
    const maxBudgetNum = Number(prefs?.max_budget);
    ctx.minBudget = Number.isFinite(minBudgetNum) ? minBudgetNum : null;
    ctx.maxBudget = Number.isFinite(maxBudgetNum) ? maxBudgetNum : null;

    preferredStateIds.forEach((id) => ctx.stateIdSet.add(id));
    preferredCityIds.forEach((id) => ctx.cityIdSet.add(id));

    if (preferredCategoryIds.length) {
      const { data: prefMicroRows } = await supabase
        .from('micro_categories')
        .select('id, name, sub_categories(id, name, head_categories(id, name))')
        .in('id', preferredCategoryIds);
      prefMicroRows?.forEach((row) => {
        if (row?.id) ctx.microIdSet.add(row.id);
        if (row?.name) ctx.categorySet.add(normalizeText(row.name));
        const sub = row?.sub_categories;
        if (sub?.id) ctx.subIdSet.add(sub.id);
        if (sub?.name) ctx.categorySet.add(normalizeText(sub.name));
        const head = sub?.head_categories;
        if (head?.id) ctx.headIdSet.add(head.id);
        if (head?.name) ctx.categorySet.add(normalizeText(head.name));
      });

      const { data: headCats } = await supabase
        .from('head_categories')
        .select('id, name')
        .in('id', preferredCategoryIds);
      headCats?.forEach((row) => {
        if (row?.id) ctx.headIdSet.add(row.id);
        if (row?.name) ctx.categorySet.add(normalizeText(row.name));
      });
    }

    // Vendor products -> micro category names + product names
    const { data: products } = await supabase
      .from('products')
      .select('name, micro_category_id, head_category_id, sub_category_id')
      .eq('vendor_id', vendorId)
      .eq('status', 'ACTIVE');

    const productNames = dedupe(products?.map((p) => p?.name) || []);
    productNames.forEach((name) => ctx.productSet.add(normalizeText(name)));

    const microIds = dedupe(products?.map((p) => p?.micro_category_id).filter(Boolean) || []);
    microIds.forEach((id) => ctx.microIdSet.add(id));
    const headIds = dedupe(products?.map((p) => p?.head_category_id).filter(Boolean) || []);
    headIds.forEach((id) => ctx.headIdSet.add(id));
    const subIds = dedupe(products?.map((p) => p?.sub_category_id).filter(Boolean) || []);
    subIds.forEach((id) => ctx.subIdSet.add(id));
    if (microIds.length) {
      const { data: productMicroRows } = await supabase
        .from('micro_categories')
        .select('id, name, sub_categories(id, name, head_categories(id, name))')
        .in('id', microIds);

      productMicroRows?.forEach((row) => {
        if (row?.name) ctx.categorySet.add(normalizeText(row.name));
        const sub = row?.sub_categories;
        if (sub?.id) ctx.subIdSet.add(sub.id);
        if (sub?.name) ctx.categorySet.add(normalizeText(sub.name));
        const head = sub?.head_categories;
        if (head?.id) ctx.headIdSet.add(head.id);
        if (head?.name) ctx.categorySet.add(normalizeText(head.name));
      });
    }

    if (preferredStateIds.length) {
      const { data: stateRows } = await supabase
        .from('states')
        .select('id, name')
        .in('id', preferredStateIds);
      stateRows?.forEach((row) => {
        if (row?.id) ctx.stateIdSet.add(row.id);
        if (row?.name) ctx.stateSet.add(normalizeText(row.name));
      });
    }

    if (preferredCityIds.length) {
      const { data: cityRows } = await supabase
        .from('cities')
        .select('id, name')
        .in('id', preferredCityIds);
      cityRows?.forEach((row) => {
        if (row?.id) ctx.cityIdSet.add(row.id);
        if (row?.name) ctx.citySet.add(normalizeText(row.name));
      });
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
      const autoFilter = ctx.autoLeadFilter !== false;
      const shouldFilterCategory = autoFilter && (
        ctx.categorySet.size > 0 ||
        ctx.productSet.size > 0 ||
        ctx.microIdSet.size > 0 ||
        ctx.headIdSet.size > 0 ||
        ctx.subIdSet.size > 0
      );
      const shouldFilterLocation = autoFilter && (
        ctx.stateSet.size > 0 ||
        ctx.citySet.size > 0 ||
        ctx.stateIdSet.size > 0 ||
        ctx.cityIdSet.size > 0
      );
      const shouldFilterBudget = autoFilter && (
        Number.isFinite(ctx.minBudget) ||
        Number.isFinite(ctx.maxBudget)
      );
      
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
        const headHit = lead?.head_category_id && ctx.headIdSet.has(lead.head_category_id);
        const subHit = lead?.sub_category_id && ctx.subIdSet.has(lead.sub_category_id);
        const categoryMatch = microHit || headHit || subHit || categoryHit || productHit;

        if (shouldFilterCategory && !categoryMatch) return false;

        if (shouldFilterLocation) {
          const locText = normalizeText(lead?.location);
          const leadCityId = lead?.city_id || lead?.cityId || null;
          const leadStateId = lead?.state_id || lead?.stateId || null;

          const { city, state } = extractLocation(lead);
          const nCity = normalizeText(city);
          const nState = normalizeText(state);

          const cityIdMatch = ctx.cityIdSet.size
            ? (leadCityId && ctx.cityIdSet.has(leadCityId)) ||
              (locText && [...ctx.cityIdSet].some((id) => locText.includes(normalizeText(id))))
            : true;
          const stateIdMatch = ctx.stateIdSet.size
            ? (leadStateId && ctx.stateIdSet.has(leadStateId)) ||
              (locText && [...ctx.stateIdSet].some((id) => locText.includes(normalizeText(id))))
            : true;

          const cityNameMatch = ctx.citySet.size
            ? (nCity && matchesAny([nCity], ctx.citySet))
            : true;
          const stateNameMatch = ctx.stateSet.size
            ? (nState && matchesAny([nState], ctx.stateSet))
            : true;

          const cityMatch = (ctx.cityIdSet.size || ctx.citySet.size)
            ? (cityIdMatch || cityNameMatch)
            : true;
          const stateMatch = (ctx.stateIdSet.size || ctx.stateSet.size)
            ? (stateIdMatch || stateNameMatch)
            : true;

          if (!cityMatch || !stateMatch) return false;
        }

        if (shouldFilterBudget) {
          const budgetVal = Number.parseFloat(lead?.budget);
          if (Number.isFinite(ctx.minBudget) && Number.isFinite(budgetVal) && budgetVal < ctx.minBudget) {
            return false;
          }
          if (Number.isFinite(ctx.maxBudget) && Number.isFinite(budgetVal) && budgetVal > ctx.maxBudget) {
            return false;
          }
        }

        return true;
      });

      // If vendor set prefs/products/coverage, return filtered list.
      // If not, return all unpurchased leads (keeps marketplace visible for new vendors).
      if (shouldFilterCategory || shouldFilterLocation || shouldFilterBudget) return filtered;

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
