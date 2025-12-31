import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tldkwzextczqfnmesqhi.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZGt3emV4dGN6cWZubWVzcWhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3Mzg4MDEsImV4cCI6MjA4MTMxNDgwMX0.IicKQHQwGYU2dXbFp1rv_n8eIZR7kqJw3YIdkNQuvfM';

const customSupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export default customSupabaseClient;

export { 
    customSupabaseClient,
    customSupabaseClient as supabase,
};
