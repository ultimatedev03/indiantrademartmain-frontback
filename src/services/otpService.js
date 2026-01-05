import { supabase } from '@/lib/customSupabaseClient';

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 2;

// Check if running locally or on Netlify
const isLocalDevelopment = () => {
  return typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
};

const OTP_FN_BASE = '/.netlify/functions/otp';

function generateOtp() {
  let otp = '';
  for (let i = 0; i < OTP_LENGTH; i++) otp += Math.floor(Math.random() * 10);
  return otp;
}

function isValidEmail(email) {
  return !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Local development: Use Supabase directly
async function requestOtpLocal(email) {
  if (!isValidEmail(email)) {
    throw new Error('Invalid email format');
  }

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

  // Delete old OTPs
  await supabase.from('auth_otps').delete().eq('email', email).eq('used', false);

  // Insert new OTP
  const { error: dbError } = await supabase.from('auth_otps').insert([{
    email,
    otp_code: otp,
    expires_at: expiresAt,
    used: false
  }]);

  if (dbError) {
    throw new Error('Failed to generate OTP');
  }

  // For local development, log it clearly
  const otpMessage = `\n${'='.repeat(60)}\n[LOCAL DEVELOPMENT - OTP CODE]\nEmail: ${email}\nOTP Code: ${otp}\nExpires in: ${OTP_EXPIRY_MINUTES} minutes\n${'='.repeat(60)}\n`;
  console.warn(otpMessage);
  console.log(otpMessage);

  return {
    success: true,
    message: `OTP Code: ${otp}\n\nCheck browser console for the code.\nThis OTP is also saved in database.`,
    expiresIn: OTP_EXPIRY_MINUTES * 60,
    otp: otp, // Show OTP in development for testing
    email: email
  };
}

async function verifyOtpLocal(email, otpCode) {
  if (!email || !otpCode) {
    throw new Error('Email and OTP code are required');
  }

  const { data, error } = await supabase
    .from('auth_otps')
    .select('*')
    .eq('email', email)
    .eq('otp_code', String(otpCode))
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error('Verification failed');
  }

  if (!data) {
    throw new Error('Invalid or expired OTP code');
  }

  await supabase.from('auth_otps').update({ used: true }).eq('id', data.id);

  return {
    success: true,
    message: 'OTP verified successfully',
    email
  };
}

async function resendOtpLocal(email) {
  return requestOtpLocal(email);
}

// Netlify production: Use functions
async function requestOtpProduction(email) {
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
}

async function verifyOtpProduction(email, otpCode) {
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
}

async function resendOtpProduction(email) {
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
}

export const otpService = {
  generateOtp: () => {
    let otp = '';
    for (let i = 0; i < OTP_LENGTH; i++) otp += Math.floor(Math.random() * 10);
    return otp;
  },

  requestOtp: async (email) => {
    try {
      if (!email) throw new Error('Email is required');

      // Use local or production based on environment
      if (isLocalDevelopment()) {
        return await requestOtpLocal(email);
      } else {
        return await requestOtpProduction(email);
      }
    } catch (error) {
      console.error('Request OTP Error:', error);
      throw error;
    }
  },

  verifyOtp: async (email, otpCode) => {
    try {
      if (!email || !otpCode) throw new Error('Email and OTP code are required');

      // Use local or production based on environment
      if (isLocalDevelopment()) {
        return await verifyOtpLocal(email, otpCode);
      } else {
        return await verifyOtpProduction(email, otpCode);
      }
    } catch (error) {
      console.error('Verify OTP Error:', error);
      throw error;
    }
  },

  resendOtp: async (email) => {
    try {
      if (!email) throw new Error('Email is required');

      // Use local or production based on environment
      if (isLocalDevelopment()) {
        return await resendOtpLocal(email);
      } else {
        return await resendOtpProduction(email);
      }
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
            role: userData.role || 'VENDOR',
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
