import express from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { normalizeEmail, setPublicUserPassword, upsertPublicUser } from '../lib/auth.js';

const router = express.Router();

// POST /api/password-reset - Reset password after OTP verification
router.post('/', async (req, res) => {
  try {
    const { email, new_password } = req.body;

    // Validate inputs
    if (!email || !new_password) {
      return res.status(400).json({ error: 'Email and new password are required' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const emailLower = normalizeEmail(email);

    // Step 1: Find user_id from buyers or vendors table
    let userId = null;
    let userRole = null;

    // Check in buyers table
    const { data: buyer, error: buyerError } = await supabase
      .from('buyers')
      .select('user_id, email')
      .eq('email', emailLower)
      .maybeSingle();

    if (buyer && buyer.user_id) {
      userId = buyer.user_id;
      userRole = 'BUYER';
    }

    // If not found in buyers, check vendors table
    if (!userId) {
      const { data: vendor, error: vendorError } = await supabase
        .from('vendors')
        .select('user_id, email')
        .eq('email', emailLower)
        .maybeSingle();

      if (vendor && vendor.user_id) {
        userId = vendor.user_id;
        userRole = 'VENDOR';
      }
    }

    if (!userId) {
      return res.status(404).json({ error: 'Email not found in our records' });
    }

    // Step 2: Update password in public.users (with self-heal for missing users row)
    try {
      await setPublicUserPassword(userId, new_password);
    } catch (passwordError) {
      if (String(passwordError?.message || '').toLowerCase().includes('target user not found')) {
        await upsertPublicUser({
          id: userId,
          email: emailLower,
          role: userRole || 'USER',
          allowPasswordUpdate: false,
        });
        await setPublicUserPassword(userId, new_password);
      } else {
        throw passwordError;
      }
    }

    // Step 3: Best-effort sync with Supabase auth.users
    let authPasswordSynced = false;
    try {
      const { error: authSyncError } = await supabase.auth.admin.updateUserById(userId, {
        password: new_password,
      });
      authPasswordSynced = !authSyncError;
    } catch {
      authPasswordSynced = false;
    }

    // Log the password reset event for security
    console.log(`✅ Password reset successfully for ${userRole} user: ${emailLower}`);

    res.json({
      success: true,
      message: 'Password has been reset successfully',
      email: emailLower,
      role: userRole,
      auth_password_synced: authPasswordSynced,
    });

  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: error.message || 'Failed to reset password' });
  }
});

// POST /api/password-reset/verify-email - Verify if email exists for password reset
router.post('/verify-email', async (req, res) => {
  try {
    const { email, role } = req.body;

    if (!email || !role) {
      return res.status(400).json({ error: 'Email and role are required' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const emailLower = email.toLowerCase().trim();

    // Verify the role matches by checking the specific table
    if (role === 'BUYER') {
      const { data: buyer, error: buyerError } = await supabase
        .from('buyers')
        .select('id, email, user_id')
        .eq('email', emailLower)
        .maybeSingle();

      if (buyerError) {
        console.error('Error checking buyer:', buyerError);
        return res.status(500).json({ error: 'Failed to verify email' });
      }

      if (!buyer) {
        return res.status(404).json({ error: 'This email is not registered as a buyer' });
      }

      return res.json({
        success: true,
        found: true,
        role: 'BUYER',
        email: emailLower,
        message: 'Email verified successfully'
      });

    } else if (role === 'VENDOR') {
      console.log('[verify-email] Checking vendor for email:', emailLower);
      const { data: vendor, error: vendorError } = await supabase
        .from('vendors')
        .select('id, email, user_id')
        .eq('email', emailLower)
        .maybeSingle();

      if (vendorError) {
        console.error('[verify-email] Error checking vendor:', vendorError);
        console.error('[verify-email] Query details - Email:', emailLower, 'Role:', role);
        return res.status(500).json({ error: 'Failed to verify email: ' + (vendorError.message || JSON.stringify(vendorError)) });
      }

      if (!vendor) {
        console.log('[verify-email] No vendor found for email:', emailLower);
        return res.status(404).json({ error: 'This email is not registered as a vendor' });
      }

      console.log('[verify-email] Vendor found:', vendor.email, 'UserID:', vendor.user_id);

      return res.json({
        success: true,
        found: true,
        role: 'VENDOR',
        email: emailLower,
        message: 'Email verified successfully'
      });

    } else {
      return res.status(400).json({ error: 'Invalid role' });
    }

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: error.message || 'Failed to verify email' });
  }
});

export default router;
