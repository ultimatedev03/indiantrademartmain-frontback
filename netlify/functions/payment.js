import crypto from 'crypto';
import Razorpay from 'razorpay';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import {
  generateInvoiceNumber,
  generateInvoicePDF,
  generateInvoiceSummary,
} from '../../server/lib/invoiceGenerator.js';

const json = (statusCode, body, extraHeaders = {}) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
  const parts = eventPath.split('/').filter(Boolean);
  const idx = parts.lastIndexOf('payment');
  const rest = idx >= 0 ? parts.slice(idx + 1) : [];
  return { action: rest[0] || '', params: rest.slice(1) };
};

export const handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return json(200, { ok: true });
    }

    const { action, params } = parseRoute(event.path);
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
    if (event.httpMethod === 'GET' && action === 'invoice') {
      const payment_id = params[0];
      if (!payment_id) return json(400, { error: 'Missing payment_id' });

      const { data: payment, error } = await supabase
        .from('vendor_payments')
        .select('*')
        .eq('id', payment_id)
        .single();

      if (error || !payment) return json(404, { error: 'Payment not found' });
      if (!payment.invoice_url) return json(404, { error: 'Invoice not available' });

      return json(200, { success: true, invoice: payment.invoice_url });
    }

    const body = event.body ? JSON.parse(event.body) : {};

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

      const amount = Math.round(Number(plan.price || 0) * 100);
      if (!Number.isFinite(amount) || amount <= 0) return json(400, { error: 'Invalid plan price' });

      const shortId = `${String(vendor_id).substring(0, 8)}_${Math.random().toString(36).substring(2, 8)}`;
      const options = {
        amount,
        currency: 'INR',
        receipt: shortId,
        payment_capture: 1,
        notes: {
          vendor_id,
          plan_id,
          vendor_email: vendor.email,
          vendor_name: vendor.company_name,
        },
      };

      const order = await razorpay.orders.create(options);

      return json(200, {
        success: true,
        order: {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
          vendor_id,
          plan_id,
          plan_name: plan.name,
          vendor_email: vendor.email,
        },
      });
    }

    // POST /api/payment/verify
    if (event.httpMethod === 'POST' && action === 'verify') {
      const { order_id, payment_id, signature, vendor_id, plan_id } = body;

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
        console.error('Subscription creation error:', subscriptionError);
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
        tax: 0,
        totalAmount: price,
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
            description: `Subscription: ${plan.name}`,
            status: 'COMPLETED',
            payment_method: 'Razorpay',
            transaction_id: payment_id,
            payment_date: new Date().toISOString(),
            invoice_url: invoicePdf,
          },
        ])
        .select()
        .single();

      if (paymentError) console.error('Payment record error:', paymentError);

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
      } catch (emailError) {
        console.error('Email sending error:', emailError);
      }

      return json(200, {
        success: true,
        message: 'Payment verified and subscription activated',
        subscription,
        payment,
      });
    }

    return json(404, { error: 'Invalid payment route' });
  } catch (error) {
    console.error('Payment function error:', error);
    return json(500, { error: error?.message || 'Internal server error' });
  }
};
