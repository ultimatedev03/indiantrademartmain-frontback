import crypto from 'crypto';
import Razorpay from 'razorpay';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import {
  generateInvoiceNumber,
  generateInvoicePDF,
  generateInvoiceSummary,
} from '../../server/lib/invoiceGenerator.js';
import { consumeLeadForVendorWithCompat } from '../../server/lib/leadConsumptionCompat.js';
import {
  applyReferralRewardAfterPayment,
  getReferralSettings,
  getReferralOfferForVendor,
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

const getRazorpay = () => {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) return null;
  return new Razorpay({ key_id, key_secret });
};

const createTransporter = () => {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }

  if (process.env.GMAIL_EMAIL && process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_EMAIL, pass: process.env.GMAIL_APP_PASSWORD },
    });
  }

  return null;
};

const parseRoute = (eventPath = '') => {
  const parts = String(eventPath || '').split('/').filter(Boolean);
  const idx = parts.lastIndexOf('payment');
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

const parseBearerToken = (headers = {}) => {
  const header = headers.Authorization || headers.authorization;
  if (!header || typeof header !== 'string') return null;
  if (!header.startsWith('Bearer ')) return null;
  return header.replace('Bearer ', '').trim();
};

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
      '[Payment] JWT_SECRET missing. Falling back to another secret. Configure a dedicated JWT_SECRET.'
    );
    warnedMissingJwtSecret = true;
  }

  return secret;
};

const verifyAuthToken = (token) => {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch {
    return null;
  }
};

const normalizeText = (value) => String(value || '').trim();
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizeRole = (value) => String(value || '').trim().toUpperCase();
const normalizeCouponCode = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9_-]/g, '');

const GLOBAL_SCOPE_TOKENS = new Set(['ANY', 'ALL', 'GLOBAL', 'NULL', 'NONE']);

const normalizeScope = (value) => String(value || '').trim();

const isGlobalScope = (value) => {
  const scope = normalizeScope(value);
  if (!scope) return true;
  return GLOBAL_SCOPE_TOKENS.has(scope.toUpperCase());
};

const equalsIgnoreCase = (a, b) =>
  normalizeScope(a).toLowerCase() === normalizeScope(b).toLowerCase();

const isCouponVendorApplicable = (couponVendorScope, vendor) => {
  if (isGlobalScope(couponVendorScope)) return true;
  if (!vendor) return false;

  const scope = normalizeScope(couponVendorScope);
  const candidates = [vendor.id, vendor.vendor_id, vendor.email].filter(Boolean);
  return candidates.some((candidate) => equalsIgnoreCase(scope, candidate));
};

const isCouponPlanApplicable = (couponPlanScope, plan) => {
  if (isGlobalScope(couponPlanScope)) return true;
  if (!plan) return false;

  const scope = normalizeScope(couponPlanScope);
  const candidates = [plan.id, plan.name].filter(Boolean);
  return candidates.some((candidate) => equalsIgnoreCase(scope, candidate));
};

const parseCurrencyAmount = (value, fallback = 50) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, n);
};

const asObject = (value) => {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof value === 'object' && !Array.isArray(value) ? value : {};
};

const getPlanExtraLeadPrice = (plan) => {
  const features = asObject(plan?.features);
  const pricing = asObject(features?.pricing);
  return parseCurrencyAmount(pricing?.extra_lead_price, 0);
};

const resolvePaidLeadPrice = (lead, plan) => {
  const configuredPrice = getPlanExtraLeadPrice(plan);
  if (configuredPrice > 0) return configuredPrice;
  return parseCurrencyAmount(lead?.price, 50);
};

const isMissingPlanFeaturesColumn = (error) => {
  const code = String(error?.code || '').toUpperCase();
  if (code === '42703') return true;
  const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
  return message.includes('features') && message.includes('vendor_plans');
};

const isMissingRelationError = (error, relationName) => {
  const msg = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toUpperCase();
  const normalizedRelation = String(relationName || '').toLowerCase();
  if (code === '42P01') return true;
  if (!normalizedRelation) return false;
  return (
    (msg.includes('relation') && msg.includes(normalizedRelation) && msg.includes('does not exist')) ||
    (msg.includes('table') && msg.includes(normalizedRelation) && msg.includes('not found')) ||
    (msg.includes(normalizedRelation) && msg.includes('schema cache'))
  );
};

const consumeLeadForVendor = async (supabase, { vendorId, leadId, mode = 'AUTO', purchasePrice = 0 }) => {
  return consumeLeadForVendorWithCompat({
    supabase,
    vendorId,
    leadId,
    mode,
    purchasePrice,
  });
};

const getActiveVendorSubscription = async (supabase, vendorId) => {
  const nowIso = new Date().toISOString();
  const { data: rows, error } = await supabase
    .from('vendor_plan_subscriptions')
    .select('id, vendor_id, plan_id, status, start_date, end_date')
    .eq('vendor_id', vendorId)
    .eq('status', 'ACTIVE')
    .order('end_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    throw new Error(error.message || 'Failed to validate subscription');
  }

  const active = (rows || []).find((row) => !row?.end_date || String(row.end_date) > nowIso);
  return active || null;
};

const fetchVendorPlanForPricing = async (supabase, planId) => {
  if (!planId) return null;

  const full = await supabase
    .from('vendor_plans')
    .select('id, name, price, features')
    .eq('id', planId)
    .maybeSingle();

  if (!full?.error) return full?.data || null;
  if (!isMissingPlanFeaturesColumn(full.error)) {
    // eslint-disable-next-line no-console
    console.warn('Failed to fetch vendor plan pricing meta:', full.error?.message || full.error);
    return null;
  }

  const fallback = await supabase
    .from('vendor_plans')
    .select('id, name, price')
    .eq('id', planId)
    .maybeSingle();

  if (fallback?.error) {
    // eslint-disable-next-line no-console
    console.warn(
      'Failed to fetch vendor plan fallback pricing meta:',
      fallback.error?.message || fallback.error
    );
    return null;
  }

  return fallback?.data || null;
};

const resolveAuthenticatedUser = async (event, supabase) => {
  const bearer = parseBearerToken(event?.headers || {});
  if (bearer) {
    const { data: authData, error: authError } = await supabase.auth.getUser(bearer);
    if (authError || !authData?.user) return null;
    return {
      id: authData.user.id,
      email: normalizeEmail(authData.user?.email || ''),
      role: normalizeRole(
        authData.user?.app_metadata?.role ||
          authData.user?.user_metadata?.role ||
          authData.user?.role ||
          ''
      ),
    };
  }

  const cookieToken = getCookie(event, AUTH_COOKIE_NAME);
  if (!cookieToken) return null;
  const decoded = verifyAuthToken(cookieToken);
  if (!decoded?.sub) return null;
  return {
    id: decoded.sub,
    email: normalizeEmail(decoded?.email || ''),
    role: normalizeRole(decoded?.role || ''),
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

async function resolveOfferForPayment({
  supabase,
  couponCode = '',
  vendor = null,
  plan = null,
  baseAmount = 0,
  strictCoupon = false,
}) {
  const amount = Number(baseAmount || plan?.price || 0);
  const normalizedCode = normalizeCouponCode(couponCode);
  const hasProvidedCode = Boolean(normalizedCode);
  const fallback = {
    discountAmount: 0,
    netAmount: amount,
    coupon: null,
    offerType: null,
    offerCode: null,
    referralId: null,
    error: null,
  };

  if (!Number.isFinite(amount) || amount <= 0) {
    return fallback;
  }

  let couponFailureMessage = 'Coupon not found or inactive';

  if (hasProvidedCode) {
    const { data: cpn, error: couponErr } = await supabase
      .from('vendor_plan_coupons')
      .select('*')
      .ilike('code', normalizedCode)
      .eq('is_active', true)
      .maybeSingle();

    if (cpn && !couponErr) {
      const now = new Date();
      if (cpn.expires_at && new Date(cpn.expires_at) < now) {
        couponFailureMessage = 'Coupon expired';
      } else if (cpn.max_uses && cpn.max_uses > 0 && cpn.used_count >= cpn.max_uses) {
        couponFailureMessage = 'Coupon usage limit reached';
      } else if (!isCouponVendorApplicable(cpn.vendor_id, vendor)) {
        couponFailureMessage = 'Coupon not valid for this vendor';
      } else if (!isCouponPlanApplicable(cpn.plan_id, plan)) {
        couponFailureMessage = 'Coupon not valid for this plan';
      } else {
        let discountAmount = 0;
        if (cpn.discount_type === 'PERCENT') {
          discountAmount = (amount * Number(cpn.value)) / 100;
        } else {
          discountAmount = Number(cpn.value || 0);
        }
        if (!Number.isFinite(discountAmount)) discountAmount = 0;
        discountAmount = Math.max(0, Math.min(discountAmount, amount));

        return {
          discountAmount,
          netAmount: Math.max(0, amount - discountAmount),
          coupon: cpn,
          offerType: 'COUPON',
          offerCode: normalizedCode,
          referralId: null,
          error: null,
        };
      }
    } else if (couponErr) {
      couponFailureMessage = 'Coupon not found or inactive';
    }
  }

  try {
    const referralOffer = await getReferralOfferForVendor({
      vendor,
      plan,
      at: new Date(),
    }, supabase);

    const requestedReferralCode = normalizeReferralCode(normalizedCode);
    const offerCode = normalizeReferralCode(referralOffer?.offer_code || '');
    const discountAmountRaw = Number(referralOffer?.discount_amount || 0);
    const discountAmount = Number.isFinite(discountAmountRaw)
      ? Math.max(0, Math.min(discountAmountRaw, amount))
      : 0;
    const referralMatchesCode = !hasProvidedCode || (requestedReferralCode && offerCode === requestedReferralCode);

    if (offerCode && discountAmount > 0 && referralMatchesCode) {
      return {
        discountAmount,
        netAmount: Math.max(0, amount - discountAmount),
        coupon: null,
        offerType: 'REFERRAL',
        offerCode: referralOffer?.offer_code || offerCode,
        referralId: referralOffer?.referral_id || null,
        error: null,
      };
    }
  } catch (referralError) {
    // eslint-disable-next-line no-console
    console.warn('[payment] referral offer lookup failed:', referralError?.message || referralError);
  }

  if (strictCoupon && hasProvidedCode) {
    return {
      ...fallback,
      error: couponFailureMessage,
    };
  }

  return fallback;
}

async function writeAuditLog(supabase, { actor = null, action, entityType, entityId = null, details = {} }) {
  try {
    if (!action || !entityType) return;
    const safeActor = actor || {};
    await supabase.from('audit_logs').insert([
      {
        user_id: safeActor.id || null,
        action: String(action),
        entity_type: String(entityType),
        entity_id: entityId ? String(entityId) : null,
        details: {
          actor_id: safeActor.id || null,
          actor_type: safeActor.type || null,
          actor_role: safeActor.role || null,
          actor_email: safeActor.email || null,
          ...details,
        },
        created_at: new Date().toISOString(),
      },
    ]);
  } catch {
    // Audit should never block flow.
  }
}

export const handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return json(200, { ok: true });
    }

    const { action, params } = parseRoute(event.path);
    const body = readBody(event);
    const supabase = getSupabase();

    // GET /api/payment/plans
    if (event.httpMethod === 'GET' && action === 'plans') {
      const { data: plans, error } = await supabase
        .from('vendor_plans')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });

      if (error) return json(500, { error: error.message });
      return json(200, { success: true, data: plans || [] });
    }

    // GET /api/payment/referral-offers/:vendor_id
    if (event.httpMethod === 'GET' && action === 'referral-offers') {
      const vendor_id = normalizeText(params[0]);
      if (!vendor_id) return json(400, { error: 'Missing vendor_id' });

      const [{ data: vendor, error: vendorError }, { data: plans, error: plansError }, settings] = await Promise.all([
        supabase.from('vendors').select('*').eq('id', vendor_id).maybeSingle(),
        supabase
          .from('vendor_plans')
          .select('id, name, price, is_active')
          .eq('is_active', true)
          .order('price', { ascending: true }),
        getReferralSettings(supabase),
      ]);

      if (vendorError || !vendor) return json(404, { error: 'Vendor not found' });
      if (plansError) return json(500, { error: plansError.message || 'Failed to load plans' });

      const offerMap = {};
      const now = new Date();
      for (const plan of plans || []) {
        const planId = String(plan?.id || '').trim();
        if (!planId) continue;

        const baseAmountRaw = Number(plan?.price || 0);
        const baseAmount = Number.isFinite(baseAmountRaw) ? Math.max(0, baseAmountRaw) : 0;

        let discountAmount = 0;
        let offerCode = null;
        let configuredDiscountType = null;
        let configuredDiscountValue = 0;
        let configuredDiscountCap = null;
        if (baseAmount > 0 && settings?.is_enabled) {
          try {
            const referralOffer = await getReferralOfferForVendor(
              { vendor, plan, at: now },
              supabase
            );
            const configuredTypeRaw = String(referralOffer?.rule?.discount_type || '').toUpperCase();
            configuredDiscountType = configuredTypeRaw || null;
            const configuredValueRaw = Number(referralOffer?.rule?.discount_value || 0);
            configuredDiscountValue = Number.isFinite(configuredValueRaw)
              ? Math.max(0, configuredValueRaw)
              : 0;
            const configuredCapRaw = Number(referralOffer?.rule?.discount_cap);
            configuredDiscountCap = Number.isFinite(configuredCapRaw) && configuredCapRaw > 0
              ? configuredCapRaw
              : null;
            const rawDiscount = Number(referralOffer?.discount_amount || 0);
            discountAmount = Number.isFinite(rawDiscount)
              ? Math.max(0, Math.min(rawDiscount, baseAmount))
              : 0;
            offerCode = referralOffer?.offer_code || null;
          } catch (error) {
            // eslint-disable-next-line no-console
            console.warn('[payment/referral-offers] offer lookup failed:', error?.message || error);
          }
        }

        const netAmount = Math.max(0, baseAmount - discountAmount);
        const effectiveDiscountPercent = baseAmount > 0
          ? Number(((discountAmount / baseAmount) * 100).toFixed(2))
          : 0;
        const displayDiscountPercent =
          configuredDiscountType === 'PERCENT' && configuredDiscountValue > 0
            ? configuredDiscountValue
            : effectiveDiscountPercent;

        offerMap[planId] = {
          plan_id: planId,
          base_amount: baseAmount,
          discount_amount: discountAmount,
          net_amount: netAmount,
          discount_percent: effectiveDiscountPercent,
          display_discount_percent: displayDiscountPercent,
          configured_discount_type: discountAmount > 0 ? configuredDiscountType : null,
          configured_discount_value: discountAmount > 0 ? configuredDiscountValue : 0,
          configured_discount_cap: discountAmount > 0 ? configuredDiscountCap : null,
          offer_type: discountAmount > 0 ? 'REFERRAL' : null,
          offer_code: discountAmount > 0 ? offerCode : null,
        };
      }

      return json(200, {
        success: true,
        data: {
          settings: {
            is_enabled: Boolean(settings?.is_enabled),
            first_paid_plan_only: Boolean(settings?.first_paid_plan_only),
          },
          offers: offerMap,
        },
      });
    }

    // GET /api/payment/history/:vendor_id
    if (event.httpMethod === 'GET' && action === 'history') {
      const vendor_id = params[0];
      if (!vendor_id) return json(400, { error: 'Missing vendor_id' });

      const { data: payments, error } = await supabase
        .from('vendor_payments')
        .select('*')
        .eq('vendor_id', vendor_id)
        .order('payment_date', { ascending: false });

      if (error) return json(500, { error: error.message });
      return json(200, { success: true, data: payments || [] });
    }

    // GET /api/payment/invoice/:payment_id
    // GET /api/payment/invoice/by-tx/:transaction_id
    if (event.httpMethod === 'GET' && action === 'invoice') {
      const refresh = String(event.queryStringParameters?.refresh || '').toLowerCase() === 'true';

      const loadInvoiceByPaymentId = async (paymentId) => {
        const { data: payment, error } = await supabase
          .from('vendor_payments')
          .select('*')
          .eq('id', paymentId)
          .maybeSingle();
        if (error || !payment) return { payment: null, error: 'Payment not found' };
        return { payment, error: null };
      };

      const loadInvoiceByTransactionId = async (transactionId) => {
        const { data: payment, error } = await supabase
          .from('vendor_payments')
          .select('*')
          .eq('transaction_id', transactionId)
          .maybeSingle();
        if (error || !payment) return { payment: null, error: 'Payment not found' };
        return { payment, error: null };
      };

      let lookup = null;
      if (params[0] === 'by-tx') {
        const transactionId = params[1];
        if (!transactionId) return json(400, { error: 'Missing transaction_id' });
        lookup = await loadInvoiceByTransactionId(transactionId);
      } else {
        const paymentId = params[0];
        if (!paymentId) return json(400, { error: 'Missing payment_id' });
        lookup = await loadInvoiceByPaymentId(paymentId);
      }

      if (!lookup?.payment) {
        return json(404, { error: lookup?.error || 'Payment not found' });
      }

      const payment = lookup.payment;
      if (refresh || !payment.invoice_url) {
        const [{ data: vendor }, { data: plan }] = await Promise.all([
          supabase.from('vendors').select('*').eq('id', payment.vendor_id).maybeSingle(),
          supabase.from('vendor_plans').select('*').eq('id', payment.plan_id).maybeSingle(),
        ]);

        const invoicePdfData = {
          invoiceNumber: payment.invoice_number || generateInvoiceNumber(),
          invoiceDate: payment.payment_date || new Date(),
          dueDate: payment.payment_date || new Date(),
          vendor: vendor || {},
          plan: plan || {},
          amount: payment.amount,
          discount_amount: payment.discount_amount || 0,
          coupon_code: payment.coupon_code || '',
          tax: payment.tax_amount || 0,
          totalAmount: payment.net_amount || payment.amount,
          paymentMethod: payment.payment_method || 'Razorpay',
          transactionId: payment.transaction_id,
        };

        const newPdf = generateInvoicePDF(invoicePdfData);
        await supabase
          .from('vendor_payments')
          .update({
            invoice_url: newPdf,
            invoice_number: invoicePdfData.invoiceNumber,
          })
          .eq('id', payment.id);

        payment.invoice_url = newPdf;
      }

      if (!payment.invoice_url) return json(404, { error: 'Invoice not available' });
      return json(200, { success: true, invoice: payment.invoice_url });
    }

    // POST /api/payment/initiate
    if (event.httpMethod === 'POST' && action === 'initiate') {
      const razorpay = getRazorpay();
      if (!razorpay) {
        return json(500, {
          error: 'Payment gateway not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Netlify environment variables.',
        });
      }

      const { vendor_id, plan_id } = body;
      if (!vendor_id || !plan_id) return json(400, { error: 'Missing vendor_id or plan_id' });

      const { data: vendor, error: vendorError } = await supabase
        .from('vendors')
        .select('*')
        .eq('id', vendor_id)
        .single();

      if (vendorError || !vendor) return json(404, { error: 'Vendor not found' });

      const { data: plan, error: planError } = await supabase
        .from('vendor_plans')
        .select('*')
        .eq('id', plan_id)
        .single();

      if (planError || !plan) return json(404, { error: 'Plan not found' });

      const baseAmount = Number(plan.price || 0);
      if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
        return json(400, { error: 'Invalid plan price' });
      }

      const coupon_code = normalizeCouponCode(body?.coupon_code);
      const offer = await resolveOfferForPayment({
        supabase,
        couponCode: coupon_code,
        vendor,
        plan,
        baseAmount,
        strictCoupon: true,
      });
      if (offer?.error) return json(400, { error: offer.error });

      const discountAmount = Number(offer?.discountAmount || 0);
      const netAmount = Number(offer?.netAmount ?? baseAmount);
      const offerType = offer?.offerType || null;
      const offerCode = offer?.offerCode || (coupon_code || null);
      const referralId = offer?.referralId || null;

      const amount = Math.max(1, Math.round(netAmount * 100));
      if (!Number.isFinite(amount) || amount <= 0) return json(400, { error: 'Invalid plan price' });

      const shortId = `${String(vendor_id).substring(0, 8)}_${Math.random().toString(36).substring(2, 8)}`;
      const order = await razorpay.orders.create({
        amount,
        currency: 'INR',
        receipt: shortId,
        payment_capture: 1,
        notes: {
          vendor_id,
          plan_id,
          vendor_email: vendor.email,
          vendor_name: vendor.company_name,
          coupon_code: offerCode || '',
        },
      });

      return json(200, {
        success: true,
        key_id: process.env.RAZORPAY_KEY_ID,
        order: {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
          vendor_id,
          plan_id,
          plan_name: plan.name,
          vendor_email: vendor.email,
          net_amount: netAmount,
          discount_amount: discountAmount,
          coupon_code: offerCode || null,
          offer_type: offerType,
          referral_id: referralId,
        },
      });
    }

    // POST /api/payment/verify
    if (event.httpMethod === 'POST' && action === 'verify') {
      const { order_id, payment_id, signature, vendor_id, plan_id } = body;
      const coupon_code = normalizeCouponCode(body?.coupon_code);

      if (!order_id || !payment_id || !signature || !vendor_id || !plan_id) {
        return json(400, { error: 'Missing required fields' });
      }

      if (!process.env.RAZORPAY_KEY_SECRET) {
        return json(500, { error: 'Payment gateway not configured (missing RAZORPAY_KEY_SECRET).' });
      }

      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${order_id}|${payment_id}`)
        .digest('hex');

      if (expectedSignature !== signature) {
        return json(400, { error: 'Invalid payment signature' });
      }

      const { data: vendor } = await supabase
        .from('vendors')
        .select('*')
        .eq('id', vendor_id)
        .single();

      const { data: plan } = await supabase
        .from('vendor_plans')
        .select('*')
        .eq('id', plan_id)
        .single();

      if (!vendor || !plan) return json(404, { error: 'Vendor or plan not found' });

      await supabase
        .from('vendor_plan_subscriptions')
        .update({ status: 'INACTIVE' })
        .eq('vendor_id', vendor_id)
        .eq('status', 'ACTIVE');

      const offer = await resolveOfferForPayment({
        supabase,
        couponCode: coupon_code,
        vendor,
        plan,
        baseAmount: Number(plan.price || 0),
        strictCoupon: false,
      });
      const discountAmount = Number(offer?.discountAmount || 0);
      const netAmount = Number(offer?.netAmount ?? Number(plan.price || 0));
      const coupon = offer?.coupon || null;
      const offerType = offer?.offerType || null;
      const offerCode = offer?.offerCode || (coupon_code || null);
      const referralId = offer?.referralId || null;

      const invoiceNumber = generateInvoiceNumber();
      const durationDays = Number(plan.duration_days || 365);
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + (Number.isFinite(durationDays) ? durationDays : 365));

      const { data: subscription, error: subscriptionError } = await supabase
        .from('vendor_plan_subscriptions')
        .insert([
          {
            vendor_id,
            plan_id,
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            status: 'ACTIVE',
            plan_duration_days: Number.isFinite(durationDays) ? durationDays : 365,
          },
        ])
        .select()
        .single();

      if (subscriptionError) {
        return json(500, { error: 'Failed to create subscription' });
      }

      const price = Number(plan.price || 0);
      const invoicePdfData = {
        invoiceNumber,
        invoiceDate: new Date(),
        dueDate: new Date(),
        vendor,
        plan,
        amount: price,
        discount_amount: discountAmount,
        coupon_code: offerCode || null,
        tax: 0,
        totalAmount: netAmount,
        paymentMethod: 'Razorpay',
        transactionId: payment_id,
      };

      const invoicePdf = generateInvoicePDF(invoicePdfData);

      const { data: payment, error: paymentError } = await supabase
        .from('vendor_payments')
        .insert([
          {
            vendor_id,
            plan_id,
            subscription_id: subscription.id,
            amount: price,
            discount_amount: discountAmount,
            net_amount: netAmount,
            description: `Subscription: ${plan.name}`,
            status: 'COMPLETED',
            payment_method: 'Razorpay',
            transaction_id: payment_id,
            payment_date: new Date().toISOString(),
            invoice_url: invoicePdf,
            coupon_code: offerCode || null,
            offer_type: offerType,
            offer_code: offerCode || null,
            referral_id: referralId,
          },
        ])
        .select()
        .single();

      if (!paymentError && coupon) {
        await supabase
          .from('vendor_plan_coupons')
          .update({ used_count: (coupon.used_count || 0) + 1 })
          .eq('id', coupon.id);
        await supabase.from('vendor_coupon_usages').insert([
          {
            coupon_id: coupon.id,
            payment_id: payment?.id || null,
            vendor_id,
            plan_id,
            discount_amount: discountAmount,
            net_amount: netAmount,
          },
        ]);
      }

      if (!paymentError && payment && offerType === 'REFERRAL') {
        try {
          await applyReferralRewardAfterPayment(
            {
              referredVendorId: vendor_id,
              plan,
              paymentRow: payment,
              netAmount,
            },
            supabase
          );
        } catch (referralRewardError) {
          // eslint-disable-next-line no-console
          console.warn(
            '[payment] referral reward application failed:',
            referralRewardError?.message || referralRewardError
          );
        }
      }

      try {
        const transporter = createTransporter();
        if (transporter && vendor.email) {
          const invoiceSummary = generateInvoiceSummary(invoicePdfData);
          const base64Part = String(invoicePdf).includes(',') ? String(invoicePdf).split(',')[1] : '';
          await transporter.sendMail({
            from: process.env.GMAIL_EMAIL || process.env.SMTP_USER,
            to: vendor.email,
            subject: `Invoice ${invoiceNumber} - Subscription Purchase`,
            html: `
              <h2>Subscription Confirmation</h2>
              <p>Dear ${vendor.company_name || 'Vendor'},</p>
              <p>Your subscription has been successfully activated.</p>
              ${invoiceSummary}
              <p><strong>Subscription Period:</strong> ${startDate.toLocaleDateString('en-IN')} to ${endDate.toLocaleDateString('en-IN')}</p>
              <p>Thank you for choosing Indian Trade Mart!</p>
            `,
            ...(base64Part
              ? {
                  attachments: [
                    {
                      filename: `${invoiceNumber}.pdf`,
                      content: base64Part,
                      encoding: 'base64',
                      contentType: 'application/pdf',
                    },
                  ],
                }
              : {}),
          });
        }
      } catch {
        // ignore email failures
      }

      return json(200, {
        success: true,
        message: 'Payment verified and subscription activated',
        subscription,
        payment,
      });
    }

    // POST /api/payment/lead/initiate
    if (event.httpMethod === 'POST' && action === 'lead' && params[0] === 'initiate') {
      if (!process.env.RAZORPAY_KEY_ID || String(process.env.RAZORPAY_KEY_ID).includes('your_razorpay')) {
        return json(500, { error: 'Payment gateway not configured' });
      }

      const authUser = await resolveAuthenticatedUser(event, supabase);
      if (!authUser?.id) return json(401, { error: 'Unauthorized' });

      const leadId = normalizeText(body?.lead_id);
      if (!leadId) return json(400, { error: 'Missing lead_id' });

      const vendor = await resolveVendorForAuthUser(supabase, authUser);
      if (!vendor?.id) return json(404, { error: 'Vendor profile not found' });

      const activeSubscription = await getActiveVendorSubscription(supabase, vendor.id);
      if (!activeSubscription) {
        return json(403, { error: 'No active subscription plan' });
      }
      const activePlan = await fetchVendorPlanForPricing(supabase, activeSubscription?.plan_id);

      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .maybeSingle();

      if (leadError) return json(500, { error: leadError.message || 'Failed to fetch lead' });
      if (!lead) return json(404, { error: 'Lead not found' });

      const leadStatus = normalizeText(lead?.status).toUpperCase();
      if (leadStatus && !['AVAILABLE', 'PURCHASED'].includes(leadStatus)) {
        return json(409, { error: 'Lead no longer available' });
      }

      if (normalizeText(lead?.vendor_id) && normalizeText(lead?.vendor_id) !== normalizeText(vendor.id)) {
        return json(409, { error: 'This lead is not purchasable' });
      }

      const { data: existingPurchaseRows, error: existingPurchaseError } = await supabase
        .from('lead_purchases')
        .select('id')
        .eq('vendor_id', vendor.id)
        .eq('lead_id', leadId)
        .order('purchase_date', { ascending: false })
        .limit(1);

      if (existingPurchaseError) {
        return json(500, { error: existingPurchaseError.message || 'Failed to validate purchase' });
      }
      if (Array.isArray(existingPurchaseRows) && existingPurchaseRows.length > 0) {
        return json(409, { error: 'You already purchased this lead' });
      }

      const { count: purchaseCount, error: purchaseCountError } = await supabase
        .from('lead_purchases')
        .select('id', { count: 'exact', head: true })
        .eq('lead_id', leadId);

      if (purchaseCountError) {
        return json(500, { error: purchaseCountError.message || 'Failed to validate lead capacity' });
      }
      if ((purchaseCount || 0) >= 5) {
        return json(409, { error: 'This lead has reached maximum 5 vendors limit' });
      }

      const leadPrice = resolvePaidLeadPrice(lead, activePlan);
      if (leadPrice <= 0) {
        return json(400, { error: 'Invalid lead price for online payment' });
      }

      const razorpay = getRazorpay();
      if (!razorpay) return json(500, { error: 'Payment gateway not configured' });

      const amountPaise = Math.max(1, Math.round(leadPrice * 100));
      const shortLeadId = String(leadId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'lead';
      const shortVendorId = String(vendor.id).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'vendor';
      const receipt = `ld_${shortLeadId}_${shortVendorId}_${Date.now().toString().slice(-6)}`.slice(0, 40);

      const order = await razorpay.orders.create({
        amount: amountPaise,
        currency: 'INR',
        receipt,
        payment_capture: 1,
        notes: {
          lead_id: leadId,
          vendor_id: vendor.id,
          plan_id: activeSubscription?.plan_id || '',
          vendor_email: vendor.email || '',
        },
      });

      return json(200, {
        success: true,
        key_id: process.env.RAZORPAY_KEY_ID,
        order: {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
          lead_id: leadId,
          vendor_id: vendor.id,
          vendor_email: vendor.email || '',
          lead_title: lead?.title || lead?.product_name || 'Lead Purchase',
          lead_price: leadPrice,
          lead_price_source: getPlanExtraLeadPrice(activePlan) > 0 ? 'PLAN_EXTRA_LEAD_PRICE' : 'LEAD_PRICE',
        },
      });
    }

    // POST /api/payment/lead/verify
    if (event.httpMethod === 'POST' && action === 'lead' && params[0] === 'verify') {
      const authUser = await resolveAuthenticatedUser(event, supabase);
      if (!authUser?.id) return json(401, { error: 'Unauthorized' });

      const orderId = normalizeText(body?.order_id);
      const paymentId = normalizeText(body?.payment_id);
      const signature = normalizeText(body?.signature);
      const leadId = normalizeText(body?.lead_id);

      if (!orderId || !paymentId || !signature || !leadId) {
        return json(400, { error: 'Missing required fields' });
      }

      const vendor = await resolveVendorForAuthUser(supabase, authUser);
      if (!vendor?.id) return json(404, { error: 'Vendor profile not found' });

      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      if (expectedSignature !== signature) {
        return json(400, { error: 'Invalid payment signature' });
      }

      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .maybeSingle();

      if (leadError) return json(500, { error: leadError.message || 'Failed to fetch lead' });
      if (!lead) return json(404, { error: 'Lead not found' });

      const leadStatus = normalizeText(lead?.status).toUpperCase();
      if (leadStatus && !['AVAILABLE', 'PURCHASED'].includes(leadStatus)) {
        return json(409, { error: 'Lead no longer available' });
      }

      let purchaseAmount = parseCurrencyAmount(lead?.price, 50);
      try {
        const activeSubscription = await getActiveVendorSubscription(supabase, vendor.id);
        const activePlan = await fetchVendorPlanForPricing(supabase, activeSubscription?.plan_id);
        purchaseAmount = resolvePaidLeadPrice(lead, activePlan);
      } catch (priceResolveError) {
        // eslint-disable-next-line no-console
        console.warn('Failed to resolve paid lead price from plan:', priceResolveError?.message || priceResolveError);
      }
      const consumeResult = await consumeLeadForVendor(supabase, {
        vendorId: vendor.id,
        leadId,
        mode: 'BUY_EXTRA',
        purchasePrice: purchaseAmount,
      });

      if (!consumeResult.success) {
        return json(consumeResult.statusCode, {
          success: false,
          code: consumeResult.code,
          error: consumeResult.error,
          ...(consumeResult.payload || {}),
        });
      }

      const consumePayload = consumeResult.payload || {};
      const purchaseRow =
        consumePayload?.purchase && typeof consumePayload.purchase === 'object'
          ? consumePayload.purchase
          : null;
      const wasExistingPurchase = Boolean(consumePayload?.existing_purchase);
      const purchaseDatetime =
        purchaseRow?.purchase_datetime ||
        purchaseRow?.purchase_date ||
        consumePayload?.purchase_datetime ||
        new Date().toISOString();

      await writeAuditLog(supabase, {
        actor: {
          id: vendor.user_id || vendor.id,
          type: 'VENDOR',
          role: 'VENDOR',
          email: vendor.email || null,
        },
        action: 'LEAD_PAYMENT_COMPLETED',
        entityType: 'lead_purchases',
        entityId: purchaseRow?.id || null,
        details: {
          lead_id: leadId,
          amount: purchaseAmount,
          transaction_id: paymentId,
          order_id: orderId,
        },
      });

      try {
        if (!wasExistingPurchase && purchaseRow?.id) {
          const { error: historyError } = await supabase.from('lead_status_history').insert([
            {
              lead_id: leadId,
              vendor_id: vendor.id,
              lead_purchase_id: purchaseRow.id,
              status: 'ACTIVE',
              note: 'Lead purchased via paid extra',
              source: 'PURCHASE',
              created_by: authUser?.id || null,
              created_at: purchaseDatetime,
            },
          ]);
          if (historyError && !isMissingRelationError(historyError, 'lead_status_history')) {
            // eslint-disable-next-line no-console
            console.warn('Paid lead purchase history insert failed:', historyError?.message || historyError);
          }
        }
      } catch (historyInsertError) {
        // eslint-disable-next-line no-console
        console.warn('Paid lead purchase history insert failed:', historyInsertError?.message || historyInsertError);
      }

      return json(200, {
        success: true,
        message: wasExistingPurchase ? 'Lead already purchased' : 'Payment verified and lead unlocked',
        existing_purchase: wasExistingPurchase,
        consumption_type:
          consumePayload?.consumption_type ||
          purchaseRow?.consumption_type ||
          'PAID_EXTRA',
        remaining: consumePayload?.remaining || { daily: 0, weekly: 0, yearly: 0 },
        moved_to_my_leads: true,
        purchase_datetime: purchaseDatetime,
        plan_name:
          consumePayload?.plan_name ||
          consumePayload?.subscription_plan_name ||
          purchaseRow?.subscription_plan_name ||
          null,
        subscription_plan_name:
          consumePayload?.subscription_plan_name ||
          consumePayload?.plan_name ||
          purchaseRow?.subscription_plan_name ||
          null,
        lead_status: consumePayload?.lead_status || purchaseRow?.lead_status || 'ACTIVE',
        purchase: purchaseRow,
      });
    }

    return json(404, { error: 'Invalid payment route' });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Payment function error:', error);
    return json(500, { error: error?.message || 'Internal server error' });
  }
};
