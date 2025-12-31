import { supabase } from '@/lib/customSupabaseClient';

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 2;

export const otpService = {
  /**
   * Generate 6-digit OTP
   */
  generateOtp: () => {
    let otp = '';
    for (let i = 0; i < OTP_LENGTH; i++) {
      otp += Math.floor(Math.random() * 10);
    }
    return otp;
  },

  /**
   * Request OTP to be sent to email
   * This calls a backend function or Supabase Edge Function
   */
  requestOtp: async (email) => {
    try {
      const apiUrl = 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/otp/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send OTP');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Request OTP Error:', error);
      throw error;
    }
  },

  /**
   * Verify OTP via backend API
   */
  verifyOtp: async (email, otpCode) => {
    try {
      if (!email || !otpCode) {
        throw new Error('Email and OTP code are required');
      }

      const apiUrl = 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/otp/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, otp_code: otpCode })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Invalid or expired OTP code');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Verify OTP Error:', error);
      throw error;
    }
  },

  /**
   * Resend OTP via backend API
   */
  resendOtp: async (email) => {
    try {
      const apiUrl = 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/otp/resend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to resend OTP');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Resend OTP Error:', error);
      throw error;
    }
  },

  /**
   * Create user in Supabase Auth after OTP verification
   * (custom registration without built-in email confirmation)
   */
  createAuthUser: async (email, password, userData = {}) => {
    try {
      // Create auth user with verified metadata since we verified via OTP
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            ...userData,
            role: 'VENDOR',
            email_verified: true
          }
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Create Auth User Error:', error);
      throw error;
    }
  }
};
