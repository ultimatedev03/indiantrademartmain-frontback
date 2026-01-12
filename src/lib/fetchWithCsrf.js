
import { supabase } from '@/lib/customSupabaseClient';

/**
 * A wrapper around native fetch that handles Supabase Auth tokens.
 * Automatically injects the JWT from the current session.
 */
export async function fetchWithCsrf(url, options = {}) {
  // 1. Get current session token
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  // 2. Set default headers including Authorization
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 3. Perform fetch
  const config = {
    ...options,
    headers,
  };

  // If calling an internal API route (not supabase direct), use fetch
  const response = await fetch(url, config);
  
  // Handle 401 unauthorized globally if needed
  if (response.status === 401) {
    // potentially trigger logout or refresh
  }

  return response;
}
