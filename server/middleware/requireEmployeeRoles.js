import { supabase } from '../lib/supabaseClient.js';

function parseBearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (!header || typeof header !== 'string') return null;
  if (!header.startsWith('Bearer ')) return null;
  return header.replace('Bearer ', '').trim();
}

function normalizeRole(role) {
  return String(role || '').trim().toUpperCase();
}

export function requireEmployeeRoles(allowedRoles = []) {
  const allowed = (allowedRoles || []).map(normalizeRole);

  return async (req, res, next) => {
    try {
      const token = parseBearerToken(req);
      if (!token) {
        return res.status(401).json({ success: false, error: 'Missing auth token' });
      }

      const { data: authData, error: authError } = await supabase.auth.getUser(token);
      if (authError || !authData?.user) {
        return res.status(401).json({ success: false, error: 'Invalid auth token' });
      }

      const authUser = authData.user;

      const { data: employee, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (empError) {
        return res.status(500).json({ success: false, error: empError.message });
      }

      if (!employee) {
        return res.status(403).json({ success: false, error: 'Employee profile not found' });
      }

      const role = normalizeRole(employee.role);
      const status = normalizeRole(employee.status || 'ACTIVE');

      if (status !== 'ACTIVE') {
        return res.status(403).json({ success: false, error: 'Employee account is not active' });
      }

      if (allowed.length > 0 && !allowed.includes(role)) {
        return res.status(403).json({ success: false, error: 'Insufficient role permissions' });
      }

      req.authUser = authUser;
      req.employee = employee;
      req.actor = {
        id: authUser.id,
        type: 'EMPLOYEE',
        role,
        email: authUser.email || employee.email || null,
      };

      return next();
    } catch (error) {
      console.error('[Auth] Employee role check failed:', error?.message || error);
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
  };
}

