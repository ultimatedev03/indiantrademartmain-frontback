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

// Calculate profile completion percentage based on filled fields
const calculateProfileCompletion = (vendorData) => {
  const fieldsToCheck = [
    'company_name',
    'owner_name',
    'phone',
    'email',
    'address',
    'gst_number',
    'state',
    'city',
    'website_url',
    'profile_image',
    'primary_business_type',
    'year_of_establishment'
  ];
  
  const filledFields = fieldsToCheck.filter(field => 
    vendorData[field] && 
    vendorData[field].toString().trim() !== '' && 
    vendorData[field] !== null
  ).length;
  
  return Math.round((filledFields / fieldsToCheck.length) * 100);
};

// ---------------- API ----------------

export const vendorApi = {
  // --- LOCATION API ---
  locations: {
    // --- STATES ---
    getStates: async (includeInactive = false) => {
      let query = supabase
        .from('states')
        .select('*')
        .order('name');

      if (!includeInactive) query = query.eq('is_active', true);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    getState: async (id) => {
      const { data, error } = await supabase
        .from('states')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },

    createState: async (name, slug) => {
      const { data, error } = await supabase
        .from('states')
        .insert([{
          name,
          slug: slug || generateSlug(name),
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    updateState: async (id, updates) => {
      const { data, error } = await supabase
        .from('states')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    deleteState: async (id) => {
      const { error } = await supabase.from('states').delete().eq('id', id);
      if (error) throw error;
    },

    toggleStateActive: async (id, isActive) => {
      const { data, error } = await supabase
        .from('states')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    // --- CITIES ---
    getCities: async (stateId, includeInactive = false) => {
      if (!stateId) return [];
      let query = supabase
        .from('cities')
        .select('*')
        .eq('state_id', stateId)
        .order('name');

      if (!includeInactive) query = query.eq('is_active', true);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    getCity: async (id) => {
      const { data, error } = await supabase
        .from('cities')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },

    getCitiesWithState: async (includeInactive = false) => {
      let query = supabase
        .from('cities')
        .select('*, state:states(id, name, slug)')
        .order('name');

      if (!includeInactive) query = query.eq('is_active', true);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    createCity: async (stateId, name, slug) => {
      const { data, error } = await supabase
        .from('cities')
        .insert([{
          state_id: stateId,
          name,
          slug: slug || generateSlug(name),
          is_active: true,
          supplier_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    updateCity: async (id, updates) => {
      const { data, error } = await supabase
        .from('cities')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    deleteCity: async (id) => {
      const { error } = await supabase.from('cities').delete().eq('id', id);
      if (error) throw error;
    },

    toggleCityActive: async (id, isActive) => {
      const { data, error } = await supabase
        .from('cities')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    incrementSupplierCount: async (id) => {
      const { data: city, error: getErr } = await supabase
        .from('cities')
        .select('supplier_count')
        .eq('id', id)
        .single();
      if (getErr) throw getErr;

      const newCount = (city?.supplier_count || 0) + 1;
      const { data, error } = await supabase
        .from('cities')
        .update({ supplier_count: newCount })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    decrementSupplierCount: async (id) => {
      const { data: city, error: getErr } = await supabase
        .from('cities')
        .select('supplier_count')
        .eq('id', id)
        .single();
      if (getErr) throw getErr;

      const newCount = Math.max(0, (city?.supplier_count || 0) - 1);
      const { data, error } = await supabase
        .from('cities')
        .update({ supplier_count: newCount })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },

  // Legacy aliases for backward compatibility
  getStates: async () => {
    return vendorApi.locations.getStates(false);
  },

  getCities: async (stateId) => {
    return vendorApi.locations.getCities(stateId, false);
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
      profile_completion: calculateProfileCompletion({ company_name: companyName, gst_number: gstNumber, address, owner_name: ownerName, email, phone, state: stateName, city: cityName }),
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

    updatePassword: async (newPassword) => {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
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

      // Get current vendor data to calculate profile completion
      const { data: currentVendor, error: fetchError } = await supabase
        .from('vendors')
        .select('*')
        .eq('id', vendorId)
        .single();

      if (fetchError) throw fetchError;

      // Merge current data with new updates to calculate completion
      const mergedVendor = { ...currentVendor, ...dbUpdates };
      dbUpdates.profile_completion = calculateProfileCompletion(mergedVendor);

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
    list: async (limit = 8, filters = {}) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id);

      if (filters.type) query = query.eq('type', filters.type);
      if (filters.isRead !== undefined) query = query.eq('is_read', filters.isRead);

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },

    get: async (id) => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },

    create: async (notification) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('notifications')
        .insert([{
          user_id: user.id,
          ...notification,
          is_read: false,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
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

    countByType: async (type) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('type', type);

      if (error) throw error;
      return count || 0;
    },

    markAsRead: async (id) => {
      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    markAsUnread: async (id) => {
      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: false })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
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
    },

    markAllAsUnread: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: false })
        .eq('user_id', user.id);

      if (error) throw error;
    },

    deleteById: async (id) => {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },

    deleteByType: async (type) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id)
        .eq('type', type);
      if (error) throw error;
    },

    deleteAllRead: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id)
        .eq('is_read', true);
      if (error) throw error;
    },

    deleteAll: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id);
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
          uploaded_at: new Date().toISOString(),
          verification_status: 'PENDING'
        }])
        .select()
        .single();

      if (error) throw new Error(`Failed to save document: ${error.message}`);
      return data;
    },

    list: async (filters = {}) => {
      const vendorId = await getVendorId();
      let query = supabase
        .from('vendor_documents')
        .select('*')
        .eq('vendor_id', vendorId);

      if (filters.type) query = query.eq('document_type', filters.type);
      if (filters.status) query = query.eq('verification_status', filters.status);

      const { data, error } = await query.order('uploaded_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    getByType: async (type) => {
      const vendorId = await getVendorId();
      const { data, error } = await supabase
        .from('vendor_documents')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('document_type', type)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    getById: async (id) => {
      const { data, error } = await supabase
        .from('vendor_documents')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },

    updateVerificationStatus: async (id, status) => {
      const validStatuses = ['PENDING', 'VERIFIED', 'REJECTED'];
      if (!validStatuses.includes(status)) throw new Error(`Invalid status: ${status}`);

      const { data, error } = await supabase
        .from('vendor_documents')
        .update({ verification_status: status })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    getPendingDocuments: async () => {
      const vendorId = await getVendorId();
      const { data, error } = await supabase
        .from('vendor_documents')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('verification_status', 'PENDING')
        .order('uploaded_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },

    getVerifiedDocuments: async () => {
      const vendorId = await getVendorId();
      const { data, error } = await supabase
        .from('vendor_documents')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('verification_status', 'VERIFIED')
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    delete: async (id) => {
      const { error } = await supabase.from('vendor_documents').delete().eq('id', id);
      if (error) throw error;
    },

    deleteByType: async (type) => {
      const vendorId = await getVendorId();
      const { error } = await supabase
        .from('vendor_documents')
        .delete()
        .eq('vendor_id', vendorId)
        .eq('document_type', type);
      if (error) throw error;
    }
  },

  // --- VENDOR CONTACT PERSONS API ---
  contactPersons: {
    list: async () => {
      const vendorId = await getVendorId();
      const { data, error } = await supabase
        .from('vendor_contact_persons')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    get: async (id) => {
      const { data, error } = await supabase
        .from('vendor_contact_persons')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },

    getPrimary: async () => {
      const vendorId = await getVendorId();
      const { data, error } = await supabase
        .from('vendor_contact_persons')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('is_primary', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    create: async (contactData) => {
      const vendorId = await getVendorId();

      // Validate email format if provided
      if (contactData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactData.email)) {
        throw new Error('Invalid email format');
      }

      // If this is marked as primary, unset other primary contacts
      if (contactData.is_primary) {
        const { error: updateErr } = await supabase
          .from('vendor_contact_persons')
          .update({ is_primary: false })
          .eq('vendor_id', vendorId);
        if (updateErr) throw updateErr;
      }

      const { data, error } = await supabase
        .from('vendor_contact_persons')
        .insert([{
          ...contactData,
          vendor_id: vendorId,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    update: async (id, updates) => {
      // Validate email format if provided
      if (updates.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)) {
        throw new Error('Invalid email format');
      }

      const { data: contact, error: getErr } = await supabase
        .from('vendor_contact_persons')
        .select('vendor_id')
        .eq('id', id)
        .single();
      if (getErr) throw getErr;

      // If setting as primary, unset other primary contacts
      if (updates.is_primary) {
        const { error: updateErr } = await supabase
          .from('vendor_contact_persons')
          .update({ is_primary: false })
          .eq('vendor_id', contact.vendor_id)
          .neq('id', id);
        if (updateErr) throw updateErr;
      }

      const { data, error } = await supabase
        .from('vendor_contact_persons')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    setPrimary: async (id) => {
      const { data: contact, error: getErr } = await supabase
        .from('vendor_contact_persons')
        .select('vendor_id')
        .eq('id', id)
        .single();
      if (getErr) throw getErr;

      // Unset all other primary contacts
      const { error: updateErr } = await supabase
        .from('vendor_contact_persons')
        .update({ is_primary: false })
        .eq('vendor_id', contact.vendor_id)
        .neq('id', id);
      if (updateErr) throw updateErr;

      // Set this one as primary
      const { data, error } = await supabase
        .from('vendor_contact_persons')
        .update({ is_primary: true })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    delete: async (id) => {
      const { data: contact, error: getErr } = await supabase
        .from('vendor_contact_persons')
        .select('is_primary, vendor_id')
        .eq('id', id)
        .single();
      if (getErr) throw getErr;

      // If deleting primary contact, set another as primary
      if (contact?.is_primary) {
        const { data: otherContact, error: listErr } = await supabase
          .from('vendor_contact_persons')
          .select('id')
          .eq('vendor_id', contact.vendor_id)
          .neq('id', id)
          .limit(1)
          .maybeSingle();
        if (listErr) throw listErr;

        if (otherContact?.id) {
          const { error: setErr } = await supabase
            .from('vendor_contact_persons')
            .update({ is_primary: true })
            .eq('id', otherContact.id);
          if (setErr) throw setErr;
        }
      }

      const { error } = await supabase.from('vendor_contact_persons').delete().eq('id', id);
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
    list: async (filters = {}) => {
      const vendorId = await getVendorId();
      let query = supabase
        .from('products')
        .select('*')
        .eq('vendor_id', vendorId);

      if (filters.status) query = query.eq('status', filters.status);
      if (filters.category) query = query.eq('micro_category_id', filters.category);

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    listByStatus: async (status = 'ACTIVE') => {
      const vendorId = await getVendorId();
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('status', status)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    get: async (id) => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          micro_category:micro_categories(id, name, slug),
          sub_category:sub_categories(id, name, slug),
          head_category:head_categories(id, name, slug)
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },

    create: async (productData) => {
      const vendorId = await getVendorId();
      const slug = generateUniqueSlug(productData.name);
      
      const insertData = {
        ...productData,
        vendor_id: vendorId,
        slug,
        status: productData.status || 'DRAFT',
        views: 0,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('products')
        .insert([insertData])
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    update: async (id, updates) => {
      const updateData = { ...updates };
      if (updates.name) updateData.slug = generateUniqueSlug(updates.name);
      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    updateStatus: async (id, status) => {
      const validStatuses = ['ACTIVE', 'DRAFT', 'ARCHIVED'];
      if (!validStatuses.includes(status)) throw new Error(`Invalid status: ${status}`);
      
      const { data, error } = await supabase
        .from('products')
        .update({ status, updated_at: new Date().toISOString() })
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

    addImage: async (productId, file) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `products/${productId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: false });

      if (uploadError) throw new Error(`Failed to upload image: ${uploadError.message}`);

      const { data: publicUrl } = supabase.storage.from('avatars').getPublicUrl(fileName);

      const { data: product, error: getError } = await supabase
        .from('products')
        .select('images')
        .eq('id', productId)
        .single();

      if (getError) throw getError;

      const currentImages = product?.images || [];
      const newImages = [...currentImages, { url: publicUrl.publicUrl, uploaded_at: new Date().toISOString() }];

      const { data, error } = await supabase
        .from('products')
        .update({ images: newImages })
        .eq('id', productId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    removeImage: async (productId, imageUrl) => {
      const { data: product, error: getError } = await supabase
        .from('products')
        .select('images')
        .eq('id', productId)
        .single();

      if (getError) throw getError;

      const updatedImages = (product?.images || []).filter(img => img.url !== imageUrl);

      const { data, error } = await supabase
        .from('products')
        .update({ images: updatedImages })
        .eq('id', productId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    incrementViews: async (id) => {
      const { data: product, error: getError } = await supabase
        .from('products')
        .select('views')
        .eq('id', id)
        .single();

      if (getError) throw getError;

      const newViews = (product?.views || 0) + 1;
      const { error } = await supabase
        .from('products')
        .update({ views: newViews })
        .eq('id', id);

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

      const { data: proposals, error: propError } = await supabase
        .from('proposals')
        .select('*, buyer:buyers(full_name, company_name)')
        .eq('vendor_id', vendorId)
        .eq('status', 'SENT')
        .order('created_at', { ascending: false });

      if (propError) console.error('Error fetching proposals:', propError);

      const purchasedLeads = (purchases || []).map(p => ({ ...p.lead, source: 'Purchased', purchase_date: p.purchase_date }));
      const directLeads = (direct || []).map(l => ({ ...l, source: 'Direct', purchase_date: l.created_at }));
      const directProposals = (proposals || []).map(p => ({ 
        id: p.id,
        title: p.title,
        description: p.description,
        category: 'Proposal',
        status: 'AVAILABLE',
        source: 'Direct Proposal',
        purchase_date: p.created_at,
        created_at: p.created_at,
        buyer_name: p.buyer?.full_name || 'Unknown Buyer',
        buyer_company: p.buyer?.company_name,
        quantity: p.quantity,
        budget: p.budget,
        required_by_date: p.required_by_date
      }));

      return [...purchasedLeads, ...directLeads, ...directProposals].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
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

      const [products, leads, proposals, messages] = await Promise.all([
        supabase.from('products').select('*', { count: 'exact' }).eq('vendor_id', vendor.id).limit(1),
        supabase.from('leads').select('*', { count: 'exact' }).eq('vendor_id', vendor.id).eq('status', 'AVAILABLE').limit(1),
        supabase.from('proposals').select('*', { count: 'exact' }).eq('vendor_id', vendor.id).eq('status', 'SENT').limit(1),
        supabase.from('vendor_messages').select('*', { count: 'exact' }).eq('vendor_id', vendor.id).limit(1)
      ]);

      return {
        totalProducts: products.count || 0,
        totalLeads: (leads.count || 0) + (proposals.count || 0),
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

    get: async (id) => {
      const { data, error } = await supabase
        .from('vendor_bank_details')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },

    getPrimary: async () => {
      const vendorId = await getVendorId();
      const { data, error } = await supabase
        .from('vendor_bank_details')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('is_primary', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    add: async (bankData) => {
      const vendorId = await getVendorId();
      // Remove temporary ID before sending to database
      const { id, ...cleanData } = bankData;

      // If this is marked as primary, unset other primary accounts
      if (cleanData.is_primary) {
        const { error: updateErr } = await supabase
          .from('vendor_bank_details')
          .update({ is_primary: false })
          .eq('vendor_id', vendorId);
        if (updateErr) throw updateErr;
      }

      const { data, error } = await supabase
        .from('vendor_bank_details')
        .insert([{
          ...cleanData,
          vendor_id: vendorId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    update: async (id, updates) => {
      const { data: bankDetail, error: getErr } = await supabase
        .from('vendor_bank_details')
        .select('vendor_id')
        .eq('id', id)
        .single();
      if (getErr) throw getErr;

      // If setting as primary, unset other primary accounts
      if (updates.is_primary) {
        const { error: updateErr } = await supabase
          .from('vendor_bank_details')
          .update({ is_primary: false })
          .eq('vendor_id', bankDetail.vendor_id)
          .neq('id', id);
        if (updateErr) throw updateErr;
      }

      const { data, error } = await supabase
        .from('vendor_bank_details')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    setPrimary: async (id) => {
      const { data: bankDetail, error: getErr } = await supabase
        .from('vendor_bank_details')
        .select('vendor_id')
        .eq('id', id)
        .single();
      if (getErr) throw getErr;

      // Unset all other primary accounts
      const { error: updateErr } = await supabase
        .from('vendor_bank_details')
        .update({ is_primary: false })
        .eq('vendor_id', bankDetail.vendor_id)
        .neq('id', id);
      if (updateErr) throw updateErr;

      // Set this one as primary
      const { data, error } = await supabase
        .from('vendor_bank_details')
        .update({ is_primary: true, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    delete: async (id) => {
      const { data: bankDetail, error: getErr } = await supabase
        .from('vendor_bank_details')
        .select('is_primary')
        .eq('id', id)
        .single();
      if (getErr) throw getErr;

      // If deleting primary account, set another as primary
      if (bankDetail?.is_primary) {
        const { data: bankData, error: listErr } = await supabase
          .from('vendor_bank_details')
          .select('id')
          .neq('id', id)
          .limit(1)
          .maybeSingle();
        if (listErr) throw listErr;

        if (bankData?.id) {
          const { error: setErr } = await supabase
            .from('vendor_bank_details')
            .update({ is_primary: true })
            .eq('id', bankData.id);
          if (setErr) throw setErr;
        }
      }

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

    getHistory: async () => {
      const vendorId = await getVendorId();
      const { data, error } = await supabase
        .from('vendor_plan_subscriptions')
        .select('*, plan:vendor_plans(*)')
        .eq('vendor_id', vendorId)
        .order('start_date', { ascending: false });
      if (error) throw error;
      return data || [];
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

    getAllPlans: async () => {
      const { data, error } = await supabase
        .from('vendor_plans')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });
      if (error) throw error;
      return data || [];
    },

    subscribe: async (planId) => {
      const vendorId = await getVendorId();
      const { data: plan, error: planErr } = await supabase
        .from('vendor_plans')
        .select('id')
        .eq('id', planId)
        .single();
      if (planErr) throw planErr;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 365);

      const { data, error } = await supabase
        .from('vendor_plan_subscriptions')
        .insert([{
          vendor_id: vendorId,
          plan_id: planId,
          start_date: today.toISOString(),
          end_date: endDate.toISOString(),
          status: 'ACTIVE',
          plan_duration_days: 365,
          auto_renewal_enabled: false,
          renewal_notification_sent: false
        }])
        .select('*, plan:vendor_plans(*)')
        .single();
      if (error) throw error;
      return data;
    },

    renew: async (subscriptionId) => {
      const { data: currentSub, error: subErr } = await supabase
        .from('vendor_plan_subscriptions')
        .select('id, end_date')
        .eq('id', subscriptionId)
        .single();
      if (subErr) throw subErr;

      const endDate = new Date(currentSub.end_date);
      const newEndDate = new Date(endDate);
      newEndDate.setDate(newEndDate.getDate() + 365);

      const { data, error } = await supabase
        .from('vendor_plan_subscriptions')
        .update({
          end_date: newEndDate.toISOString(),
          renewal_notification_sent: false,
          renewal_notification_sent_at: null
        })
        .eq('id', subscriptionId)
        .select('*, plan:vendor_plans(*)')
        .single();
      if (error) throw error;
      return data;
    },

    cancel: async (subscriptionId) => {
      const { error } = await supabase
        .from('vendor_plan_subscriptions')
        .update({ status: 'CANCELLED' })
        .eq('id', subscriptionId);
      if (error) throw error;
    },

    updateAutoRenewal: async (subscriptionId, enabled) => {
      const { data, error } = await supabase
        .from('vendor_plan_subscriptions')
        .update({ auto_renewal_enabled: enabled })
        .eq('id', subscriptionId)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },

  // --- LEAD QUOTA API ---
  leadQuota: {
    get: async () => {
      const vendorId = await getVendorId();
      const { data, error } = await supabase
        .from('vendor_lead_quota')
        .select('*')
        .eq('vendor_id', vendorId)
        .maybeSingle();
      if (error) throw error;
      
      if (!data) {
        return {
          vendor_id: vendorId,
          daily_used: 0,
          daily_limit: 0,
          weekly_used: 0,
          weekly_limit: 0,
          yearly_used: 0,
          yearly_limit: 0,
          last_reset_date: new Date().toISOString()
        };
      }
      return data;
    },

    initialize: async (planId) => {
      const vendorId = await getVendorId();
      const { data: plan, error: planErr } = await supabase
        .from('vendor_plans')
        .select('daily_limit, weekly_limit, yearly_limit')
        .eq('id', planId)
        .single();
      if (planErr) throw planErr;

      const { data: existing, error: existErr } = await supabase
        .from('vendor_lead_quota')
        .select('id')
        .eq('vendor_id', vendorId)
        .maybeSingle();
      if (existErr) throw existErr;

      const quotaData = {
        vendor_id: vendorId,
        plan_id: planId,
        daily_used: 0,
        daily_limit: plan?.daily_limit || 0,
        weekly_used: 0,
        weekly_limit: plan?.weekly_limit || 0,
        yearly_used: 0,
        yearly_limit: plan?.yearly_limit || 0,
        last_reset_date: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (existing?.id) {
        const { data, error } = await supabase
          .from('vendor_lead_quota')
          .update(quotaData)
          .eq('vendor_id', vendorId)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('vendor_lead_quota')
          .insert([quotaData])
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },

    incrementDaily: async () => {
      const vendorId = await getVendorId();
      const { data: quota, error: getErr } = await supabase
        .from('vendor_lead_quota')
        .select('*')
        .eq('vendor_id', vendorId)
        .maybeSingle();
      if (getErr) throw getErr;

      if (!quota) throw new Error('Quota not initialized');

      const newUsed = (quota.daily_used || 0) + 1;
      if (newUsed > quota.daily_limit) {
        throw new Error(`Daily quota exceeded: ${newUsed}/${quota.daily_limit}`);
      }

      const { data, error } = await supabase
        .from('vendor_lead_quota')
        .update({ daily_used: newUsed, updated_at: new Date().toISOString() })
        .eq('vendor_id', vendorId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    incrementWeekly: async () => {
      const vendorId = await getVendorId();
      const { data: quota, error: getErr } = await supabase
        .from('vendor_lead_quota')
        .select('*')
        .eq('vendor_id', vendorId)
        .maybeSingle();
      if (getErr) throw getErr;

      if (!quota) throw new Error('Quota not initialized');

      const newUsed = (quota.weekly_used || 0) + 1;
      if (newUsed > quota.weekly_limit) {
        throw new Error(`Weekly quota exceeded: ${newUsed}/${quota.weekly_limit}`);
      }

      const { data, error } = await supabase
        .from('vendor_lead_quota')
        .update({ weekly_used: newUsed, updated_at: new Date().toISOString() })
        .eq('vendor_id', vendorId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    incrementYearly: async () => {
      const vendorId = await getVendorId();
      const { data: quota, error: getErr } = await supabase
        .from('vendor_lead_quota')
        .select('*')
        .eq('vendor_id', vendorId)
        .maybeSingle();
      if (getErr) throw getErr;

      if (!quota) throw new Error('Quota not initialized');

      const newUsed = (quota.yearly_used || 0) + 1;
      if (newUsed > quota.yearly_limit) {
        throw new Error(`Yearly quota exceeded: ${newUsed}/${quota.yearly_limit}`);
      }

      const { data, error } = await supabase
        .from('vendor_lead_quota')
        .update({ yearly_used: newUsed, updated_at: new Date().toISOString() })
        .eq('vendor_id', vendorId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    resetDaily: async () => {
      const vendorId = await getVendorId();
      const { data, error } = await supabase
        .from('vendor_lead_quota')
        .update({ daily_used: 0, updated_at: new Date().toISOString() })
        .eq('vendor_id', vendorId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    resetWeekly: async () => {
      const vendorId = await getVendorId();
      const { data, error } = await supabase
        .from('vendor_lead_quota')
        .update({ weekly_used: 0, updated_at: new Date().toISOString() })
        .eq('vendor_id', vendorId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    resetYearly: async () => {
      const vendorId = await getVendorId();
      const { data, error } = await supabase
        .from('vendor_lead_quota')
        .update({ yearly_used: 0, last_reset_date: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('vendor_id', vendorId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    canAccessDaily: async () => {
      const vendorId = await getVendorId();
      const { data: quota, error } = await supabase
        .from('vendor_lead_quota')
        .select('daily_used, daily_limit')
        .eq('vendor_id', vendorId)
        .maybeSingle();
      if (error) throw error;

      if (!quota) return false;
      return quota.daily_used < quota.daily_limit;
    },

    canAccessWeekly: async () => {
      const vendorId = await getVendorId();
      const { data: quota, error } = await supabase
        .from('vendor_lead_quota')
        .select('weekly_used, weekly_limit')
        .eq('vendor_id', vendorId)
        .maybeSingle();
      if (error) throw error;

      if (!quota) return false;
      return quota.weekly_used < quota.weekly_limit;
    },

    canAccessYearly: async () => {
      const vendorId = await getVendorId();
      const { data: quota, error } = await supabase
        .from('vendor_lead_quota')
        .select('yearly_used, yearly_limit')
        .eq('vendor_id', vendorId)
        .maybeSingle();
      if (error) throw error;

      if (!quota) return false;
      return quota.yearly_used < quota.yearly_limit;
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

    create: async (preferencesData) => {
      const vendorId = await getVendorId();
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

    updateBudgetRange: async (minBudget, maxBudget) => {
      const vendorId = await getVendorId();
      const { data, error } = await supabase
        .from('vendor_preferences')
        .update({
          min_budget: minBudget,
          max_budget: maxBudget,
          updated_at: new Date().toISOString()
        })
        .eq('vendor_id', vendorId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    addCategory: async (microCategoryId) => {
      const vendorId = await getVendorId();
      const { data: prefs, error: getErr } = await supabase
        .from('vendor_preferences')
        .select('preferred_micro_categories')
        .eq('vendor_id', vendorId)
        .maybeSingle();
      if (getErr) throw getErr;

      const categories = prefs?.preferred_micro_categories || [];
      if (!categories.includes(microCategoryId)) {
        categories.push(microCategoryId);
      }

      const { data, error } = await supabase
        .from('vendor_preferences')
        .update({
          preferred_micro_categories: categories,
          updated_at: new Date().toISOString()
        })
        .eq('vendor_id', vendorId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    removeCategory: async (microCategoryId) => {
      const vendorId = await getVendorId();
      const { data: prefs, error: getErr } = await supabase
        .from('vendor_preferences')
        .select('preferred_micro_categories')
        .eq('vendor_id', vendorId)
        .maybeSingle();
      if (getErr) throw getErr;

      const categories = (prefs?.preferred_micro_categories || []).filter(id => id !== microCategoryId);

      const { data, error } = await supabase
        .from('vendor_preferences')
        .update({
          preferred_micro_categories: categories,
          updated_at: new Date().toISOString()
        })
        .eq('vendor_id', vendorId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    addState: async (stateId) => {
      const vendorId = await getVendorId();
      const { data: prefs, error: getErr } = await supabase
        .from('vendor_preferences')
        .select('preferred_states')
        .eq('vendor_id', vendorId)
        .maybeSingle();
      if (getErr) throw getErr;

      const states = prefs?.preferred_states || [];
      if (!states.includes(stateId)) {
        states.push(stateId);
      }

      const { data, error } = await supabase
        .from('vendor_preferences')
        .update({
          preferred_states: states,
          updated_at: new Date().toISOString()
        })
        .eq('vendor_id', vendorId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    removeState: async (stateId) => {
      const vendorId = await getVendorId();
      const { data: prefs, error: getErr } = await supabase
        .from('vendor_preferences')
        .select('preferred_states')
        .eq('vendor_id', vendorId)
        .maybeSingle();
      if (getErr) throw getErr;

      const states = (prefs?.preferred_states || []).filter(id => id !== stateId);

      const { data, error } = await supabase
        .from('vendor_preferences')
        .update({
          preferred_states: states,
          updated_at: new Date().toISOString()
        })
        .eq('vendor_id', vendorId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    addCity: async (cityId) => {
      const vendorId = await getVendorId();
      const { data: prefs, error: getErr } = await supabase
        .from('vendor_preferences')
        .select('preferred_cities')
        .eq('vendor_id', vendorId)
        .maybeSingle();
      if (getErr) throw getErr;

      const cities = prefs?.preferred_cities || [];
      if (!cities.includes(cityId)) {
        cities.push(cityId);
      }

      const { data, error } = await supabase
        .from('vendor_preferences')
        .update({
          preferred_cities: cities,
          updated_at: new Date().toISOString()
        })
        .eq('vendor_id', vendorId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    removeCity: async (cityId) => {
      const vendorId = await getVendorId();
      const { data: prefs, error: getErr } = await supabase
        .from('vendor_preferences')
        .select('preferred_cities')
        .eq('vendor_id', vendorId)
        .maybeSingle();
      if (getErr) throw getErr;

      const cities = (prefs?.preferred_cities || []).filter(id => id !== cityId);

      const { data, error } = await supabase
        .from('vendor_preferences')
        .update({
          preferred_cities: cities,
          updated_at: new Date().toISOString()
        })
        .eq('vendor_id', vendorId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    toggleAutoFilter: async (enabled) => {
      const vendorId = await getVendorId();
      const { data, error } = await supabase
        .from('vendor_preferences')
        .update({
          auto_lead_filter: enabled,
          updated_at: new Date().toISOString()
        })
        .eq('vendor_id', vendorId)
        .select()
        .single();
      if (error) throw error;
      return data;
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
    getTickets: async (filters = {}) => {
      const vendorId = await getVendorId();
      let query = supabase
        .from('support_tickets')
        .select('*')
        .eq('vendor_id', vendorId);

      if (filters.status) query = query.eq('status', filters.status);
      if (filters.priority) query = query.eq('priority', filters.priority);
      if (filters.category) query = query.eq('category', filters.category);

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    getTicketsByStatus: async (status) => {
      const vendorId = await getVendorId();
      const validStatuses = ['OPEN', 'CLOSED', 'IN_PROGRESS'];
      if (!validStatuses.includes(status)) throw new Error(`Invalid status: ${status}`);

      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('status', status)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    getOpenTickets: async () => {
      return vendorApi.support.getTicketsByStatus('OPEN');
    },

    getClosedTickets: async () => {
      return vendorApi.support.getTicketsByStatus('CLOSED');
    },

    createTicket: async (ticketData) => {
      const vendorId = await getVendorId();
      const { data: { user } } = await supabase.auth.getUser();

      const ticketDisplayId = `TKT-${Date.now()}`;

      const { data, error } = await supabase
        .from('support_tickets')
        .insert([{
          vendor_id: vendorId,
          subject: ticketData.subject,
          description: ticketData.description,
          category: ticketData.category || 'General Inquiry',
          priority: ticketData.priority || 'Medium',
          status: 'OPEN',
          ticket_display_id: ticketDisplayId,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    getTicket: async (id) => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('id', id)
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

    updateTicketStatus: async (id, status) => {
      const validStatuses = ['OPEN', 'CLOSED', 'IN_PROGRESS'];
      if (!validStatuses.includes(status)) throw new Error(`Invalid status: ${status}`);

      const updateData = {
        status,
        updated_at: new Date().toISOString()
      };

      if (status === 'CLOSED') {
        updateData.resolved_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('support_tickets')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    updateTicketPriority: async (id, priority) => {
      const validPriorities = ['Low', 'Medium', 'High', 'Critical'];
      if (!validPriorities.includes(priority)) throw new Error(`Invalid priority: ${priority}`);

      const { data, error } = await supabase
        .from('support_tickets')
        .update({ priority, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    closeTicket: async (id) => {
      return vendorApi.support.updateTicketStatus(id, 'CLOSED');
    },

    reopenTicket: async (id) => {
      return vendorApi.support.updateTicketStatus(id, 'OPEN');
    },

    addMessage: async (ticketId, message) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update ticket's last_reply_at
      const { error: updateErr } = await supabase
        .from('support_tickets')
        .update({ last_reply_at: new Date().toISOString() })
        .eq('id', ticketId);
      if (updateErr) throw updateErr;

      const { data, error } = await supabase
        .from('ticket_messages')
        .insert([{
          ticket_id: ticketId,
          sender_id: user.id,
          sender_type: 'VENDOR',
          message: message,
          created_at: new Date().toISOString()
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

    deleteMessage: async (id) => {
      const { error } = await supabase
        .from('ticket_messages')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },

    getStats: async () => {
      const vendorId = await getVendorId();
      const { count: totalCount } = await supabase
        .from('support_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('vendor_id', vendorId);

      const { count: openCount } = await supabase
        .from('support_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('vendor_id', vendorId)
        .eq('status', 'OPEN');

      const { count: closedCount } = await supabase
        .from('support_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('vendor_id', vendorId)
        .eq('status', 'CLOSED');

      return {
        total: totalCount || 0,
        open: openCount || 0,
        closed: closedCount || 0,
        unresolved: (openCount || 0) + ((await supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('vendor_id', vendorId).eq('status', 'IN_PROGRESS')).count || 0)
      };
    },

    sendMessage: async (ticketId, message) => {
      return vendorApi.support.addMessage(ticketId, message);
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
