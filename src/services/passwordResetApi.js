// ❌ Frontend me supabase use NAHI karna
// ✅ Sirf Netlify Functions call karni hai

export const passwordResetApi = {
  // ===============================
  // STEP 1: Check email by role
  // ===============================
  checkEmailByRole: async (email, role) => {
    try {
      if (!email || !role) {
        throw new Error('Email and role are required');
      }

      const response = await fetch('/.netlify/functions/password-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          role
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Email not registered');
      }

      return data;
    } catch (error) {
      console.error('Error checking email by role:', error);
      throw error;
    }
  },

  // ===============================
  // STEP 2: Request OTP
  // ===============================
  requestOTP: async (email) => {
    try {
      if (!email) {
        throw new Error('Email is required');
      }

      const response = await fetch('/.netlify/functions/otp/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send OTP');
      }

      return data;
    } catch (error) {
      console.error('Error requesting OTP:', error);
      throw error;
    }
  },

  // ===============================
  // STEP 3: Verify OTP
  // ===============================
  verifyOTP: async (email, otpCode) => {
    try {
      if (!email || !otpCode) {
        throw new Error('Email and OTP are required');
      }

      const response = await fetch('/.netlify/functions/otp/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          otp_code: otpCode
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid or expired OTP');
      }

      return data;
    } catch (error) {
      console.error('Error verifying OTP:', error);
      throw error;
    }
  },

  // ===============================
  // STEP 4: RESET PASSWORD (🔥 FIXED)
  // ===============================
  resetPassword: async (email, newPassword) => {
    try {
      if (!email || !newPassword) {
        throw new Error('Email and new password are required');
      }

      if (newPassword.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      // ✅ ONLY backend call — NO supabase here
      const response = await fetch('/.netlify/functions/password-reset-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          new_password: newPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      return data;
    } catch (error) {
      console.error('Error resetting password:', error);
      throw error;
    }
  }
};
