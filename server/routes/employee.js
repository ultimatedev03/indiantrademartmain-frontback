import express from 'express';
import { supabase } from '../lib/supabaseClient.js';

const router = express.Router();

function parseBearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (!header || typeof header !== 'string') return null;
  if (!header.startsWith('Bearer ')) return null;
  return header.replace('Bearer ', '').trim();
}

const normalizeRole = (role) => String(role || '').trim().toUpperCase();

router.get('/me', async (req, res) => {
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

    if (!employee) {
      return res.status(404).json({ success: false, error: 'Employee profile not found' });
    }

    if (!employee.user_id || employee.user_id !== authUser.id) {
      await supabase
        .from('employees')
        .update({ user_id: authUser.id })
        .eq('id', employee.id);
    }

    return res.json({
      success: true,
      employee: {
        ...employee,
        user_id: authUser.id,
        role: normalizeRole(employee.role || 'UNKNOWN'),
      },
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || 'Failed to resolve employee profile' });
  }
});

export default router;
