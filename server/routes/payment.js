import express from 'express';
import crypto from 'crypto';
import { supabase } from '../lib/supabaseClient.js';
import { razorpayInstance } from '../lib/razorpayClient.js';
import { generateInvoiceNumber, generateInvoicePDF, generateInvoiceSummary } from '../lib/invoiceGenerator.js';
import nodemailer from 'nodemailer';

const router = express.Router();

/**
 * Create email transporter
 */
const createTransporter = () => {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  if (process.env.GMAIL_EMAIL && process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_EMAIL,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }

  return null;
};

/**
 * POST /api/payment/initiate
 * Initiate a Razorpay payment order for subscription
 */
router.post('/initiate', async (req, res) => {
  try {
    const { vendor_id, plan_id } = req.body;
    const coupon_code = (req.body?.coupon_code || '').toString().trim().toUpperCase();

    // Check if Razorpay keys are configured
    if (!process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID.includes('your_razorpay')) {
      console.error('❌ Razorpay KEY_ID not configured');
      return res.status(500).json({ error: 'Payment gateway not configured. Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env.local' });
    }

    if (!vendor_id || !plan_id) {
      return res.status(400).json({ error: 'Missing vendor_id or plan_id' });
    }

    // Fetch vendor details
    const { data: vendor, error: vendorError } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', vendor_id)
      .single();

    if (vendorError || !vendor) {
      console.error('Vendor not found:', vendor_id, vendorError);
      return res.status(404).json({ error: 'Vendor not found' });
    }

    // Fetch plan details
    const { data: plan, error: planError } = await supabase
      .from('vendor_plans')
      .select('*')
      .eq('id', plan_id)
      .single();

    if (planError || !plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const baseAmount = Number(plan.price || 0);
    if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
      return res.status(400).json({ error: 'Invalid plan price' });
    }

    let discountAmount = 0;
    let netAmount = baseAmount;
    let coupon = null;

    if (coupon_code) {
      const { data: cpn, error: couponErr } = await supabase
        .from('vendor_plan_coupons')
        .select('*')
        .eq('code', coupon_code)
        .eq('is_active', true)
        .maybeSingle();

      if (couponErr || !cpn) {
        return res.status(400).json({ error: 'Coupon not found or inactive' });
      }

      if (cpn.expires_at && new Date(cpn.expires_at) < new Date()) {
        return res.status(400).json({ error: 'Coupon expired' });
      }
      if (cpn.max_uses && cpn.max_uses > 0 && cpn.used_count >= cpn.max_uses) {
        return res.status(400).json({ error: 'Coupon usage limit reached' });
      }
      if (cpn.vendor_id && cpn.vendor_id !== vendor_id) {
        return res.status(400).json({ error: 'Coupon not valid for this vendor' });
      }
      if (cpn.plan_id && cpn.plan_id !== plan_id) {
        return res.status(400).json({ error: 'Coupon not valid for this plan' });
      }

      if (cpn.discount_type === 'PERCENT') {
        discountAmount = (baseAmount * Number(cpn.value)) / 100;
      } else {
        discountAmount = Number(cpn.value || 0);
      }
      if (!Number.isFinite(discountAmount)) discountAmount = 0;
      discountAmount = Math.max(0, Math.min(discountAmount, baseAmount));
      netAmount = Math.max(0, baseAmount - discountAmount);
      coupon = cpn;
    }

    const amount = Math.max(1, Math.round(netAmount * 100)); // paise, min 1 to keep Razorpay happy

    // Create Razorpay order
    // Receipt must be max 40 characters - use hash of vendor_id + timestamp
    const shortId = `${vendor_id.substring(0, 8)}_${Math.random().toString(36).substring(2, 8)}`;
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
        coupon_code,
      },
    };

    const order = await razorpayInstance.orders.create(options);

    res.json({
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
        coupon_code: coupon_code || null,
      },
    });
  } catch (error) {
    console.error('Payment initiation error:', error);
    res.status(500).json({ error: error.message || 'Failed to initiate payment' });
  }
});

/**
 * POST /api/payment/verify
 * Verify Razorpay payment and create subscription
 */
router.post('/verify', async (req, res) => {
  try {
    const { order_id, payment_id, signature, vendor_id, plan_id } = req.body;
    const coupon_code = (req.body?.coupon_code || '').toString().trim().toUpperCase();

    if (!order_id || !payment_id || !signature || !vendor_id || !plan_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify payment signature
    const body = order_id + '|' + payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== signature) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // Fetch vendor and plan
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

    if (!vendor || !plan) {
      return res.status(404).json({ error: 'Vendor or plan not found' });
    }

    // Coupon re-validation
    let discountAmount = 0;
    let netAmount = Number(plan.price || 0);
    let coupon = null;

    if (coupon_code) {
      const { data: cpn } = await supabase
        .from('vendor_plan_coupons')
        .select('*')
        .eq('code', coupon_code)
        .eq('is_active', true)
        .maybeSingle();

      if (cpn) {
        const now = new Date();
        const okUsage = !cpn.max_uses || cpn.max_uses === 0 || cpn.used_count < cpn.max_uses;
        const okExpiry = !cpn.expires_at || new Date(cpn.expires_at) >= now;
        const okVendor = !cpn.vendor_id || cpn.vendor_id === vendor_id;
        const okPlan = !cpn.plan_id || cpn.plan_id === plan_id;

        if (okUsage && okExpiry && okVendor && okPlan) {
          if (cpn.discount_type === 'PERCENT') {
            discountAmount = (Number(plan.price || 0) * Number(cpn.value)) / 100;
          } else {
            discountAmount = Number(cpn.value || 0);
          }
          discountAmount = Math.max(0, Math.min(discountAmount, Number(plan.price || 0)));
          netAmount = Math.max(0, Number(plan.price || 0) - discountAmount);
          coupon = cpn;
        }
      }
    }

    const invoiceNumber = generateInvoiceNumber();

    // Create subscription
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + (plan.duration_days || 365));

    const { data: subscription, error: subscriptionError } = await supabase
      .from('vendor_plan_subscriptions')
      .insert([
        {
          vendor_id,
          plan_id,
          start_date: new Date(),
          end_date: endDate,
          status: 'ACTIVE',
          plan_duration_days: plan.duration_days || 365,
        },
      ])
      .select()
      .single();

    if (subscriptionError) {
      console.error('Subscription creation error:', subscriptionError);
      return res.status(500).json({ error: 'Failed to create subscription' });
    }

    // Record payment
    const invoicePdfData = {
      invoiceNumber,
      invoiceDate: new Date(),
      dueDate: new Date(),
      vendor,
      plan,
      amount: plan.price,
      discount_amount: discountAmount,
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
          amount: plan.price,
          discount_amount: discountAmount,
          net_amount: netAmount,
          description: `Subscription: ${plan.name}`,
          status: 'COMPLETED',
          payment_method: 'Razorpay',
          transaction_id: payment_id,
          payment_date: new Date(),
          invoice_url: invoicePdf,
          coupon_code: coupon_code || null,
        },
      ])
      .select()
      .single();

    if (paymentError) {
      console.error('Payment record error:', paymentError);
    } else if (coupon) {
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

    // Send email with invoice
    try {
      const transporter = createTransporter();
      if (transporter && vendor.email) {
        const invoiceSummary = generateInvoiceSummary(invoicePdfData);
        await transporter.sendMail({
          from: process.env.GMAIL_EMAIL || process.env.SMTP_USER,
          to: vendor.email,
          subject: `Invoice ${invoiceNumber} - Subscription Purchase`,
          html: `
            <h2>Subscription Confirmation</h2>
            <p>Dear ${vendor.company_name},</p>
            <p>Your subscription has been successfully activated.</p>
            ${invoiceSummary}
            <p><strong>Subscription Period:</strong> ${new Date().toLocaleDateString('en-IN')} to ${endDate.toLocaleDateString('en-IN')}</p>
            <p>Thank you for choosing Indian Trade Mart!</p>
          `,
          attachments: [
            {
              filename: `${invoiceNumber}.pdf`,
              content: invoicePdf.split(',')[1],
              encoding: 'base64',
              contentType: 'application/pdf',
            },
          ],
        });
      }
    } catch (emailError) {
      console.error('Email sending error:', emailError);
    }

    res.json({
      success: true,
      message: 'Payment verified and subscription activated',
      subscription,
      payment,
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ error: error.message || 'Payment verification failed' });
  }
});

/**
 * GET /api/payment/history/:vendor_id
 * Get payment history for a vendor
 */
router.get('/history/:vendor_id', async (req, res) => {
  try {
    const { vendor_id } = req.params;

    if (!vendor_id) {
      return res.status(400).json({ error: 'Missing vendor_id' });
    }

    const { data: payments, error } = await supabase
      .from('vendor_payments')
      .select('*')
      .eq('vendor_id', vendor_id)
      .order('payment_date', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true, data: payments || [] });
  } catch (error) {
    console.error('Payment history error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/payment/invoice/:payment_id
 * Download invoice PDF
 */
router.get('/invoice/:payment_id', async (req, res) => {
  try {
    const { payment_id } = req.params;

    if (!payment_id) {
      return res.status(400).json({ error: 'Missing payment_id' });
    }

    const { data: payment, error } = await supabase
      .from('vendor_payments')
      .select('*')
      .eq('id', payment_id)
      .single();

    if (error || !payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (!payment.invoice_url) {
      return res.status(404).json({ error: 'Invoice not available' });
    }

    // Return invoice as data URL
    res.json({
      success: true,
      invoice: payment.invoice_url,
    });
  } catch (error) {
    console.error('Invoice retrieval error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/payment/plans
 * Get all active subscription plans
 */
router.get('/plans', async (req, res) => {
  try {
    const { data: plans, error } = await supabase
      .from('vendor_plans')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true, data: plans || [] });
  } catch (error) {
    console.error('Plans retrieval error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
