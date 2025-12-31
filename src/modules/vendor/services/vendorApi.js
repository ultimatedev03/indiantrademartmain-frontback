// ✅ File: src/modules/vendor/services/vendorApi.js
import { supabase } from '@/lib/customSupabaseClient';

// ---------------- HELPERS ----------------

// Helper to get current vendor ID based on auth user
const getVendorId = async () => {
  const { data: { user }, error: uErr } = await supabase.auth.getUser();
  if (uErr) throw uErr;
  if (!user) throw new Error('Not authenticated');

  const { data: vendor, error } = await supabase
    .from('vendors')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (error || !vendor) {
    console.warn("Vendor profile not found for user:", user.id, error);
    throw new Error('Vendor profile not found');
  }
  return vendor.id;
};

// Helper for ID Generation
const generateRandomString = (length, chars) => {
  let result = '';
  for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
};

// Helper to generate URL-friendly slug from text
const generateSlug = (text) => {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

// Helper to generate unique slug by appending random string
const generateUniqueSlug = (text) => {
  const baseSlug = generateSlug(text);
  const timestamp = Math.random().toString(36).substring(2, 8);
  return `${baseSlug}-${timestamp}`.substring(0, 100);
};

const generateVendorIdString = (ownerName = '', companyName = '', phone = '') => {
  const digits = '0123456789';

  // First 4 letters of owner name (uppercase), padded with X if needed
  let part1 = ownerName
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 4)
    .padEnd(4, 'X');

  // First 4 letters of company name (uppercase), padded with Z if needed
  let part2 = companyName
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 4)
    .padEnd(4, 'Z');

  // Last 2 digits of phone number, or 2 random digits if not available
  let part3 = phone ? phone.replace(/\D/g, '').slice(-2).padStart(2, '0') : generateRandomString(2, digits);

  // 2 random digits
  const part4 = generateRandomString(2, digits);

  return `${part1}-V-${part2}-${part3}${part4}`;
};

// Convert camelCase -> snake_case
const toSnake = (key) => key.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');

// ---------------- API ----------------

export const vendorApi = {
  // --- LOCATION API ---
  getStates: async () => {
    const { data, error } = await supabase
      .from('states')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return data || [];
  },

  getCities: async (stateId) => {
    if (!stateId) return [];
    const { data, error } = await supabase
      .from('cities')
      .select('id, name')
      .eq('state_id', stateId)
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return data || [];
  },

  // --- UTILS ---
  generateVendorId: async (phone = '') => {
    let unique = false;
    let newId = '';
    let attempts = 0;

    while (!unique && attempts < 10) {
      newId = generateVendorIdString('', '', phone);

      const { data, error } = await supabase
        .from('vendors')
        .select('id')
        .eq('vendor_id', newId)
        .maybeSingle();

      if (error) throw error;
      if (!data) unique = true;
      attempts++;
    }

    if (!unique) throw new Error("Failed to generate unique Vendor ID");
    return newId;
  },

  getVendorByUserId: async (userId) => {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  // --- REGISTRATION & VERIFICATION ---
  registerVendor: async (payload) => {
    const {
      userId,
      companyName,
      gstNumber,
      address,
      ownerName,
      email,
      phone,
      stateId,
      cityId,
      stateName,
      cityName
    } = payload;

    const { data: existing, error: exErr } = await supabase
      .from('vendors')
      .select('id, vendor_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (exErr) throw exErr;

    let vendorId = existing?.vendor_id;

    if (!vendorId || vendorId.includes('-') === false) {
      let unique = false;
      let attempts = 0;

      while (!unique && attempts < 10) {
        vendorId = generateVendorIdString(ownerName, companyName, phone);

        const { data: already, error } = await supabase
          .from('vendors')
          .select('id')
          .eq('vendor_id', vendorId)
          .maybeSingle();

        if (error) throw error;
        if (!already) unique = true;
        attempts++;
      }

      if (!unique) throw new Error("Failed to generate unique Vendor ID");
    }

    const vendorData = {
      company_name: companyName,
      gst_number: gstNumber,
      address: address,
      registered_address: address,
      owner_name: ownerName,
      email: email,
      phone: phone,
      state_id: stateId || null,
      city_id: cityId || null,
      state: stateName,
      city: cityName,
      kyc_status: 'PENDING',
      profile_completion: 40,
      updated_at: new Date().toISOString(),
      vendor_id: vendorId
    };

    if (existing) {
      const { error } = await supabase
        .from('vendors')
        .update(vendorData)
        .eq('id', existing.id);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('vendors')
        .insert([{
          user_id: userId,
          ...vendorData,
          is_active: false,
          is_verified: false
        }]);

      if (error) throw error;
    }
  },

  updateVendorVerification: async (userId, isVerified) => {
    const updates = {
      is_verified: isVerified,
      verified_at: isVerified ? new Date().toISOString() : null,
      is_active: isVerified
    };

    const { data, error } = await supabase
      .from('vendors')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // --- AUTH & PROFILE ---
  auth: {
    // ✅ FIXED: we do NOT spread full auth user object (confirmed_at/is_anonymous etc won’t leak to UI draft)
    me: async () => {
      const { data: { user }, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      if (!user) return null;

      const { data: vendor, error: vErr } = await supabase
        .from('vendors')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (vErr) throw vErr;

      const transformedVendor = vendor ? {
        ...vendor,

        // camel aliases (optional)
        companyName: vendor.company_name,
        ownerName: vendor.owner_name,
        gstNumber: vendor.gst_number,
        panNumber: vendor.pan_number,
        aadharNumber: vendor.aadhar_number,
        websiteUrl: vendor.website_url,
        primaryBusinessType: vendor.primary_business_type,
        annualTurnover: vendor.annual_turnover,
        registeredAddress: vendor.registered_address,
        stateId: vendor.state_id,
        cityId: vendor.city_id,
        vendorId: vendor.vendor_id || null,
        profileImage: vendor.profile_image,
        kycStatus: vendor.kyc_status,
        kycDocs: vendor.kyc_docs,
        profileCompletion: vendor.profile_completion,
        isVerified: vendor.is_verified,
        isActive: vendor.is_active,
        verifiedAt: vendor.verified_at,
        createdAt: vendor.created_at,
        updatedAt: vendor.updated_at,

        secondaryEmail: vendor.secondary_email,
        secondaryPhone: vendor.secondary_phone,
        landlineNumber: vendor.landline_number,
        cinNumber: vendor.cin_number,
        llpinNumber: vendor.llpin_number,
        iecCode: vendor.iec_code,
        yearOfEstablishment: vendor.year_of_establishment,
        ownerDesignation: vendor.owner_designation,
      } : null;

      // ✅ Return safe auth + vendor data
      return {
        user_id: user.id,
        email: vendor?.email || user.email || null,
        phone: vendor?.phone || user.phone || null,
        ...transformedVendor
      };
    },

    logout: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },

    // ✅ FIXED: auth fields will NEVER go into vendors update
    updateProfile: async (updates) => {
      const vendorId = await getVendorId();

      // ✅ auth-only keys must never go to vendors table
      const BLOCK = new Set([
        'id', 'user_id', 'aud', 'role', 'created_at', 'updated_at',
        'confirmed_at', 'email_confirmed_at', 'last_sign_in_at', 'phone_confirmed_at',
        'app_metadata', 'user_metadata', 'identities', 'factors',
        'is_anonymous' // ✅ IMPORTANT (your current error)
      ]);

      const safeUpdates = Object.fromEntries(
        Object.entries(updates || {}).filter(([k]) => !BLOCK.has(k))
      );

      // Build DB update in snake_case
      const dbUpdates = {};
      for (const [key, value] of Object.entries(safeUpdates)) {
        // if already snake_case keep it
        if (key.includes('_')) dbUpdates[key] = value;
        else dbUpdates[toSnake(key)] = value;
      }

      // always touch updated_at (optional)
      dbUpdates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('vendors')
        .update(dbUpdates)
        .eq('id', vendorId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    uploadImage: async (file, bucket = 'avatars') => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
      return data.publicUrl;
    }
  },

  // --- ✅ NOTIFICATIONS API ---
  notifications: {
    list: async (limit = 8) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },

    unreadCount: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
      return count || 0;
    },

    markAsRead: async (id) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (error) throw error;
    },

    markAllAsRead: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
    }
  },

  // --- VENDOR PROFILE API ---
  getVendorProfile: async (userId) => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  updateVendorProfile: async (userId, updates) => {
    const { data, error } = await supabase
      .from('vendors')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // --- VENDOR DOCUMENTS API ---
  documents: {
    upload: async (file, type) => {
      const vendorId = await getVendorId();
      const fileExt = file.name.split('.').pop();
      const fileName = `vendor-docs/${vendorId}/${type}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: false });

      if (uploadError) throw new Error(`Failed to upload file: ${uploadError.message}`);

      const { data: publicUrl } = supabase.storage.from('avatars').getPublicUrl(fileName);

      const { data, error } = await supabase
        .from('vendor_documents')
        .insert([{
          vendor_id: vendorId,
          document_type: type,
          document_url: publicUrl.publicUrl,
          original_name: file.name,
          uploaded_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw new Error(`Failed to save document: ${error.message}`);
      return data;
    },

    list: async () => {
      const vendorId = await getVendorId();
      const { data, error } = await supabase
        .from('vendor_documents')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    delete: async (id) => {
      const { error } = await supabase.from('vendor_documents').delete().eq('id', id);
      if (error) throw error;
    }
  },

  // --- VENDOR MESSAGES API ---
  messages: {
    list: async () => {
      const vendorId = await getVendorId();
      const { data, error } = await supabase
        .from('vendor_messages')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    markAsRead: async (id) => {
      const { error } = await supabase
        .from('vendor_messages')
        .update({ is_read: true })
        .eq('id', id);
      if (error) throw error;
    },

    sendReply: async (id) => {
      const { error } = await supabase
        .from('vendor_messages')
        .update({ is_replied: true })
        .eq('id', id);
      if (error) throw error;
      return true;
    },

    delete: async (id) => {
      const { error } = await supabase.from('vendor_messages').delete().eq('id', id);
      if (error) throw error;
    }
  },

  // --- PRODUCTS API ---
  products: {
    list: async () => {
      const vendorId = await getVendorId();
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    get: async (id) => {
      const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },

    create: async (productData) => {
      const vendorId = await getVendorId();
      const slug = generateUniqueSlug(productData.name);
      const { data, error } = await supabase
        .from('products')
        .insert([{ ...productData, vendor_id: vendorId, slug }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    update: async (id, updates) => {
      const updateData = { ...updates };
      if (updates.name) updateData.slug = generateUniqueSlug(updates.name);
      const { data, error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    delete: async (id) => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },

    getAllMicroCategories: async () => {
      const { data, error } = await supabase
        .from('micro_categories')
        .select(`
          id, name, slug, description,
          sub_categories(id, name, slug, head_categories(id, name, slug))
        `)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data || [];
    },

    matchCategory: async (name) => {
      if (!name || name.length < 3) return null;

      const { data: exactMatch, error: e1 } = await supabase
        .from('micro_categories')
        .select(`
          id, name, slug,
          sub_categories(id, name, slug, head_categories(id, name, slug))
        `)
        .ilike('name', `${name}%`)
        .limit(1)
        .maybeSingle();

      if (e1) throw e1;

      if (exactMatch) {
        return {
          confidence: 95,
          micro_category_id: exactMatch.id,
          name: exactMatch.name,
          slug: exactMatch.slug,
          sub_category_id: exactMatch.sub_categories?.id,
          head_category_id: exactMatch.sub_categories?.head_categories?.id,
          path: `${exactMatch.sub_categories?.head_categories?.name} > ${exactMatch.sub_categories?.name} > ${exactMatch.name}`,
          matchScore: 95
        };
      }

      const { data: allCategories, error } = await supabase
        .from('micro_categories')
        .select(`
          id, name, slug, description,
          sub_categories(id, name, slug, head_categories(id, name, slug))
        `)
        .eq('is_active', true)
        .limit(200);

      if (error || !allCategories) return null;

      try {
        const { findBestMatchingCategory, isStrongMatch } = await import('@/shared/utils/categoryMatcher');
        const match = findBestMatchingCategory(name, allCategories);
        if (!match) return null;

        const category = match.category;
        const score = match.score;

        return {
          confidence: Math.round(score * 100),
          micro_category_id: category.id,
          name: category.name,
          slug: category.slug,
          sub_category_id: category.sub_categories?.id,
          head_category_id: category.sub_categories?.head_categories?.id,
          path: `${category.sub_categories?.head_categories?.name} > ${category.sub_categories?.name} > ${category.name}`,
          matchScore: Math.round(score * 100),
          isStrong: isStrongMatch(score)
        };
      } catch (e) {
        console.error('Category match error:', e);
        return null;
      }
    }
  },

  // --- PROPOSALS API ---
  proposals: {
    list: async (type = 'received') => {
      const vendorId = await getVendorId();
      
      if (type === 'sent') {
        // Get quotations sent by this vendor
        const { data, error } = await supabase
          .from('proposals')
          .select('*, buyers(full_name, company_name)')
          .eq('vendor_id', vendorId)
          .eq('status', 'SENT')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
      } else {
        // Get requests/quotations received (from leads)
        const { data, error } = await supabase
          .from('proposals')
          .select('*, buyers(full_name, company_name)')
          .eq('vendor_id', vendorId)
          .neq('status', 'SENT')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
      }
    },

    create: async (quotationData) => {
      const vendorId = await getVendorId();
      const { data, error } = await supabase
        .from('proposals')
        .insert([{
          vendor_id: vendorId,
          title: quotationData.title || quotationData.quotation_title,
          product_name: quotationData.product_name || quotationData.quotation_title,
          quantity: quotationData.quantity || null,
          budget: quotationData.budget || quotationData.quotation_amount,
          description: quotationData.description || quotationData.terms_conditions || '',
          status: quotationData.status || 'SENT',
          buyer_id: quotationData.buyer_id || null
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  },

  // --- LEADS API ---
  leads: {
    getMarketplaceLeads: async () => {
      const vendorId = await getVendorId();
      const { data: purchased, error: pErr } = await supabase
        .from('lead_purchases')
        .select('lead_id')
        .eq('vendor_id', vendorId);

      if (pErr) throw pErr;

      const purchasedIds = purchased?.map(p => p.lead_id) || [];

      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('status', 'ACTIVE')
        .neq('vendor_id', vendorId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []).filter(l => !purchasedIds.includes(l.id));
    },

    getMyLeads: async () => {
      const vendorId = await getVendorId();

      const { data: purchases, error: pError } = await supabase
        .from('lead_purchases')
        .select('*, lead:leads(*)')
        .eq('vendor_id', vendorId);

      if (pError) throw pError;

      const { data: direct, error: dError } = await supabase
        .from('leads')
        .select('*')
        .eq('vendor_id', vendorId);

      if (dError) throw dError;

      const purchasedLeads = (purchases || []).map(p => ({ ...p.lead, source: 'Purchased', purchase_date: p.purchase_date }));
      const directLeads = (direct || []).map(l => ({ ...l, source: 'Direct', purchase_date: l.created_at }));

      return [...purchasedLeads, ...directLeads].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    },

    purchase: async (leadId) => {
      const vendorId = await getVendorId();
      const { data: lead, error: lErr } = await supabase.from('leads').select('price').eq('id', leadId).single();
      if (lErr) throw lErr;

      const { data, error } = await supabase
        .from('lead_purchases')
        .insert([{
          vendor_id: vendorId,
          lead_id: leadId,
          amount: lead?.price || 0,
          payment_status: 'COMPLETED',
          purchase_date: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  },

  // --- DASHBOARD STATS ---
  dashboard: {
    getStats: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: vendor, error: vendorError } = await supabase
        .from('vendors')
        .select('id, profile_completion, kyc_status, vendor_id')
        .eq('user_id', user.id)
        .single();

      if (vendorError || !vendor) {
        console.error('Vendor not found:', vendorError);
        return {
          totalProducts: 0,
          totalLeads: 0,
          totalMessages: 0,
          profileCompletion: 0,
          kycStatus: 'PENDING',
          trustScore: 0,
          rating: 0
        };
      }

      const [products, leads, messages] = await Promise.all([
        supabase.from('products').select('*', { count: 'exact' }).eq('vendor_id', vendor.id).limit(1),
        supabase.from('leads').select('*', { count: 'exact' }).eq('vendor_id', vendor.id).eq('status', 'AVAILABLE').limit(1),
        supabase.from('vendor_messages').select('*', { count: 'exact' }).eq('vendor_id', vendor.id).limit(1)
      ]);

      return {
        totalProducts: products.count || 0,
        totalLeads: leads.count || 0,
        totalMessages: messages.count || 0,
        profileCompletion: vendor.profile_completion || 0,
        kycStatus: vendor.kyc_status || 'PENDING',
        trustScore: 0,
        rating: 0,
        vendorId: vendor.vendor_id
      };
    }
  },

  getRecentProducts: async (userId) => {
    const { data: vendor, error: vErr } = await supabase.from('vendors').select('id').eq('user_id', userId).single();
    if (vErr) throw vErr;
    if (!vendor) return [];
    const { data, error } = await supabase.from('products').select('*').eq('vendor_id', vendor.id).order('created_at', { ascending: false }).limit(5);
    if (error) throw error;
    return data || [];
  },

  getRecentLeads: async (userId) => {
    const { data: vendor, error: vErr } = await supabase.from('vendors').select('id').eq('user_id', userId).single();
    if (vErr) throw vErr;
    if (!vendor) return [];
    const { data, error } = await supabase.from('leads').select('*').eq('vendor_id', vendor.id).order('created_at', { ascending: false }).limit(5);
    if (error) throw error;
    return data || [];
  },

  getSupportStats: async (userId) => {
    const { data: vendor, error: vErr } = await supabase.from('vendors').select('id').eq('user_id', userId).single();
    if (vErr) throw vErr;
    if (!vendor) return { total: 0, unresolved: 0 };

    const { count, error: e1 } = await supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('vendor_id', vendor.id);
    if (e1) throw e1;

    const { count: open, error: e2 } = await supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('vendor_id', vendor.id).neq('status', 'CLOSED');
    if (e2) throw e2;

    return { total: count || 0, unresolved: open || 0 };
  },

  // --- BANKING API ---
  banking: {
    list: async () => {
      const vendorId = await getVendorId();
      const { data, error } = await supabase
        .from('vendor_bank_details')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    add: async (bankData) => {
      const vendorId = await getVendorId();
      const { data, error } = await supabase
        .from('vendor_bank_details')
        .insert([{ ...bankData, vendor_id: vendorId }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    delete: async (id) => {
      const { error } = await supabase.from('vendor_bank_details').delete().eq('id', id);
      if (error) throw error;
    }
  },

  // --- SUBSCRIPTIONS ---
  subscriptions: {
    getCurrent: async () => {
      const vendorId = await getVendorId();
      const { data, error } = await supabase
        .from('vendor_plan_subscriptions')
        .select('*, plan:vendor_plans(*)')
        .eq('vendor_id', vendorId)
        .eq('status', 'ACTIVE')
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    getQuota: async () => {
      const vendorId = await getVendorId();
      const { data, error } = await supabase
        .from('vendor_lead_quota')
        .select('*')
        .eq('vendor_id', vendorId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    subscribe: async (planId) => {
      const vendorId = await getVendorId();
      const { data, error } = await supabase
        .from('vendor_plan_subscriptions')
        .insert([{
          vendor_id: vendorId,
          plan_id: planId,
          status: 'ACTIVE'
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },

  // --- PREFERENCES API ---
  preferences: {
    get: async () => {
      const vendorId = await getVendorId();
      const { data, error } = await supabase
        .from('vendor_preferences')
        .select('*')
        .eq('vendor_id', vendorId)
        .maybeSingle();
      if (error) throw error;
      return data || {
        vendor_id: vendorId,
        preferred_micro_categories: [],
        preferred_states: [],
        preferred_cities: [],
        min_budget: 0,
        max_budget: 999999,
        auto_lead_filter: true
      };
    },

    update: async (preferencesData) => {
      const vendorId = await getVendorId();
      const { data: existing } = await supabase
        .from('vendor_preferences')
        .select('id')
        .eq('vendor_id', vendorId)
        .maybeSingle();

      if (existing?.id) {
        // Update existing
        const { data, error } = await supabase
          .from('vendor_preferences')
          .update({
            ...preferencesData,
            updated_at: new Date().toISOString()
          })
          .eq('vendor_id', vendorId)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('vendor_preferences')
          .insert([{
            vendor_id: vendorId,
            ...preferencesData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },

    getStats: async () => {
      const vendorId = await getVendorId();
      const { data: prefs } = await supabase
        .from('vendor_preferences')
        .select('preferred_states, preferred_cities, preferred_micro_categories')
        .eq('vendor_id', vendorId)
        .maybeSingle();

      if (!prefs) return { vendorsInMyState: 0, vendorsInMyCity: 0, vendorsInMyCategories: 0 };

      // Count vendors in my states
      let vendorsInState = 0;
      if (prefs.preferred_states?.length > 0) {
        const stateIds = prefs.preferred_states;
        const { count } = await supabase
          .from('vendor_preferences')
          .select('*', { count: 'exact', head: true })
          .or(stateIds.map((id, idx) => `preferred_states.contains.${JSON.stringify([id])}`).join(','));
        vendorsInState = count || 0;
      }

      // Count vendors in my cities
      let vendorsInCity = 0;
      if (prefs.preferred_cities?.length > 0) {
        const cityIds = prefs.preferred_cities;
        const { count } = await supabase
          .from('vendor_preferences')
          .select('*', { count: 'exact', head: true })
          .or(cityIds.map((id, idx) => `preferred_cities.contains.${JSON.stringify([id])}`).join(','));
        vendorsInCity = count || 0;
      }

      // Count vendors in my categories
      let vendorsInCategories = 0;
      if (prefs.preferred_micro_categories?.length > 0) {
        const catIds = prefs.preferred_micro_categories;
        const { count } = await supabase
          .from('vendor_preferences')
          .select('*', { count: 'exact', head: true })
          .or(catIds.map((id, idx) => `preferred_micro_categories.contains.${JSON.stringify([id])}`).join(','));
        vendorsInCategories = count || 0;
      }

      return {
        vendorsInMyState: vendorsInState,
        vendorsInMyCity: vendorsInCity,
        vendorsInMyCategories: vendorsInCategories
      };
    }
  },

  // --- SUPPORT API ---
  support: {
    getTickets: async () => {
      const vendorId = await getVendorId();
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    createTicket: async (ticketData) => {
      const vendorId = await getVendorId();
      const { data, error } = await supabase
        .from('support_tickets')
        .insert([{
          vendor_id: vendorId,
          subject: ticketData.subject,
          description: ticketData.description,
          category: ticketData.category || 'General Inquiry',
          priority: ticketData.priority || 'Medium',
          status: 'OPEN'
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    getTicketDetail: async (id) => {
      const { data: ticket, error: ticketError } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('id', id)
        .single();
      if (ticketError) throw ticketError;

      const { data: messages, error: messagesError } = await supabase
        .from('ticket_messages')
        .select('*')
        .eq('ticket_id', id)
        .order('created_at', { ascending: true });
      if (messagesError) throw messagesError;

      return { ...ticket, messages: messages || [] };
    },

    addMessage: async (ticketId, message) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('ticket_messages')
        .insert([{
          ticket_id: ticketId,
          sender_id: user.id,
          sender_type: 'VENDOR',
          message: message
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    getMessages: async (ticketId) => {
      const { data, error } = await supabase
        .from('ticket_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },

    sendMessage: async (ticketId, message) => {
      await vendorApi.support.addMessage(ticketId, message);
    }
  },

  // --- KYC ---
  kyc: {
    getStatus: async () => {
      const vendorId = await getVendorId();
      const { data, error } = await supabase
        .from('vendors')
        .select('kyc_status, kyc_docs')
        .eq('id', vendorId)
        .single();
      if (error) throw error;

      const docs = data?.kyc_docs || {};

      return {
        status: data?.kyc_status || 'PENDING',
        documents: {
          pan: docs.pan || false,
          gst: docs.gst || false,
          businessProof: docs.businessProof || false,
          bankProof: docs.bankProof || false
        }
      };
    },

    uploadDoc: async (type, file) => {
      const vendorId = await getVendorId();
      const fileExt = file.name.split('.').pop();
      const fileName = `vendor-kyc/${vendorId}/${type}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);

      const { data, error: e1 } = await supabase.from('vendors').select('kyc_docs').eq('id', vendorId).single();
      if (e1) throw e1;

      const currentDocs = data?.kyc_docs || {};

      const { error: e2 } = await supabase.from('vendors').update({
        kyc_docs: { ...currentDocs, [type]: true, [`${type}_url`]: publicUrl }
      }).eq('id', vendorId);

      if (e2) throw e2;
    },

    submit: async () => {
      const vendorId = await getVendorId();
      const { error } = await supabase.from('vendors').update({ kyc_status: 'SUBMITTED' }).eq('id', vendorId);
      if (error) throw error;
    }
  }
};
