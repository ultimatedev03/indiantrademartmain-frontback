import { supabase } from '@/lib/customSupabaseClient';

export const adminApi = {
  getStats: async () => {
    const [users, vendors, orders] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('vendors').select('*', { count: 'exact', head: true }),
      supabase.from('lead_purchases').select('*', { count: 'exact', head: true })
    ]);

    const { data: revenueData } = await supabase.from('lead_purchases').select('amount');
    const { data: subData } = await supabase.from('vendor_payments').select('amount');
    
    const totalRevenue = (revenueData?.reduce((a, b) => a + (b.amount || 0), 0) || 0) + 
                        (subData?.reduce((a, b) => a + (b.amount || 0), 0) || 0);

    return {
      totalUsers: users.count || 0,
      activeVendors: vendors.count || 0,
      totalOrders: orders.count || 0,
      totalRevenue: totalRevenue
    };
  },

  getRecentOrders: async () => {
    const { data, error } = await supabase
      .from('lead_purchases')
      .select('*, vendor:vendors(company_name)')
      .order('purchase_date', { ascending: false })
      .limit(10);
    if (error) throw error;
    return data;
  },

  getDataEntryPerformance: async () => {
    // Get all Data Entry employees
    const { data: employees } = await supabase
      .from('employees')
      .select('user_id, full_name')
      .eq('role', 'DATA_ENTRY');

    if (!employees) return [];

    // For each, count vendors created
    const performance = await Promise.all(employees.map(async (emp) => {
      const { count } = await supabase
        .from('vendors')
        .select('*', { count: 'exact', head: true })
        .eq('created_by_user_id', emp.user_id);
      
      // Count products for those vendors
      const { data: vendors } = await supabase
        .from('vendors')
        .select('id')
        .eq('created_by_user_id', emp.user_id);
        
      let productCount = 0;
      if (vendors && vendors.length > 0) {
         const vendorIds = vendors.map(v => v.id);
         const { count: pCount } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .in('vendor_id', vendorIds);
         productCount = pCount || 0;
      }

      return {
        id: emp.user_id,
        name: emp.full_name,
        vendorsCreated: count || 0,
        productsListed: productCount,
        kycVerified: 0 // Placeholder logic
      };
    }));

    return performance;
  },
  
  getVendorsByCreator: async (creatorId) => {
      const { data, error } = await supabase
        .from('vendors')
        .select('*, products(*)')
        .eq('created_by_user_id', creatorId);
      if (error) throw error;
      return data;
  },

  // ✅ Buyers API (NEW)
  buyers: {
    list: async () => {
      const { data, error } = await supabase
        .from('buyers')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    // Try to update using any of these columns if they exist
    setActive: async (buyerId, isActive, reason = '') => {
      const { data: current, error: curErr } = await supabase
        .from('buyers')
        .select('*')
        .eq('id', buyerId)
        .single();

      if (curErr) throw curErr;

      const updates = { updated_at: new Date().toISOString() };

      if (typeof current?.is_active === 'boolean' || ('is_active' in current)) {
        updates.is_active = !!isActive;
      }
      if (typeof current?.status === 'string' || ('status' in current)) {
        updates.status = isActive ? 'ACTIVE' : 'TERMINATED';
      }
      if ('terminated_at' in current) {
        updates.terminated_at = isActive ? null : new Date().toISOString();
      }
      if ('terminated_reason' in current) {
        updates.terminated_reason = isActive ? null : (reason || null);
      }

      const { error } = await supabase
        .from('buyers')
        .update(updates)
        .eq('id', buyerId);

      if (error) throw error;
    }
  },

  // Data Entry API - Products
  products: {
    list: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, vendor_id, vendors(company_name), status, created_at, price')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  },

  // Data Entry API - States
  states: {
    list: async () => {
      const { data, error } = await supabase
        .from('states')
        .select('*')
        .order('name');
      if (error) throw error;
      return data || [];
    },
    create: async (name) => {
      const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const { data, error } = await supabase
        .from('states')
        .insert([{ name, slug, is_active: true }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    update: async (id, name, isActive) => {
      const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const { data, error } = await supabase
        .from('states')
        .update({ name, slug, is_active: isActive })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    delete: async (id) => {
      const { error } = await supabase.from('states').delete().eq('id', id);
      if (error) throw error;
    }
  },

  // Data Entry API - Cities
  cities: {
    list: async () => {
      const { data, error } = await supabase
        .from('cities')
        .select('*, states(name)')
        .order('name');
      if (error) throw error;
      return data || [];
    },
    create: async (stateId, name) => {
      const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const { data, error } = await supabase
        .from('cities')
        .insert([{ state_id: stateId, name, slug, is_active: true }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    update: async (id, name, isActive) => {
      const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const { data, error } = await supabase
        .from('cities')
        .update({ name, slug, is_active: isActive })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    delete: async (id) => {
      const { error } = await supabase.from('cities').delete().eq('id', id);
      if (error) throw error;
    }
  },

  // Support Tickets API
  tickets: {
    list: async (filters = {}) => {
      let query = supabase
        .from('support_tickets')
        .select('*, vendors(company_name), buyers(full_name)')
        .order('created_at', { ascending: false });
      
      if (filters.status && filters.status !== 'ALL') {
        query = query.eq('status', filters.status);
      }
      if (filters.priority && filters.priority !== 'ALL') {
        query = query.eq('priority', filters.priority);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    
    getById: async (ticketId) => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*, vendors(company_name), buyers(full_name)')
        .eq('id', ticketId)
        .single();
      if (error) throw error;
      return data;
    },
    
    updateStatus: async (ticketId, status) => {
      const updates = { status, updated_at: new Date().toISOString() };
      if (status === 'CLOSED') {
        updates.resolved_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from('support_tickets')
        .update(updates)
        .eq('id', ticketId);
      if (error) throw error;
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
    
    sendMessage: async (ticketId, message, senderType = 'SUPPORT') => {
      const { data, error } = await supabase
        .from('ticket_messages')
        .insert([{
          ticket_id: ticketId,
          message: message,
          sender_type: senderType,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },

  // Vendors API
  vendors: {
    list: async (filters = {}) => {
      let query = supabase.from('vendors').select('*, products(count)').order('created_at', { ascending: false });
      
      if (filters.kycStatus && filters.kycStatus !== 'ALL') {
        query = query.eq('kyc_status', filters.kycStatus);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    
    getById: async (vendorId) => {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('id', vendorId)
        .single();
      if (error) throw error;
      return data;
    },
    
    approveKyc: async (vendorId) => {
      const { error } = await supabase
        .from('vendors')
        .update({ kyc_status: 'APPROVED', is_verified: true, verified_at: new Date().toISOString() })
        .eq('id', vendorId);
      if (error) throw error;
    },
    
    rejectKyc: async (vendorId, reason) => {
      const { error } = await supabase
        .from('vendors')
        .update({ kyc_status: 'REJECTED', is_verified: false, rejection_reason: reason })
        .eq('id', vendorId);
      if (error) throw error;
    }
  }
};