import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { validateStrongPassword } from '../../server/lib/passwordPolicy.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  // eslint-disable-next-line no-console
  console.error('[password-reset] Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_ROLE_KEY || '', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const isValidEmail = (email) => !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const nowIso = () => new Date().toISOString();
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const json = (statusCode, body) => ({
  statusCode,
  body: JSON.stringify(body),
});

const readBody = (event) => {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    return {};
  }
};

const updatePublicUserPasswordById = async (userId, passwordHash) => {
  const { data, error } = await supabase
    .from('users')
    .update({
      password_hash: passwordHash,
      updated_at: nowIso(),
    })
    .eq('id', userId)
    .select('id, email, password_hash')
    .maybeSingle();

  if (error) throw new Error(error.message || 'Failed to update public user password');
  return data || null;
};

const ensurePublicUserPassword = async ({ userId, email, role, newPassword }) => {
  const passwordHash = await bcrypt.hash(String(newPassword || ''), 10);

  const updatedById = await updatePublicUserPasswordById(userId, passwordHash);
  if (updatedById?.id) {
    return String(updatedById.id);
  }

  const { data: existingByEmail, error: existingByEmailError } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', email)
    .maybeSingle();

  if (existingByEmailError) {
    throw new Error(existingByEmailError.message || 'Failed to load public user');
  }

  if (existingByEmail?.id) {
    const updatedByEmailId = await updatePublicUserPasswordById(existingByEmail.id, passwordHash);
    if (updatedByEmailId?.id) {
      return String(updatedByEmailId.id);
    }
  }

  const payload = {
    id: userId,
    email,
    role: role || 'USER',
    password_hash: passwordHash,
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  const { data: inserted, error: insertError } = await supabase
    .from('users')
    .insert([payload])
    .select('id')
    .maybeSingle();

  if (insertError) {
    throw new Error(insertError.message || 'Failed to create public user password');
  }

  return String(inserted?.id || userId);
};

export const handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return json(405, { error: 'Method not allowed' });
    }

    const body = readBody(event);
    const emailRaw = body?.email;
    const roleRaw = body?.role;
    const newPassword = String(body?.new_password || '');

    if (!emailRaw || !isValidEmail(emailRaw)) {
      return json(400, { error: 'Valid email is required' });
    }

    const emailLower = normalizeEmail(emailRaw);

    // POST /api/password-reset/verify-email behavior
    if (!newPassword && roleRaw) {
      const normalizedRole = String(roleRaw).toUpperCase();

      if (normalizedRole !== 'BUYER' && normalizedRole !== 'VENDOR') {
        return json(400, { error: 'Invalid role' });
      }

      const table = normalizedRole === 'BUYER' ? 'buyers' : 'vendors';
      const { data, error } = await supabase
        .from(table)
        .select('id, email, user_id')
        .eq('email', emailLower)
        .maybeSingle();

      if (error) {
        // eslint-disable-next-line no-console
        console.error('[password-reset] verify-email failed:', error);
        return json(500, { error: 'Failed to verify email' });
      }

      if (!data) {
        return json(
          404,
          {
            error:
              normalizedRole === 'BUYER'
                ? 'This email is not registered as a buyer'
                : 'This email is not registered as a vendor',
          }
        );
      }

      return json(200, {
        success: true,
        found: true,
        role: normalizedRole,
        email: emailLower,
        message: 'Email verified successfully',
      });
    }

    // POST /api/password-reset behavior
    if (newPassword) {
      const passwordValidation = validateStrongPassword(newPassword);
      if (!passwordValidation.ok) {
        return json(400, { error: passwordValidation.error });
      }

      let userId = null;
      let userRole = null;

      const { data: buyer, error: buyerError } = await supabase
        .from('buyers')
        .select('user_id')
        .eq('email', emailLower)
        .maybeSingle();

      if (buyerError) {
        // eslint-disable-next-line no-console
        console.error('[password-reset] buyer lookup failed:', buyerError);
      }

      if (buyer?.user_id) {
        userId = String(buyer.user_id);
        userRole = 'BUYER';
      }

      if (!userId) {
        const { data: vendor, error: vendorError } = await supabase
          .from('vendors')
          .select('user_id')
          .eq('email', emailLower)
          .maybeSingle();

        if (vendorError) {
          // eslint-disable-next-line no-console
          console.error('[password-reset] vendor lookup failed:', vendorError);
        }

        if (vendor?.user_id) {
          userId = String(vendor.user_id);
          userRole = 'VENDOR';
        }
      }

      if (!userId) {
        return json(404, { error: 'Email not found in our records' });
      }

      let resolvedPublicUserId = userId;
      try {
        resolvedPublicUserId = await ensurePublicUserPassword({
          userId,
          email: emailLower,
          role: userRole || 'USER',
          newPassword,
        });
      } catch (publicSyncError) {
        return json(500, { error: publicSyncError.message || 'Failed to update login password' });
      }

      let authPasswordSynced = false;
      const authIdCandidates = Array.from(
        new Set([String(userId || '').trim(), String(resolvedPublicUserId || '').trim()].filter(Boolean))
      );

      for (const authUserId of authIdCandidates) {
        try {
          const { error: updateError } = await supabase.auth.admin.updateUserById(authUserId, {
            password: newPassword,
          });
          if (!updateError) {
            authPasswordSynced = true;
            break;
          }
        } catch {
          // Ignore sync failures for non-Supabase identities.
        }
      }

      return json(200, {
        success: true,
        message: 'Password has been reset successfully',
        email: emailLower,
        role: userRole,
        auth_password_synced: authPasswordSynced,
      });
    }

    return json(400, { error: 'Invalid request' });
  } catch (error) {
    return json(500, { error: error.message || 'Server error' });
  }
};
