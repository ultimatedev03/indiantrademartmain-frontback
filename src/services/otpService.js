import { supabase } from '@/lib/customSupabaseClient';

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 2;

// ✅ Netlify Function base
const OTP_FN_BASE = '/.netlify/functions/otp';

export const otpService = {
  generateOtp: () => {
    let otp = '';
    for (let i = 0; i < OTP_LENGTH; i++) otp += Math.floor(Math.random() * 10);
    return otp;
  },

  requestOtp: async (email) => {
    try {
      if (!email) throw new Error('Email is required');

      // ✅ hit /request
      const response = await fetch(`${OTP_FN_BASE}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const errObj = await response.json().catch(() => ({}));
        throw new Error(errObj.error || 'Failed to send OTP');
      }

      return await response.json();
    } catch (error) {
      console.error('Request OTP Error:', error);
      throw error;
    }
  },

  verifyOtp: async (email, otpCode) => {
    try {
      if (!email || !otpCode) throw new Error('Email and OTP code are required');

      // ✅ hit /verify
      const response = await fetch(`${OTP_FN_BASE}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp_code: otpCode }),
      });

      if (!response.ok) {
        const errObj = await response.json().catch(() => ({}));
        throw new Error(errObj.error || 'Invalid or expired OTP code');
      }

      return await response.json();
    } catch (error) {
      console.error('Verify OTP Error:', error);
      throw error;
    }
  },

  resendOtp: async (email) => {
    try {
      if (!email) throw new Error('Email is required');

      // ✅ hit /resend
      const response = await fetch(`${OTP_FN_BASE}/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const errObj = await response.json().catch(() => ({}));
        throw new Error(errObj.error || 'Failed to resend OTP');
      }

      return await response.json();
    } catch (error) {
      console.error('Resend OTP Error:', error);
      throw error;
    }
  },

  createAuthUser: async (email, password, userData = {}) => {
    try {
      if (!email || !password) throw new Error('Email and password are required');

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            ...userData,
            role: 'VENDOR',
            email_verified: true, // metadata only
          },
        },
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Create Auth User Error:', error);
      throw error;
    }
  },
};
