import { createClient } from '@supabase/supabase-js';
import {
  createReferralCashoutRequest,
  ensureVendorReferralProfile,
  getReferralSettings,
  linkReferralForVendor,
  normalizeReferralCode,
} from '../../server/lib/referralProgram.js';

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'itm_access';

const json = (statusCode, body, extraHeaders = {}) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    ...extraHeaders,
  },
  body: JSON.stringify(body),
});

const getSupabase = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
};

const parseRoute = (path = '') => {
  const parts = String(path || '').split('/').filter(Boolean);
  const idx = parts.lastIndexOf('referrals');
  const rest = idx >= 0 ? parts.slice(idx + 1) : [];
  return { action: rest[0] || '', params: rest.slice(1) };
};

const readBody = (event) => {
  if (!event?.body) return {};
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const normalizeText = (value) => String(value || '').trim();
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const parseCookies = (cookieHeader = '') => {
  const out = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return out;
  cookieHeader.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx < 0) return;
    const key = decodeURIComponent(part.slice(0, idx).trim());
    const value = decodeURIComponent(part.slice(idx + 1).trim());
    if (key) out[key] = value;
  });
  return out;
};

const getCookie = (event, name) => {
  const header = event?.headers?.cookie || event?.headers?.Cookie || '';
  const cookies = parseCookies(header);
  return cookies[name];
};

const parseBearerToken = (headers = {}) => {
  const header = headers.Authorization || headers.authorization;
  if (!header || typeof header !== 'string') return null;
  if (!header.startsWith('Bearer ')) return null;
  return header.replace('Bearer ', '').trim();
};

let warnedMissingJwtSecret = false;
const getJwtSecret = () => {
  const secret =
    process.env.JWT_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    throw new Error('Missing JWT_SECRET (or fallback secret) in environment');
  }

  if (!process.env.JWT_SECRET && !warnedMissingJwtSecret) {
    // eslint-disable-next-line no-console
    console.warn(
      '[Referrals] JWT_SECRET missing. Falling back to another secret. Configure a dedicated JWT_SECRET.'
    );
    warnedMissingJwtSecret = true;
  }

  return secret;
};

const verifyAuthToken = async (token) => {
  try {
    const jwt = await import('jsonwebtoken');
    return jwt.default.verify(token, getJwtSecret());
  } catch {
    return null;
  }
};

const resolveAuthUser = async (event, supabase) => {
  const token = parseBearerToken(event?.headers || {});
  if (token) {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user) {
      return {
        id: data.user.id,
        email: normalizeEmail(data.user.email || ''),
      };
    }
  }

  const cookieToken = getCookie(event, AUTH_COOKIE_NAME);
  if (!cookieToken) return null;
  const decoded = await verifyAuthToken(cookieToken);
  if (!decoded?.sub) return null;

  return {
    id: decoded.sub,
    email: normalizeEmail(decoded?.email || ''),
  };
};

async function resolveVendorForAuthUser(supabase, user = {}) {
  const userId = normalizeText(user?.id);
  const email = normalizeEmail(user?.email);

  if (userId) {
    const { data: byUserId, error: byUserErr } = await supabase
      .from('vendors')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (!byUserErr && byUserId) return byUserId;
  }

  if (email) {
    const { data: byEmail, error: byEmailErr } = await supabase
      .from('vendors')
      .select('*')
      .ilike('email', email)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!byEmailErr && byEmail) return byEmail;
  }

  return null;
}

export const handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });

    const supabase = getSupabase();
    const user = await resolveAuthUser(event, supabase);
    if (!user?.id) return json(401, { success: false, error: 'Unauthorized' });

    const vendor = await resolveVendorForAuthUser(supabase, user);
    if (!vendor?.id) return json(404, { success: false, error: 'Vendor profile not found' });

    const { action } = parseRoute(event.path);
    const body = readBody(event);

    // GET /api/referrals/me
    if (event.httpMethod === 'GET' && action === 'me') {
      const [profile, walletRes, settings, referredRowsRes, earnedRowsRes] = await Promise.all([
        ensureVendorReferralProfile(vendor, supabase),
        supabase
          .from('vendor_referral_wallets')
          .select('*')
          .eq('vendor_id', vendor.id)
          .maybeSingle(),
        getReferralSettings(supabase),
        supabase
          .from('vendor_referrals')
          .select('id, status, created_at, qualified_at, rewarded_at, referred_vendor_id')
          .eq('referrer_vendor_id', vendor.id)
          .order('created_at', { ascending: false })
          .limit(25),
        supabase
          .from('vendor_referral_wallet_ledger')
          .select('id, entry_type, amount, status, created_at, referral_id, payment_id')
          .eq('vendor_id', vendor.id)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (walletRes.error) throw walletRes.error;
      if (referredRowsRes.error) throw referredRowsRes.error;
      if (earnedRowsRes.error) throw earnedRowsRes.error;

      const rawReferrals = Array.isArray(referredRowsRes.data) ? referredRowsRes.data : [];
      const referredVendorIds = Array.from(
        new Set(rawReferrals.map((row) => String(row?.referred_vendor_id || '').trim()).filter(Boolean))
      );

      let vendorMap = {};
      if (referredVendorIds.length > 0) {
        const { data: vendors, error: vendorsErr } = await supabase
          .from('vendors')
          .select('id, company_name, vendor_id, email')
          .in('id', referredVendorIds);

        if (vendorsErr) throw vendorsErr;

        vendorMap = (vendors || []).reduce((acc, row) => {
          if (row?.id) acc[row.id] = row;
          return acc;
        }, {});
      }

      const referrals = rawReferrals.map((row) => ({
        ...row,
        referred_vendor: row?.referred_vendor_id ? vendorMap[row.referred_vendor_id] || null : null,
      }));

      const wallet = walletRes.data || {
        vendor_id: vendor.id,
        available_balance: 0,
        pending_balance: 0,
        lifetime_earned: 0,
        lifetime_paid_out: 0,
        updated_at: new Date().toISOString(),
      };

      return json(200, {
        success: true,
        data: {
          referral_profile: profile,
          wallet,
          settings: {
            is_enabled: Boolean(settings?.is_enabled),
            min_cashout_amount: Number(settings?.min_cashout_amount || 0),
          },
          referrals,
          ledger: earnedRowsRes.data || [],
        },
      });
    }

    // POST /api/referrals/link
    if (event.httpMethod === 'POST' && action === 'link') {
      const referralCode = normalizeReferralCode(body?.referral_code);
      if (!referralCode) {
        return json(400, { success: false, error: 'referral_code is required' });
      }

      try {
        const linked = await linkReferralForVendor(
          {
            referredVendor: vendor,
            referralCode,
          },
          supabase
        );
        return json(200, { success: true, data: linked });
      } catch (error) {
        const msg = String(error?.message || 'Failed to link referral');
        const status = msg.toLowerCase().includes('invalid referral') ? 400 : 500;
        return json(status, { success: false, error: msg });
      }
    }

    // GET /api/referrals/cashouts
    if (event.httpMethod === 'GET' && action === 'cashouts') {
      const { data, error } = await supabase
        .from('vendor_referral_cashout_requests')
        .select('*')
        .eq('vendor_id', vendor.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) return json(500, { success: false, error: error.message });
      return json(200, { success: true, data: data || [] });
    }

    // POST /api/referrals/cashout
    if (event.httpMethod === 'POST' && action === 'cashout') {
      const amount = Number(body?.amount || 0);
      const bankDetailId = normalizeText(body?.bank_detail_id || '');
      const note = normalizeText(body?.note || '');

      try {
        const requestRow = await createReferralCashoutRequest(
          {
            vendorId: vendor.id,
            amount,
            bankDetailId: bankDetailId || null,
            note: note || null,
          },
          supabase
        );
        return json(200, { success: true, data: requestRow });
      } catch (error) {
        return json(400, { success: false, error: error.message || 'Failed to create cashout request' });
      }
    }

    return json(404, { success: false, error: 'Invalid referrals route' });
  } catch (error) {
    console.error('Referrals function error:', error);
    return json(500, { success: false, error: error.message || 'Internal error' });
  }
};
