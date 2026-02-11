import express from 'express';
import { supabase, supabaseAnon } from '../lib/supabaseClient.js';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  buildAuthUserPayload,
  clearAuthCookies,
  createCsrfToken,
  getAuthCookieNames,
  getCookie,
  hashPassword,
  isBcryptHash,
  normalizeEmail,
  normalizeRole,
  resolveRoleForUser,
  setAuthCookies,
  setPublicUserPassword,
  signAuthToken,
  syncProfileUserId,
  upsertPublicUser,
  verifyAuthToken,
  verifyPassword,
  getPublicUserByEmail,
  getPublicUserById,
} from '../lib/auth.js';

const router = express.Router();

const ENABLE_SUPABASE_AUTH_MIGRATION =
  String(process.env.ENABLE_SUPABASE_AUTH_MIGRATION || 'true').toLowerCase() !== 'false';

const ENABLE_SUPABASE_AUTH_SIGNUP =
  String(process.env.ENABLE_SUPABASE_AUTH_SIGNUP || 'true').toLowerCase() !== 'false';

const isValidEmail = (email) => !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

function issueSession(res, user) {
  const token = signAuthToken({
    sub: user.id,
    email: user.email,
    role: normalizeRole(user.role || 'USER'),
    type: 'USER',
  });
  const csrfToken = createCsrfToken();
  setAuthCookies(res, token, csrfToken);
  return buildAuthUserPayload(user);
}

async function ensureUserRole(user) {
  if (!user?.id) return user;
  const resolvedRole = await resolveRoleForUser({
    userId: user.id,
    email: user.email,
    fallbackRole: user.role,
  });

  if (resolvedRole && normalizeRole(user.role) !== normalizeRole(resolvedRole)) {
    return upsertPublicUser({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: resolvedRole,
      phone: user.phone,
      password_hash: user.password_hash,
      allowPasswordUpdate: false,
    });
  }

  return user;
}

async function assertUserActive(user) {
  if (!user?.id) return { ok: false, error: 'User not found' };
  const role = normalizeRole(user.role || 'USER');

  if (role === 'VENDOR') {
    const { data: vendor } = await supabase
      .from('vendors')
      .select('is_active')
      .or(
        [
          `user_id.eq.${user.id}`,
          user.email ? `email.eq.${user.email}` : null,
        ]
          .filter(Boolean)
          .join(',')
      )
      .maybeSingle();
    if (vendor && vendor.is_active === false) {
      return { ok: false, error: 'Vendor account is inactive' };
    }
  }

  if (role === 'BUYER') {
    const { data: buyer } = await supabase
      .from('buyers')
      .select('is_active')
      .or(
        [
          `user_id.eq.${user.id}`,
          user.email ? `email.eq.${user.email}` : null,
        ]
          .filter(Boolean)
          .join(',')
      )
      .maybeSingle();
    if (buyer && buyer.is_active === false) {
      return { ok: false, error: 'Buyer account is inactive' };
    }
  }

  if (['ADMIN', 'HR', 'DATA_ENTRY', 'SUPPORT', 'SALES', 'FINANCE', 'SUPERADMIN'].includes(role)) {
    const { data: emp } = await supabase
      .from('employees')
      .select('status')
      .or(
        [
          `user_id.eq.${user.id}`,
          user.email ? `email.eq.${user.email}` : null,
        ]
          .filter(Boolean)
          .join(',')
      )
      .maybeSingle();
    const status = String(emp?.status || 'ACTIVE').toUpperCase();
    if (emp && status !== 'ACTIVE') {
      return { ok: false, error: 'Employee account is inactive' };
    }
  }

  return { ok: true };
}

async function verifyViaSupabase(email, password) {
  if (!supabaseAnon?.auth?.signInWithPassword) {
    return { user: null, error: 'Supabase anon client not available' };
  }

  const { data, error } = await supabaseAnon.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data?.user) {
    return { user: null, error: error?.message || 'Invalid credentials' };
  }

  return { user: data.user, error: null };
}

router.post('/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }

    let user = await getPublicUserByEmail(email);

    if (user?.password_hash) {
      const ok = await verifyPassword(password, user.password_hash);
      if (!ok) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
      }

      if (!isBcryptHash(user.password_hash)) {
        const upgraded = await hashPassword(password);
        user = await upsertPublicUser({
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          phone: user.phone,
          password_hash: upgraded,
          allowPasswordUpdate: true,
        });
      }
    } else if (ENABLE_SUPABASE_AUTH_MIGRATION) {
      const { user: authUser, error } = await verifyViaSupabase(email, password);
      if (!authUser) {
        return res.status(401).json({ success: false, error: error || 'Invalid credentials' });
      }

      const resolvedRole = await resolveRoleForUser({
        userId: authUser.id,
        email,
        fallbackRole: authUser?.user_metadata?.role,
      });

      const password_hash = await hashPassword(password);

      user = await upsertPublicUser({
        id: authUser.id,
        email,
        full_name: authUser?.user_metadata?.full_name,
        role: resolvedRole,
        phone: authUser?.user_metadata?.phone,
        password_hash,
        allowPasswordUpdate: true,
      });

      await syncProfileUserId(authUser.id, email);
    } else {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    user = await ensureUserRole(user);

    const activeCheck = await assertUserActive(user);
    if (!activeCheck.ok) {
      return res.status(403).json({ success: false, error: activeCheck.error || 'Account inactive' });
    }

    const payload = issueSession(res, user);

    return res.json({ success: true, user: payload });
  } catch (error) {
    console.error('[Auth] Login failed:', error?.message || error);
    return res.status(500).json({ success: false, error: 'Login failed' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const full_name = String(req.body?.full_name || '').trim() || undefined;
    const role = normalizeRole(req.body?.role || 'USER');
    const phone = String(req.body?.phone || '').trim() || undefined;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long' });
    }

    const existing = await getPublicUserByEmail(email);
    if (existing?.id) {
      return res.status(409).json({ success: false, error: 'Email already registered' });
    }

    let userId = null;
    if (ENABLE_SUPABASE_AUTH_SIGNUP && supabase?.auth?.admin?.createUser) {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, role, phone },
        app_metadata: { role },
      });

      if (error || !data?.user) {
        return res.status(400).json({ success: false, error: error?.message || 'Auth signup failed' });
      }

      userId = data.user.id;
    }

    const password_hash = await hashPassword(password);

    const user = await upsertPublicUser({
      id: userId || undefined,
      email,
      full_name,
      role,
      phone,
      password_hash,
      allowPasswordUpdate: true,
    });

    await syncProfileUserId(user.id, email);

    const payload = issueSession(res, user);

    return res.json({ success: true, user: payload });
  } catch (error) {
    console.error('[Auth] Register failed:', error?.message || error);
    return res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

router.get('/me', async (req, res) => {
  try {
    const { AUTH_COOKIE_NAME, CSRF_COOKIE_NAME } = getAuthCookieNames();
    const token = getCookie(req, AUTH_COOKIE_NAME);
    if (!token) {
      return res.json({ user: null });
    }

    const decoded = verifyAuthToken(token);
    if (!decoded?.sub) {
      clearAuthCookies(res);
      return res.json({ user: null });
    }

    let user = await getPublicUserById(decoded.sub);
    if (!user && decoded?.email) {
      user = await getPublicUserByEmail(decoded.email);
    }

    if (!user) {
      return res.json({ user: null });
    }

    user = await ensureUserRole(user);

    // Refresh CSRF cookie if missing
    const csrfExisting = getCookie(req, CSRF_COOKIE_NAME);
    if (!csrfExisting) {
      const csrfToken = createCsrfToken();
      setAuthCookies(res, token, csrfToken);
    }

    return res.json({ user: buildAuthUserPayload(user) });
  } catch (error) {
    console.error('[Auth] Me failed:', error?.message || error);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.post('/logout', async (_req, res) => {
  clearAuthCookies(res);
  return res.json({ success: true });
});

router.patch('/password', requireAuth(), async (req, res) => {
  try {
    const currentPassword = String(req.body?.current_password || '');
    const newPassword = String(req.body?.new_password || req.body?.password || '');

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long' });
    }

    const user = await getPublicUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (user.password_hash && currentPassword) {
      const ok = await verifyPassword(currentPassword, user.password_hash);
      if (!ok) {
        return res.status(401).json({ success: false, error: 'Invalid current password' });
      }
    }

    await setPublicUserPassword(user.id, newPassword);

    return res.json({ success: true });
  } catch (error) {
    console.error('[Auth] Password update failed:', error?.message || error);
    return res.status(500).json({ success: false, error: 'Failed to update password' });
  }
});

export default router;
