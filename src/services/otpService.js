import { supabase } from '@/lib/customSupabaseClient';

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 5;

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

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// Local development: Use Supabase directly
async function requestOtpLocal(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmail(normalizedEmail)) {
    throw new Error('Invalid email format');
  }

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

  // Delete old OTPs
  await supabase.from('auth_otps').delete().eq('email', normalizedEmail).eq('used', false);

  // Insert new OTP
  const { error: dbError } = await supabase.from('auth_otps').insert([{
    email: normalizedEmail,
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
    email: normalizedEmail
  };
}

async function verifyOtpLocal(email, otpCode) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedOtp = String(otpCode || '').trim();
  if (!normalizedEmail || !normalizedOtp) {
    throw new Error('Email and OTP code are required');
  }

  const { data, error } = await supabase
    .from('auth_otps')
    .select('*')
    .eq('email', normalizedEmail)
    .eq('otp_code', normalizedOtp)
    .eq('used', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error('Verification failed');
  }

  if (!data) {
    const { data: activeOtp } = await supabase
      .from('auth_otps')
      .select('id, expires_at')
      .eq('email', normalizedEmail)
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeOtp) {
      throw new Error('A newer OTP was sent. Please use the latest code.');
    }

    throw new Error('Invalid or expired OTP code');
  }

  const expiresAt = data?.expires_at ? new Date(data.expires_at) : null;
  if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
    throw new Error('OTP expired. Please request a new code.');
  }

  await supabase.from('auth_otps').update({ used: true }).eq('id', data.id);

  return {
    success: true,
    message: 'OTP verified successfully',
    email: normalizedEmail
  };
}

async function resendOtpLocal(email) {
  return requestOtpLocal(email);
}

// Netlify production: Use functions
async function requestOtpProduction(email) {
  const normalizedEmail = normalizeEmail(email);
  const response = await fetch(`${OTP_FN_BASE}/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizedEmail }),
  });

  if (!response.ok) {
    const errObj = await response.json().catch(() => ({}));
    throw new Error(errObj.error || 'Failed to send OTP');
  }

  return await response.json();
}

async function verifyOtpProduction(email, otpCode) {
  const normalizedEmail = normalizeEmail(email);
  const response = await fetch(`${OTP_FN_BASE}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizedEmail, otp_code: String(otpCode || '').trim() }),
  });

  if (!response.ok) {
    const errObj = await response.json().catch(() => ({}));
    throw new Error(errObj.error || 'Invalid or expired OTP code');
  }

  return await response.json();
}

async function resendOtpProduction(email) {
  const normalizedEmail = normalizeEmail(email);
  const response = await fetch(`${OTP_FN_BASE}/resend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizedEmail }),
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
      const normalizedEmail = normalizeEmail(email);

      // Use local or production based on environment
      if (isLocalDevelopment()) {
        return await requestOtpLocal(normalizedEmail);
      } else {
        return await requestOtpProduction(normalizedEmail);
      }
    } catch (error) {
      console.error('Request OTP Error:', error);
      throw error;
    }
  },

  verifyOtp: async (email, otpCode) => {
    try {
      if (!email || !otpCode) throw new Error('Email and OTP code are required');
      const normalizedEmail = normalizeEmail(email);

      // Use local or production based on environment
      if (isLocalDevelopment()) {
        return await verifyOtpLocal(normalizedEmail, otpCode);
      } else {
        return await verifyOtpProduction(normalizedEmail, otpCode);
      }
    } catch (error) {
      console.error('Verify OTP Error:', error);
      throw error;
    }
  },

  resendOtp: async (email) => {
    try {
      if (!email) throw new Error('Email is required');
      const normalizedEmail = normalizeEmail(email);

      // Use local or production based on environment
      if (isLocalDevelopment()) {
        return await resendOtpLocal(normalizedEmail);
      } else {
        return await resendOtpProduction(normalizedEmail);
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
