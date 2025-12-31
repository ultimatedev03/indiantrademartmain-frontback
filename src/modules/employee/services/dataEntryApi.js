
import { supabase } from '@/lib/customSupabaseClient';

const getUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
};

// Helper to get authenticated employee context
const getEmployeeContext = async () => {
    const user = await getUser();
    // Verify role in employees table
    const { data: emp, error } = await supabase
        .from('employees')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(); // Use maybeSingle to avoid 406 errors if row missing
    
    // Fallback: If not in employees, check admin_users for dev/testing
    if (!emp) {
        const { data: admin } = await supabase.from('admin_users').select('*').eq('id', user.id).maybeSingle();
        if (admin) return { ...admin, user_id: admin.id };
        // If still nothing, just return user object assuming RLS will handle permission
        return { user_id: user.id, role: 'UNKNOWN' }; 
    }
    return emp;
};

// Helper for ID Generation
const generateRandomString = (length, chars) => {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const dataEntryApi = {
  // --- DASHBOARD ---
  getDashboardStats: async (userId) => {
    // Helper to run query and return count safely
    const getCount = async (table, queryModifier = (q) => q) => {
        let query = supabase.from(table).select('*', { count: 'exact', head: true });
        if (userId) query = queryModifier(query);
        const { count, error } = await query;
        if (error) console.error(`Error counting ${table}:`, error);
        return count || 0;
    };

    const totalVendors = await getCount('vendors', q => q.or(`assigned_to.eq.${userId},created_by_user_id.eq.${userId}`));
    
    // Get assigned vendor IDs first to filter products
    const { data: vIds } = await supabase.from('vendors').select('id').or(`assigned_to.eq.${userId},created_by_user_id.eq.${userId}`);
    const ids = vIds?.map(v => v.id) || [];
    
    let totalProducts = 0;
    if (ids.length > 0) {
        totalProducts = await getCount('products', q => q.in('vendor_id', ids));
    }

    const pendingKyc = await getCount('vendors', q => q.eq('kyc_status', 'PENDING').or(`assigned_to.eq.${userId},created_by_user_id.eq.${userId}`));
    const approvedKyc = await getCount('vendors', q => q.eq('kyc_status', 'VERIFIED').or(`assigned_to.eq.${userId},created_by_user_id.eq.${userId}`));

    return { totalVendors, totalProducts, pendingKyc, approvedKyc };
  },

  getRecentActivities: async (userId) => {
    let vendorQuery = supabase.from('vendors').select('id, company_name, created_at, kyc_status').order('created_at', { ascending: false }).limit(5);
    if(userId) vendorQuery = vendorQuery.or(`assigned_to.eq.${userId},created_by_user_id.eq.${userId}`);
    
    const { data: vendors } = await vendorQuery;

    return (vendors || []).map(v => ({
        type: 'VENDOR',
        message: `Created vendor ${v.company_name}`,
        time: v.created_at,
        id: v.id
    }));
  },

  // --- VENDORS ---
  getVendors: async () => {
    const { data, error } = await supabase.from('vendors').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  
  getAssignedVendors: async () => {
    const emp = await getEmployeeContext();
    const { data, error } = await supabase
      .from('vendors')
      .select('*, products(count)')
      .or(`assigned_to.eq.${emp.user_id},created_by_user_id.eq.${emp.user_id}`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  
  getAllVendors: async (filters = {}) => {
    let query = supabase.from('vendors').select('*, products(count)').order('created_at', { ascending: false });
    
    if (filters.status && filters.status !== 'all') {
      const statusMap = { 'pending': 'PENDING', 'approved': 'VERIFIED', 'rejected': 'REJECTED' };
      if (statusMap[filters.status]) query = query.eq('kyc_status', statusMap[filters.status]);
    }

    if (filters.search) {
      query = query.or(`vendor_id.ilike.%${filters.search}%,company_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  generateVendorId: () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const digits = '0123456789';
    
    const part1 = generateRandomString(3, letters); // ABC
    const part2 = generateRandomString(4, digits);  // 1234
    const part3 = generateRandomString(3, letters); // XYZ
    
    return `${part1}-VIN-${part2}-${part3}`;
  },

  createVendor: async (vendorData) => {
    const emp = await getEmployeeContext();
    
    // Generate new style Vendor ID if not provided (though this function allows passing one in via prompt logic, let's enforce generator)
    const generatedId = dataEntryApi.generateVendorId();
    const tempPassword = vendorData.temp_password || Math.random().toString(36).slice(-8) + "!Aa1";
    
    const payload = {
        ...vendorData,
        vendor_id: generatedId,
        assigned_to: emp.user_id,
        created_by_user_id: emp.user_id,
        kyc_status: 'PENDING',
        profile_completion: 10,
        is_active: true,
        generated_password_hash: tempPassword, // Storing plain/temp for display (In prod, hash this!)
        is_password_temporary: true
    };
    
    // Remove temp_password from payload to avoid schema error if column doesn't exist
    delete payload.temp_password;

    const { data, error } = await supabase.from('vendors').insert([payload]).select().single();
    
    if (error) {
        console.error("Create Vendor DB Error:", error);
        throw new Error(error.message);
    }
    
    return { ...data, password: tempPassword };
  },

  // --- CATEGORIES ---
  getHeadCategories: async () => {
    const { data, error } = await supabase.from('head_categories').select('*, sub_categories(count)').order('name');
    if (error) throw error;
    return data;
  },
  
  getAllHeadCategories: async () => {
    const { data, error } = await supabase.from('head_categories').select('*').order('name');
    if (error) throw error;
    return data;
  },

  createHeadCategory: async (categoryData) => {
    const { data, error } = await supabase.from('head_categories').insert([categoryData]).select().single();
    if (error) throw error;
    return data;
  },
  
  updateHeadCategory: async (id, updates) => {
      const { data, error } = await supabase.from('head_categories').update(updates).eq('id', id).select().single();
      if(error) throw error;
      return data;
  },
  
  deleteHeadCategory: async (id) => {
      const { error } = await supabase.from('head_categories').delete().eq('id', id);
      if(error) throw error;
  },

  getSubCategories: async (headId) => {
    const { data, error } = await supabase.from('sub_categories').select('*, micro_categories(count)').eq('head_category_id', headId).order('name');
    if (error) throw error;
    return data;
  },
  
  createSubCategory: async (categoryData) => {
    const { data, error } = await supabase.from('sub_categories').insert([categoryData]).select().single();
    if(error) throw error;
    return data;
  },

  updateSubCategory: async (id, updates) => {
      const { data, error } = await supabase.from('sub_categories').update(updates).eq('id', id).select().single();
      if(error) throw error;
      return data;
  },

  deleteSubCategory: async (id) => {
      const { error } = await supabase.from('sub_categories').delete().eq('id', id);
      if(error) throw error;
  },

  getMicroCategories: async (subId) => {
    const { data, error } = await supabase.from('micro_categories').select('*').eq('sub_category_id', subId).order('name');
    if (error) throw error;
    return data;
  },

  createMicroCategory: async (categoryData) => {
      const { data, error } = await supabase.from('micro_categories').insert([categoryData]).select().single();
      if(error) throw error;
      return data;
  },

  updateMicroCategory: async (id, updates) => {
      const { data, error } = await supabase.from('micro_categories').update(updates).eq('id', id).select().single();
      if(error) throw error;
      return data;
  },

  deleteMicroCategory: async (id) => {
      const { error } = await supabase.from('micro_categories').delete().eq('id', id);
      if(error) throw error;
  },

  importCategoriesCSV: async (rows) => {
    let success = 0, failed = 0, errors = [];
    for (const row of rows) {
      try {
        const headName = row.head_category || row.head_category_name;
        const subName = row.sub_category || row.sub_category_name;
        const microName = row.micro_category || row.micro_category_name;
        
        if (!headName || !subName || !microName) throw new Error("Missing names");

        // 1. Head
        const headSlug = headName.toLowerCase().replace(/[^a-z0-9]/g, '-');
        let { data: head } = await supabase.from('head_categories').select('id').eq('slug', headSlug).maybeSingle();
        if (!head) {
             const { data: newHead, error } = await supabase.from('head_categories').insert([{ name: headName, slug: headSlug, is_active: true }]).select().single();
             if (error) throw error;
             head = newHead;
        }

        // 2. Sub
        const subSlug = subName.toLowerCase().replace(/[^a-z0-9]/g, '-');
        let { data: sub } = await supabase.from('sub_categories').select('id').eq('slug', subSlug).eq('head_category_id', head.id).maybeSingle();
        if (!sub) {
             const { data: newSub, error } = await supabase.from('sub_categories').insert([{ head_category_id: head.id, name: subName, slug: subSlug, is_active: true }]).select().single();
             if (error) throw error;
             sub = newSub;
        }

        // 3. Micro
        const microSlug = microName.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const { data: existingMicro } = await supabase.from('micro_categories').select('id').eq('slug', microSlug).eq('sub_category_id', sub.id).maybeSingle();
        if (!existingMicro) {
             const { error } = await supabase.from('micro_categories').insert([{ 
                 sub_category_id: sub.id, 
                 name: microName, 
                 slug: microSlug, 
                 description: row.description,
                 meta_tags: row.meta_tags,
                 is_active: true 
             }]);
             if (error) throw error;
        }
        success++;
      } catch (e) {
        failed++;
        errors.push(e.message);
      }
    }
    return { success, failed, errors };
  },

  // --- LOCATIONS ---
  getStates: async () => {
      const { data, error } = await supabase.from('states').select('*').order('name');
      if (error) throw error;
      return data;
  },
  getCitiesByState: async (stateId) => {
      const { data, error } = await supabase.from('cities').select('*').eq('state_id', stateId).order('name');
      if (error) throw error;
      return data;
  },
  createState: async (name) => {
      const slug = name.toLowerCase().replace(/\s+/g, '-');
      const { error } = await supabase.from('states').insert([{ name, slug, is_active: true }]);
      if(error) throw error;
  },
  updateState: async (id, name) => {
       const { error } = await supabase.from('states').update({ name }).eq('id', id);
       if(error) throw error;
  },
  deleteState: async (id) => {
       const { error } = await supabase.from('states').delete().eq('id', id);
       if(error) throw error;
  },
  createCity: async (stateId, name) => {
      const slug = name.toLowerCase().replace(/\s+/g, '-');
      const { error } = await supabase.from('cities').insert([{ state_id: stateId, name, slug, is_active: true }]);
      if(error) throw error;
  },
  updateCity: async (id, name) => {
       const { error } = await supabase.from('cities').update({ name }).eq('id', id);
       if(error) throw error;
  },
  deleteCity: async (id) => {
       const { error } = await supabase.from('cities').delete().eq('id', id);
       if(error) throw error;
  },
  
  importLocationsCSV: async (rows) => {
      let success = 0, failed = 0;
      for (const row of rows) {
          try {
              const sName = row.state_name || row.State;
              const cName = row.city_name || row.City;
              if (!sName || !cName) { failed++; continue; }
              
              let sId;
              const { data: s } = await supabase.from('states').select('id').ilike('name', sName).maybeSingle();
              if (s) sId = s.id;
              else {
                  const { data: ns } = await supabase.from('states').insert([{ name: sName, slug: sName.toLowerCase().replace(/\s/g, '-'), is_active: true }]).select().single();
                  sId = ns?.id;
              }
              
              if (sId) {
                  await supabase.from('cities').insert([{ state_id: sId, name: cName, slug: cName.toLowerCase().replace(/\s/g, '-'), is_active: true }]);
                  success++;
              } else {
                  failed++;
              }
          } catch(e) { failed++; }
      }
      return { success, failed };
  },

  // --- KYC ---
  getKycDocuments: async (vendorId) => {
    try {
      // Query vendor_documents table where actual KYC documents are stored
      console.log('🔍 [KYC] Fetching documents for vendor:', vendorId);
      const { data, error } = await supabase
        .from('vendor_documents')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      console.log('✅ [KYC] Found documents:', data?.length || 0, data);
      return data || [];
    } catch (error) {
      console.error('❌ [KYC] Error fetching KYC documents:', error);
      throw error;
    }
  },
  getKYCDocuments: async (vendorId) => {
    try {
      // Query vendor_documents table where actual KYC documents are stored
      const { data, error } = await supabase
        .from('vendor_documents')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching KYC documents:', error);
      throw error;
    }
  },
  approveVendorKyc: async (vendorId) => {
      const { error } = await supabase.from('vendors').update({ kyc_status: 'VERIFIED', verification_badge: true, verified_at: new Date().toISOString() }).eq('id', vendorId);
      if (error) throw error;
  },
  approveVendor: async (vendorId) => {
      const { error } = await supabase.from('vendors').update({ kyc_status: 'VERIFIED', verification_badge: true, verified_at: new Date().toISOString() }).eq('id', vendorId);
      if (error) throw error;
  },
  rejectVendorKyc: async (vendorId, remarks) => {
      const emp = await getEmployeeContext();
      const { error } = await supabase.from('vendors').update({ kyc_status: 'REJECTED' }).eq('id', vendorId);
      if (error) throw error;
      await supabase.from('kyc_remarks').insert([{ vendor_id: vendorId, remarks, created_by: emp.user_id }]);
  },
  rejectVendor: async (vendorId, remarks) => {
      const emp = await getEmployeeContext();
      const { error } = await supabase.from('vendors').update({ kyc_status: 'REJECTED' }).eq('id', vendorId);
      if (error) throw error;
      await supabase.from('kyc_remarks').insert([{ vendor_id: vendorId, remarks, created_by: emp.user_id }]);
  },

  // --- KYC DOCUMENTS GROUPING ---
  getVendorsGroupedByKycDocuments: async () => {
    try {
      console.log('🔍 [KYC] Fetching PENDING vendors...');
      const { data: vendors, error: vendorError } = await supabase
        .from('vendors')
        .select('*')
        .eq('kyc_status', 'PENDING')
        .order('created_at', { ascending: false });

      if (vendorError) throw vendorError;
      console.log('✅ [KYC] Found vendors:', vendors?.length || 0, vendors?.map(v => ({ id: v.id, name: v.company_name })));
      if (!vendors || vendors.length === 0) return { withDocuments: [], withoutDocuments: [] };

      // Check vendor_documents table (actual KYC docs location)
      console.log('🔍 [KYC] Checking vendor_documents table for these vendor IDs:', vendors.map(v => v.id));
      const { data: allDocs, error: docsError } = await supabase
        .from('vendor_documents')
        .select('vendor_id, document_type, document_url')
        .in('vendor_id', vendors.map(v => v.id));

      if (docsError) throw docsError;
      console.log('✅ [KYC] Found documents:', allDocs?.length || 0, allDocs);

      const vendorIdsWithDocs = new Set(allDocs?.map(d => d.vendor_id) || []);

      const withDocuments = vendors.filter(v => vendorIdsWithDocs.has(v.id));
      const withoutDocuments = vendors.filter(v => !vendorIdsWithDocs.has(v.id));

      console.log('📊 [KYC] Grouping result - With docs:', withDocuments.length, 'Without docs:', withoutDocuments.length);
      return { withDocuments, withoutDocuments };
    } catch (error) {
      console.error('❌ [KYC] Error grouping vendors by KYC documents:', error);
      throw error;
    }
  },

  // --- VENDORS (Additional) ---
  getVendorById: async (vendorId) => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('id', vendorId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching vendor:', error);
      throw error;
    }
  },

  // --- PRODUCTS ---
  getVendorProducts: async (vendorId) => {
    try {
      // First get all products for this vendor
      console.log('🔍 [PRODUCTS] Fetching products for vendor:', vendorId);
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (productsError) throw productsError;
      console.log('✅ [PRODUCTS] Found products:', products?.length || 0);
      if (!products || products.length === 0) {
        console.log('⚠️ [PRODUCTS] No products found for vendor');
        return [];
      }

      // Enrich each product with category and image data
      const enrichedProducts = await Promise.all(products.map(async (product) => {
        let categories = {};

        // Fetch category data if IDs exist
        if (product.head_category_id) {
          const { data: head } = await supabase
            .from('head_categories')
            .select('id, name, slug')
            .eq('id', product.head_category_id)
            .single();
          if (head) categories.head_category = head;
        }

        if (product.sub_category_id) {
          const { data: sub } = await supabase
            .from('sub_categories')
            .select('id, name, slug')
            .eq('id', product.sub_category_id)
            .single();
          if (sub) categories.sub_category = sub;
        }

        if (product.micro_category_id) {
          const { data: micro } = await supabase
            .from('micro_categories')
            .select('id, name, slug')
            .eq('id', product.micro_category_id)
            .single();
          if (micro) categories.micro_category = micro;
        }

        // Fetch product images
        const { data: images } = await supabase
          .from('product_images')
          .select('*')
          .eq('product_id', product.id);

        return {
          ...product,
          ...categories,
          product_images: images || []
        };
      }));

      return enrichedProducts;
    } catch (error) {
      console.error('Error fetching vendor products:', error);
      throw error;
    }
  },


  createProduct: async (productData) => {
    try {
      const emp = await getEmployeeContext();
      const payload = {
        ...productData,
        status: 'ACTIVE',
        created_by: emp.user_id,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('products')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  },

  updateProduct: async (productId, updates) => {
    try {
      console.log('🔄 Updating product:', productId, 'with data:', updates);
      
      // First verify product exists
      const { data: existingProduct, error: checkError } = await supabase
        .from('products')
        .select('id')
        .eq('id', productId)
        .single();
      
      if (checkError) {
        console.error('❌ Product check error:', checkError);
        throw new Error(`Product not found: ${checkError.message}`);
      }
      
      if (!existingProduct) {
        throw new Error('Product does not exist');
      }
      
      console.log('✅ Product exists, proceeding with update');
      
      // PATCH without select (RLS may prevent reading back)
      const { error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', productId);

      if (error) {
        console.error('❌ Update error:', error);
        throw error;
      }
      
      console.log('✅ Product updated successfully');
      // Return the updated object (data was passed in)
      return { id: productId, ...updates };
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  },

  addProductImage: async (productId, imageUrl) => {
    try {
      const { data, error } = await supabase
        .from('product_images')
        .insert([{ product_id: productId, image_url: imageUrl }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding product image:', error);
      throw error;
    }
  },

  addProduct: async (productData) => {
    try {
      const emp = await getEmployeeContext();
      const payload = {
        ...productData,
        status: 'ACTIVE',
        created_by: emp.user_id,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('products')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding product:', error);
      throw error;
    }
  },

  getCategoriesTree: async () => {
    try {
      // Load all categories with relationships in single query
      const { data: heads, error: headError } = await supabase
        .from('head_categories')
        .select(`
          id, name, slug,
          sub_categories(
            id, name, slug,
            micro_categories(id, name, slug)
          )
        `);

      if (headError) throw headError;

      const tree = (heads || []).map(head => ({
        ...head,
        subs: (head.sub_categories || []).map(sub => ({
          ...sub,
          micros: sub.micro_categories || []
        }))
      }));

      return tree;
    } catch (error) {
      console.error('Error fetching category tree:', error);
      throw error;
    }
  },

  getProduct: async (productId) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching product:', error);
      throw error;
    }
  },

  getProductById: async (productId) => {
    try {
      // Fetch basic product data
      const { data: product, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (error) throw error;

      // Fetch category details separately (no FK relationships in schema)
      const categories = {};
      
      if (product.head_category_id) {
        const { data: head } = await supabase
          .from('head_categories')
          .select('id, name, slug')
          .eq('id', product.head_category_id)
          .single();
        if (head) categories.head_category = head;
      }

      if (product.sub_category_id) {
        const { data: sub } = await supabase
          .from('sub_categories')
          .select('id, name, slug')
          .eq('id', product.sub_category_id)
          .single();
        if (sub) categories.sub_category = sub;
      }

      if (product.micro_category_id) {
        const { data: micro } = await supabase
          .from('micro_categories')
          .select('id, name, slug')
          .eq('id', product.micro_category_id)
          .single();
        if (micro) categories.micro_category = micro;
      }

      // Fetch product images separately
      const { data: images } = await supabase
        .from('product_images')
        .select('*')
        .eq('product_id', productId);

      return {
        ...product,
        ...categories,
        product_images: images || []
      };
    } catch (error) {
      console.error('Error fetching product details:', error);
      throw error;
    }
  },

  uploadProductMedia: async (file, type) => {
    try {
      const timestamp = Date.now();
      const filename = `${type}_${timestamp}_${file.name}`;
      const path = `products/${type}s/${filename}`;

      const { error: uploadError } = await supabase.storage
        .from('product-media')
        .upload(path, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('product-media')
        .getPublicUrl(path);

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading media:', error);
      throw error;
    }
  },

  // ============================================
  // VENDOR TABLE MAPPINGS - All vendor* tables
  // ============================================

  // --- vendor_documents (KYC docs) ---
  getVendorDocuments: async (vendorId) => {
    try {
      const { data, error } = await supabase
        .from('vendor_documents')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching vendor documents:', error);
      throw error;
    }
  },

  addVendorDocument: async (vendorId, documentType, documentUrl, originalName) => {
    try {
      const { data, error } = await supabase
        .from('vendor_documents')
        .insert([{ vendor_id: vendorId, document_type: documentType, document_url: documentUrl, original_name: originalName, verification_status: 'PENDING' }])
        .select().single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding vendor document:', error);
      throw error;
    }
  },

  // --- vendor_bank_details ---
  getVendorBankDetails: async (vendorId) => {
    try {
      const { data, error } = await supabase
        .from('vendor_bank_details')
        .select('*')
        .eq('vendor_id', vendorId);
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching bank details:', error);
      throw error;
    }
  },

  addBankAccount: async (vendorId, bankData) => {
    try {
      const { data, error } = await supabase
        .from('vendor_bank_details')
        .insert([{ vendor_id: vendorId, ...bankData, is_primary: bankData.is_primary || false }])
        .select().single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding bank account:', error);
      throw error;
    }
  },

  // --- vendor_contact_persons ---
  getVendorContacts: async (vendorId) => {
    try {
      const { data, error } = await supabase
        .from('vendor_contact_persons')
        .select('*')
        .eq('vendor_id', vendorId);
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching vendor contacts:', error);
      throw error;
    }
  },

  addContactPerson: async (vendorId, contactData) => {
    try {
      const { data, error } = await supabase
        .from('vendor_contact_persons')
        .insert([{ vendor_id: vendorId, ...contactData, is_primary: contactData.is_primary || false }])
        .select().single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding contact person:', error);
      throw error;
    }
  },

  // --- vendor_preferences ---
  getVendorPreferences: async (vendorId) => {
    try {
      const { data, error } = await supabase
        .from('vendor_preferences')
        .select('*')
        .eq('vendor_id', vendorId).single();
      if (error?.code === 'PGRST116') return null;
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching vendor preferences:', error);
      throw error;
    }
  },

  setVendorPreferences: async (vendorId, preferences) => {
    try {
      const { data: existing } = await supabase.from('vendor_preferences').select('id').eq('vendor_id', vendorId).single();
      let data, error;
      if (existing) {
        ({ data, error } = await supabase.from('vendor_preferences').update({ ...preferences, updated_at: new Date() }).eq('vendor_id', vendorId).select().single());
      } else {
        ({ data, error } = await supabase.from('vendor_preferences').insert([{ vendor_id: vendorId, ...preferences }]).select().single());
      }
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error setting vendor preferences:', error);
      throw error;
    }
  },

  // --- vendor_payments ---
  getVendorPayments: async (vendorId) => {
    try {
      const { data, error } = await supabase
        .from('vendor_payments')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching vendor payments:', error);
      throw error;
    }
  },

  recordVendorPayment: async (vendorId, paymentData) => {
    try {
      const { data, error } = await supabase
        .from('vendor_payments')
        .insert([{ vendor_id: vendorId, ...paymentData }])
        .select().single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error recording payment:', error);
      throw error;
    }
  },

  // --- vendor_messages ---
  getVendorMessages: async (vendorId) => {
    try {
      const { data, error } = await supabase
        .from('vendor_messages')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching vendor messages:', error);
      throw error;
    }
  },

  // --- vendor_lead_quota ---
  getVendorLeadQuota: async (vendorId) => {
    try {
      const { data, error } = await supabase
        .from('vendor_lead_quota')
        .select('*')
        .eq('vendor_id', vendorId).single();
      if (error?.code === 'PGRST116') return null;
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching lead quota:', error);
      throw error;
    }
  },

  // --- vendor_plan_subscriptions ---
  getVendorSubscriptions: async (vendorId) => {
    try {
      const { data, error } = await supabase
        .from('vendor_plan_subscriptions')
        .select('*, vendor_plans(*)')
        .eq('vendor_id', vendorId);
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching vendor subscriptions:', error);
      throw error;
    }
  },

  // --- vendor_plans ---
  getVendorPlans: async () => {
    try {
      const { data, error } = await supabase
        .from('vendor_plans')
        .select('*')
        .eq('is_active', true)
        .order('price');
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching vendor plans:', error);
      throw error;
    }
  },

  // --- vendor_additional_leads ---
  getAdditionalLeads: async (vendorId) => {
    try {
      const { data, error } = await supabase
        .from('vendor_additional_leads')
        .select('*')
        .eq('vendor_id', vendorId);
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching additional leads:', error);
      throw error;
    }
  },

  // --- vendor_subscriptions (services) ---
  getVendorServiceSubscriptions: async (vendorId) => {
    try {
      const { data, error } = await supabase
        .from('vendor_subscriptions')
        .select('*, vendor_services(*)')
        .eq('vendor_id', vendorId);
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching service subscriptions:', error);
      throw error;
    }
  },

  // --- vendor_otp_codes ---
  createVendorOTP: async (vendorId, email) => {
    try {
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60000).toISOString(); // 10 mins
      const { data, error } = await supabase
        .from('vendor_otp_codes')
        .insert([{ vendor_id: vendorId, otp_code: otpCode, email, expires_at: expiresAt }])
        .select().single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating OTP:', error);
      throw error;
    }
  }
};
