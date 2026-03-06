import { supabase } from '@/lib/customSupabaseClient';

export const locationService = {
  // Fetch all states
  getStates: async () => {
    const { data, error } = await supabase
      .from('states')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    if (error) {
      console.error('Error fetching states (is_active filter):', error);
    }

    if (Array.isArray(data) && data.length > 0) return data;

    const { data: fallback, error: fallbackError } = await supabase
      .from('states')
      .select('*')
      .order('name');

    if (fallbackError) {
      console.error('Error fetching states:', fallbackError);
      return [];
    }
    return fallback || [];
  },

  // Fetch cities for a specific state
  getCities: async (stateId) => {
    if (!stateId) return [];
    
    const { data, error } = await supabase
      .from('cities')
      .select('*')
      .eq('state_id', stateId)
      .eq('is_active', true)
      .order('name');
      
    if (error) {
      console.error('Error fetching cities (is_active filter):', error);
    }

    if (Array.isArray(data) && data.length > 0) return data;

    const { data: fallback, error: fallbackError } = await supabase
      .from('cities')
      .select('*')
      .eq('state_id', stateId)
      .order('name');

    if (fallbackError) {
      console.error('Error fetching cities:', fallbackError);
      return [];
    }
    return fallback || [];
  },

  // Fetch cities by state slug for nearby navigation
  getCitiesByStateSlug: async (stateSlug) => {
    if (!stateSlug) return [];

    try {
      // First get state ID
      const { data: stateData, error: stateError } = await supabase
        .from('states')
        .select('id')
        .eq('slug', stateSlug)
        .single();

      if (stateError || !stateData) return [];

      // Then get cities
      const { data: cities, error: citiesError } = await supabase
        .from('cities')
        .select('*')
        .eq('state_id', stateData.id)
        .eq('is_active', true)
        .order('name');

      if (citiesError) return [];
      
      // Add fake cities if none exist (for demo purposes if DB is empty)
      if (cities.length === 0) {
         return [
            { id: '101', name: 'Gurugram', slug: 'gurugram' },
            { id: '102', name: 'Noida', slug: 'noida' },
            { id: '103', name: 'Faridabad', slug: 'faridabad' },
            { id: '104', name: 'Ghaziabad', slug: 'ghaziabad' },
            { id: '105', name: 'Rohtak', slug: 'rohtak' },
         ];
      }

      return cities;
    } catch (e) {
      console.error("Error fetching nearby cities", e);
      return [];
    }
  },

  // Helper to find location details by slug
  getLocationBySlug: async (stateSlug, citySlug) => {
    let state = null;
    let city = null;

    const normalizedStateSlug = String(stateSlug || '').trim();
    const normalizedCitySlug = String(citySlug || '').trim();

    if (normalizedStateSlug) {
      try {
        const { data: stateBySlug } = await supabase
          .from('states')
          .select('*')
          .eq('slug', normalizedStateSlug)
          .maybeSingle();
        state = stateBySlug || null;
      } catch (error) {
        console.error('State lookup failed', error);
      }
    }

    if (normalizedCitySlug && state?.id) {
      try {
        const { data: cityBySlug } = await supabase
          .from('cities')
          .select('*')
          .eq('slug', normalizedCitySlug)
          .eq('state_id', state.id)
          .maybeSingle();
        city = cityBySlug || null;
      } catch (error) {
        console.error('City lookup failed (state scoped)', error);
      }
    }

    if (normalizedCitySlug && !city) {
      try {
        const { data: cityFallback } = await supabase
          .from('cities')
          .select('*')
          .eq('slug', normalizedCitySlug)
          .maybeSingle();
        city = cityFallback || null;
      } catch (error) {
        console.error('City lookup failed', error);
      }
    }

    if (!state && city?.state_id) {
      try {
        const { data: stateFallback } = await supabase
          .from('states')
          .select('*')
          .eq('id', city.state_id)
          .maybeSingle();
        state = stateFallback || null;
      } catch (error) {
        console.error('State fallback lookup failed', error);
      }
    }

    return { state, city };
  },

  seedLocations: async () => {
      return true;
  }
};
