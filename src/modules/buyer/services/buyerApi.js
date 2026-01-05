import { supabase } from '@/lib/customSupabaseClient';

// Helper to get current buyer ID from auth user
const getBuyerId = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  const { data: buyer, error } = await supabase
    .from('buyers')
    .select('id')
    .eq('user_id', user.id)
    .single();
    
  if (error || !buyer) {
    console.warn("Buyer profile not found for user:", user.id);
    throw new Error('Buyer profile not found');
  }
  return buyer.id;
};

export const buyerApi = {
  // --- AUTH & PROFILE ---
  auth: {
    me: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data: buyer } = await supabase
        .from('buyers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      return { ...user, ...buyer };
    },
    
    logout: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
  },

  // --- PROFILE MANAGEMENT ---
  getProfile: async (buyerId) => {
    if (!buyerId) {
      buyerId = await getBuyerId();
    }
    const { data, error } = await supabase
      .from('buyers')
      .select('*')
      .eq('id', buyerId)
      .single();
    if (error) throw error;
    return data;
  },

  updateProfile: async (updates) => {
    const buyerId = await getBuyerId();
    // Convert camelCase to snake_case for database
    const dbUpdates = {};
    for (const [key, value] of Object.entries(updates)) {
      if (key.includes('_') || ['id', 'user_id', 'created_at', 'updated_at'].includes(key)) {
        dbUpdates[key] = value;
      } else {
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
        dbUpdates[snakeKey] = value;
      }
    }
    const { data, error } = await supabase
      .from('buyers')
      .update(dbUpdates)
      .eq('id', buyerId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  uploadAvatar: async (file) => {
    const buyerId = await getBuyerId();
    const fileExt = file.name.split('.').pop();
    const fileName = `buyer-avatars/${buyerId}_${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true });
    
    if (uploadError) throw uploadError;
    
    const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
    
    // Update buyer profile with avatar
    await supabase.from('buyers').update({ avatar_url: data.publicUrl }).eq('id', buyerId);
    
    return data.publicUrl;
  },

  // --- STATISTICS ---
  getStats: async (buyerId) => {
    if (!buyerId) {
      buyerId = await getBuyerId();
    }
    
    const { count: proposals } = await supabase
      .from('proposals')
      .select('*', { count: 'exact', head: true })
      .eq('buyer_id', buyerId)
      .eq('status', 'SENT');
    
    const { count: tickets } = await supabase
      .from('support_tickets')
      .select('*', { count: 'exact', head: true })
      .eq('buyer_id', buyerId)
      .neq('status', 'CLOSED');
    
    const { count: favorites } = await supabase
      .from('favorites')
      .select('*', { count: 'exact', head: true })
      .eq('buyer_id', buyerId);
    
    return {
      activeProposals: proposals || 0,
      openTickets: tickets || 0,
      favoriteVendors: favorites || 0
    };
  },

  // --- PROPOSALS ---
  createProposal: async (proposalData) => {
    const buyerId = await getBuyerId();
    const { data: { user } } = await supabase.auth.getUser();
    
    // Get buyer profile for contact details
    const { data: buyerProfile } = await supabase
      .from('buyers')
      .select('*')
      .eq('id', buyerId)
      .single();
    
    // Determine buyer name and company
    const buyerName = buyerProfile?.company_name || user?.user_metadata?.full_name || user?.email || 'Buyer';
    const buyerCompany = buyerProfile?.company_name || user?.user_metadata?.full_name || '';
    const buyerEmail = user?.email || '';
    const buyerPhone = buyerProfile?.phone || buyerProfile?.mobile_number || '';
    
    const payload = {
      buyer_id: buyerId,
      vendor_id: proposalData.vendor_id || null,
      title: proposalData.title || proposalData.product_name || proposalData.category,
      product_name: proposalData.product_name || proposalData.category,
      quantity: proposalData.quantity,
      budget: parseFloat(proposalData.budget) || 0,
      required_by_date: proposalData.required_by_date || null,
      description: proposalData.description,
      status: 'SENT',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: proposal, error: propError } = await supabase
      .from('proposals')
      .insert([payload])
      .select()
      .single();

    if (propError) throw propError;
    
    // Create a lead record for ALL proposals (direct requirement to marketplace)
    // This will be visible in vendor's marketplace leads if no vendor_id, or as direct lead if vendor_id is set
    const leadPayload = {
      vendor_id: null, // Always null so ALL vendors can see it as marketplace lead
      title: payload.title,
      product_name: payload.product_name,
      category: proposalData.category || '',
      quantity: payload.quantity,
      budget: payload.budget,
      location: proposalData.location || 'India',
      city: proposalData.city || null,
      state: proposalData.state || null,
      message: payload.description,
      buyer_name: buyerName,
      buyer_email: buyerEmail,
      buyer_phone: buyerPhone,
      company_name: buyerCompany,
      status: 'AVAILABLE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      proposal_id: proposal.id
    };
    
    // Validate lead has required buyer fields
    if (!leadPayload.buyer_name || !leadPayload.buyer_email) {
      console.warn('Lead missing buyer details:', { buyer_name: leadPayload.buyer_name, buyer_email: leadPayload.buyer_email });
    }
    
    // Create lead with proper error handling
    const { error: leadError, data: leadData } = await supabase
      .from('leads')
      .insert([leadPayload])
      .select()
      .single();
    
    if (leadError) {
      console.error('Failed to create lead record:', leadError, 'Payload:', leadPayload);
      throw new Error(`Proposal created but failed to register as lead: ${leadError.message}`);
    }
    
    console.log('Lead created successfully:', leadData);
    return proposal;
  },

  getProposals: async (buyerId) => {
    if (!buyerId) {
      buyerId = await getBuyerId();
    }

    const { data, error } = await supabase
      .from('proposals')
      .select('*, vendors(company_name, profile_image)')
      .eq('buyer_id', buyerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  getProposalDetail: async (proposalId) => {
    const { data: proposal, error: propError } = await supabase
      .from('proposals')
      .select('*, vendors(company_name, profile_image, phone, email)')
      .eq('id', proposalId)
      .single();

    if (propError) throw propError;

    const { data: messages, error: msgError } = await supabase
      .from('proposal_messages')
      .select('*')
      .eq('proposal_id', proposalId)
      .order('created_at', { ascending: true });

    if (msgError) throw msgError;

    return {
      ...proposal,
      messages: messages || []
    };
  },

  addProposalMessage: async (proposalId, message) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('proposal_messages')
      .insert([{
        proposal_id: proposalId,
        sender_id: user.id,
        message: message,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  updateProposalStatus: async (proposalId, status) => {
    const { data, error } = await supabase
      .from('proposals')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', proposalId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // --- SUPPORT TICKETS ---
  createTicket: async (ticketData) => {
    const buyerId = await getBuyerId();
    
    const payload = {
      buyer_id: buyerId,
      subject: ticketData.subject,
      description: ticketData.description,
      priority: ticketData.priority || 'Medium',
      status: 'OPEN',
      category: ticketData.category || 'General Inquiry',
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('support_tickets')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  getTickets: async (buyerId) => {
    if (!buyerId) {
      buyerId = await getBuyerId();
    }

    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('buyer_id', buyerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  getTicketDetail: async (ticketId) => {
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (ticketError) throw ticketError;

    const { data: messages, error: messagesError } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (messagesError) throw messagesError;

    return { ...ticket, messages: messages || [] };
  },

  updateTicketStatus: async (ticketId, status) => {
    const { data, error } = await supabase
      .from('support_tickets')
      .update({ status })
      .eq('id', ticketId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  addTicketMessage: async (ticketId, message) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('ticket_messages')
      .insert([{
        ticket_id: ticketId,
        sender_id: user.id,
        sender_type: 'BUYER',
        message: message
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  getTicketMessages: async (ticketId) => {
    const { data, error } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  closeTicket: async (ticketId) => {
    return buyerApi.updateTicketStatus(ticketId, 'CLOSED');
  },

  // --- FAVORITES ---
  addFavorite: async (vendorId) => {
    const buyerId = await getBuyerId();

    const { data, error } = await supabase
      .from('favorites')
      .insert([{
        buyer_id: buyerId,
        vendor_id: vendorId,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  removeFavorite: async (vendorId) => {
    const buyerId = await getBuyerId();

    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('buyer_id', buyerId)
      .eq('vendor_id', vendorId);

    if (error) throw error;
  },

  getFavorites: async (buyerId) => {
    if (!buyerId) {
      buyerId = await getBuyerId();
    }

    const { data, error } = await supabase
      .from('favorites')
      .select('*, vendors(id, company_name, email, phone, profile_image, verification_badge, seller_rating)')
      .eq('buyer_id', buyerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  isFavorited: async (vendorId) => {
    const buyerId = await getBuyerId();

    const { data, error } = await supabase
      .from('favorites')
      .select('id')
      .eq('buyer_id', buyerId)
      .eq('vendor_id', vendorId)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  },

  // --- SUGGESTIONS ---
  getSuggestions: async () => {
    const buyerId = await getBuyerId();

    const { data, error } = await supabase
      .from('suggestions')
      .select('*')
      .eq('buyer_id', buyerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  createSuggestion: async (suggestionData) => {
    const buyerId = await getBuyerId();

    const { data, error } = await supabase
      .from('suggestions')
      .insert([{
        buyer_id: buyerId,
        subject: suggestionData.subject,
        message: suggestionData.message,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // --- DIRECTORY ---
  searchVendors: async (filters = {}) => {
    let query = supabase
      .from('vendors')
      .select('id, company_name, email, phone, profile_image, verification_badge, seller_rating, state, city');

    if (filters.state_id) {
      query = query.eq('state_id', filters.state_id);
    }
    if (filters.city_id) {
      query = query.eq('city_id', filters.city_id);
    }
    if (filters.search) {
      query = query.ilike('company_name', `%${filters.search}%`);
    }

    query = query.eq('is_active', true).eq('is_verified', true);

    const { data, error } = await query.order('seller_rating', { ascending: false }).limit(50);

    if (error) throw error;
    return data || [];
  },

  getVendorProfile: async (vendorId) => {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', vendorId)
      .single();

    if (error) throw error;
    return data;
  },

  getVendorProducts: async (vendorId) => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }
};
