import express from 'express';
import nodemailer from 'nodemailer';
import { supabase } from '../lib/supabaseClient.js';

const router = express.Router();
const OTP_TTL_SECONDS = 120;
const IS_PRODUCTION = String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';

const sanitizeEnvValue = (value) => {
  if (typeof value !== 'string') return '';
  let cleaned = value.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith('\'') && cleaned.endsWith('\''))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned;
};

const readEnv = (...keys) => {
  for (const key of keys) {
    const value = sanitizeEnvValue(process.env[key]);
    if (value) return value;
  }
  return '';
};

const parseBoolean = (value, fallback = false) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return fallback;
};

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const isValidEmail = (email) => !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

function generateOtp() {
  let otp = '';
  for (let i = 0; i < 6; i += 1) {
    otp += Math.floor(Math.random() * 10);
  }
  return otp;
}

const SMTP_CONFIG = Object.freeze({
  host: readEnv('SMTP_HOST', 'MAIL_HOST'),
  port: Number.parseInt(readEnv('SMTP_PORT', 'MAIL_PORT') || '587', 10),
  secure: parseBoolean(readEnv('SMTP_SECURE', 'MAIL_SECURE'), false),
  user: readEnv('SMTP_USER', 'SMTP_USERNAME', 'MAIL_USER', 'MAIL_USERNAME'),
  pass: readEnv('SMTP_PASS', 'SMTP_PASSWORD', 'MAIL_PASS', 'MAIL_PASSWORD'),
});

const GMAIL_CONFIG = Object.freeze({
  email: readEnv('GMAIL_EMAIL', 'GMAIL_USER', 'VITE_GMAIL_EMAIL'),
  appPassword: readEnv('GMAIL_APP_PASSWORD', 'GMAIL_PASSWORD', 'VITE_GMAIL_APP_PASSWORD').replace(
    /[\s\u200B-\u200D\uFEFF]+/g,
    ''
  ),
});

const OTP_FROM_NAME = readEnv('OTP_FROM_NAME') || 'IndianTradeMart';
const OTP_FROM_EMAIL = readEnv('OTP_FROM_EMAIL');
const OTP_DEV_FALLBACK_ENABLED = parseBoolean(readEnv('OTP_DEV_FALLBACK'), !IS_PRODUCTION);

let cachedMailers = null;

const getMailers = () => {
  if (cachedMailers) return cachedMailers;

  const mailers = [];

  if (SMTP_CONFIG.host && SMTP_CONFIG.user && SMTP_CONFIG.pass) {
    mailers.push({
      provider: 'SMTP',
      fromEmail: OTP_FROM_EMAIL || SMTP_CONFIG.user,
      transporter: nodemailer.createTransport({
        host: SMTP_CONFIG.host,
        port: Number.isNaN(SMTP_CONFIG.port) ? 587 : SMTP_CONFIG.port,
        secure: SMTP_CONFIG.secure,
        auth: {
          user: SMTP_CONFIG.user,
          pass: SMTP_CONFIG.pass,
        },
      }),
    });
  }

  if (GMAIL_CONFIG.email && GMAIL_CONFIG.appPassword) {
    mailers.push({
      provider: 'GMAIL',
      fromEmail: OTP_FROM_EMAIL || GMAIL_CONFIG.email,
      transporter: nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: GMAIL_CONFIG.email,
          pass: GMAIL_CONFIG.appPassword,
        },
      }),
    });
  }

  if (!mailers.length) {
    throw new Error(
      'Email transporter is not configured. Set SMTP_* or GMAIL_EMAIL/GMAIL_APP_PASSWORD.'
    );
  }

  cachedMailers = mailers;
  return cachedMailers;
};

const buildOtpHtml = (otp) => `
  <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center;">
        <h2 style="color: #003D82;">Email Verification</h2>
        <p style="font-size: 16px; color: #333;">Your OTP verification code is:</p>
        <div style="background-color: #f0f0f0; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h1 style="color: #003D82; letter-spacing: 8px; font-size: 36px; margin: 0;">${otp}</h1>
        </div>
        <p style="color: #666; font-size: 14px;">This code will expire in 2 minutes.</p>
        <p style="color: #999; font-size: 12px; margin-top: 20px;">If you didn't request this code, please ignore this email.</p>
      </div>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
      <p style="text-align: center; color: #999; font-size: 11px;">
        &copy; ${new Date().getFullYear()} IndianTradeMart. All rights reserved.
      </p>
    </body>
  </html>
`;

async function sendOtpEmail(email, otp) {
  const mailers = getMailers();
  const failures = [];

  for (const mailer of mailers) {
    try {
      await mailer.transporter.sendMail({
        from: mailer.fromEmail ? `${OTP_FROM_NAME} <${mailer.fromEmail}>` : OTP_FROM_NAME,
        to: email,
        subject: `Your OTP Code: ${otp}`,
        html: buildOtpHtml(otp),
      });
      return;
    } catch (error) {
      const responseCode = Number(error?.responseCode);
      const isAuthError = error?.code === 'EAUTH' || responseCode === 535;
      failures.push({
        provider: mailer.provider,
        isAuthError,
        code: error?.code,
        responseCode,
      });
      console.error(`[OTP] ${mailer.provider} send failed`, {
        code: error?.code,
        responseCode: error?.responseCode,
      });
    }
  }

  if (failures.some((item) => item.isAuthError)) {
    throw new Error('Email service authentication failed. Please update SMTP/Gmail credentials.');
  }
  throw new Error('Failed to send OTP email');
}

const deliverOtpEmail = async (email, otp) => {
  try {
    await sendOtpEmail(email, otp);
    return { delivered: true, usedFallback: false };
  } catch (error) {
    if (!OTP_DEV_FALLBACK_ENABLED) throw error;

    console.warn('[OTP] Email delivery failed. Using local dev fallback.', {
      email,
      reason: error?.message || 'Unknown email delivery error',
    });
    console.info(`[OTP][DEV_FALLBACK] ${email} -> ${otp}`);

    return {
      delivered: false,
      usedFallback: true,
      reason: error?.message || 'Email delivery failed',
    };
  }
};

const buildSuccessResponse = ({ otp, delivery, message }) => {
  const payload = {
    success: true,
    message,
    expiresIn: OTP_TTL_SECONDS,
  };

  if (delivery?.usedFallback) {
    payload.delivery = 'dev_fallback';
    if (!IS_PRODUCTION) {
      payload.debug_otp = otp;
      payload.debug_reason = delivery.reason || null;
    }
  }

  return payload;
};

const upsertOtpForEmail = async (email) => {
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString();

  await supabase
    .from('auth_otps')
    .delete()
    .eq('email', email)
    .eq('used', false);

  const { error: dbError } = await supabase
    .from('auth_otps')
    .insert([
      {
        email,
        otp_code: otp,
        expires_at: expiresAt,
        used: false,
      },
    ]);

  if (dbError) {
    console.error('[OTP] Upsert failed:', dbError);
    throw new Error('Failed to generate OTP');
  }

  return otp;
};

// POST /api/otp/request - Request OTP
router.post('/request', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const otp = await upsertOtpForEmail(email);
    const delivery = await deliverOtpEmail(email, otp);

    return res.json(buildSuccessResponse({
      otp,
      delivery,
      message: delivery.usedFallback
        ? 'OTP generated (dev fallback mode)'
        : 'OTP sent successfully to your email',
    }));
  } catch (error) {
    console.error('OTP request error:', error);
    return res.status(500).json({ error: error.message || 'Failed to send OTP' });
  }
});

// POST /api/otp/verify - Verify OTP
router.post('/verify', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const otpCode = String(req.body?.otp_code || '').trim();

    if (!email || !otpCode) {
      return res.status(400).json({ error: 'Email and OTP code are required' });
    }

    const { data, error } = await supabase
      .from('auth_otps')
      .select('*')
      .eq('email', email)
      .eq('otp_code', otpCode)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Verification failed' });
    }
    if (!data) {
      return res.status(401).json({ error: 'Invalid or expired OTP code' });
    }

    await supabase
      .from('auth_otps')
      .update({ used: true })
      .eq('id', data.id);

    return res.json({
      success: true,
      message: 'OTP verified successfully',
      email,
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    return res.status(500).json({ error: error.message || 'Verification failed' });
  }
});

// POST /api/otp/resend - Resend OTP
router.post('/resend', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const otp = await upsertOtpForEmail(email);
    const delivery = await deliverOtpEmail(email, otp);

    return res.json(buildSuccessResponse({
      otp,
      delivery,
      message: delivery.usedFallback
        ? 'New OTP generated (dev fallback mode)'
        : 'New OTP sent to your email',
    }));
  } catch (error) {
    console.error('Resend OTP error:', error);
    return res.status(500).json({ error: error.message || 'Failed to resend OTP' });
  }
});

export default router;
