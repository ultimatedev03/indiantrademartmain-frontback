import { createClient } from '@supabase/supabase-js';

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
  },
  body: JSON.stringify(body),
});

const getSupabase = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
};

const parseBearerToken = (headers = {}) => {
  const header = headers.Authorization || headers.authorization;
  if (!header || typeof header !== 'string') return null;
  if (!header.startsWith('Bearer ')) return null;
  return header.replace('Bearer ', '').trim();
};

const normalizeRole = (role) => String(role || '').trim().toUpperCase();

export const handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
    if (event.httpMethod !== 'GET') return json(405, { success: false, error: 'Method not allowed' });

    const token = parseBearerToken(event.headers || {});
    if (!token) return json(401, { success: false, error: 'Missing auth token' });

    const supabase = getSupabase();
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) return json(401, { success: false, error: 'Invalid auth token' });

    const authUser = authData.user;
    const email = String(authUser?.email || '').trim().toLowerCase();

    let employee = null;
    const { data: byId } = await supabase
      .from('employees')
      .select('*')
      .eq('user_id', authUser.id)
      .maybeSingle();
    if (byId) employee = byId;

    if (!employee && email) {
      const { data: byEmail } = await supabase
        .from('employees')
        .select('*')
        .eq('email', email)
        .maybeSingle();
      if (byEmail) employee = byEmail;
    }

    if (!employee) return json(404, { success: false, error: 'Employee profile not found' });

    if (!employee.user_id || employee.user_id !== authUser.id) {
      await supabase
        .from('employees')
        .update({ user_id: authUser.id })
        .eq('id', employee.id);
    }

    return json(200, {
      success: true,
      employee: { ...employee, user_id: authUser.id, role: normalizeRole(employee.role || 'UNKNOWN') },
    });
  } catch (error) {
    return json(500, { success: false, error: error.message || 'Failed to resolve employee profile' });
  }
};
