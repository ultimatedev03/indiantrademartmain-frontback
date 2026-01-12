import { createClient } from '@supabase/supabase-js';

// NOTE:
// - In Vite, only variables prefixed with VITE_ are exposed to the browser.
// - Keep Supabase URL + publishable/anon key in `.env.local`.
// - Do NOT put the service role key in frontend code.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // This helps catch the common issue where the app is built with missing env vars.
  // Without this, the admin panel silently shows 0/empty data.
  // eslint-disable-next-line no-console
  console.error(
    '[Supabase] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Check your .env.local and restart the dev server.'
  );
}

const customSupabaseClient = createClient(supabaseUrl || '', supabaseAnonKey || '');

export default customSupabaseClient;

export {
  customSupabaseClient,
  customSupabaseClient as supabase,
};
