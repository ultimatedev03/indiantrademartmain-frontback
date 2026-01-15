import express from 'express';
import nodemailer from 'nodemailer';
import { supabase } from '../lib/supabaseClient.js';

const router = express.Router();

/**
 * Middleware to check basic request validation
 */
const validateQuotationRequest = (req, res, next) => {
  // Ensure required fields are present
  const { buyer_email, vendor_id, quotation_title } = req.body || {};
  
  if (!buyer_email || !vendor_id || !quotation_title) {
    return res.status(400).json({ error: 'Missing required fields: buyer_email, vendor_id, quotation_title' });
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(buyer_email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  
  // Validate vendor_id is UUID or numeric
  if (!/^[a-f0-9-]{36}$|^\d+$/.test(vendor_id.toString())) {
    return res.status(400).json({ error: 'Invalid vendor_id format' });
  }
  
  next();
};

/**
 * Create transporter:
 * - Prefer SMTP_* (production)
 * - Fallback to Gmail (local dev) if SMTP not configured
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

  throw new Error(
    'Email transporter config missing. Set SMTP_HOST/SMTP_USER/SMTP_PASS (recommended) or GMAIL_EMAIL/GMAIL_APP_PASSWORD for local.'
  );
};

const transporter = createTransporter();

async function sendQuotationEmail(to, data, isRegistered) {
  const vendor = data.vendor || {};
  const quotation = data.quotation || {};

  // Optional PDF attachment
  let attachments = [];
  try {
    const name = quotation.attachment_name;
    const b64 = quotation.attachment_base64;
    const mime = quotation.attachment_mime;
    if (b64) {
      const safeMime = (mime || 'application/pdf').toLowerCase();
      if (safeMime !== 'application/pdf') {
        throw new Error('Only PDF attachments are supported');
      }
      const buf = Buffer.from(String(b64), 'base64');
      const maxBytes = 2 * 1024 * 1024; // 2MB (matches UI)
      if (buf.length > maxBytes) {
        throw new Error('PDF too large (max 2MB)');
      }
      attachments = [
        {
          filename: name || 'quotation.pdf',
          content: buf,
          contentType: 'application/pdf',
        },
      ];
    }
  } catch (e) {
    // Attachment errors should not break the full flow; send without attachment.
    console.warn('Attachment skipped:', e?.message || e);
    attachments = [];
  }

  const subject = `Quotation from ${vendor.company_name || vendor.owner_name || 'Vendor'}`;

  const text = `
Quotation Details
-----------------
Title: ${quotation.title || ''}
Amount: ${quotation.quotation_amount || ''}
Quantity: ${quotation.quantity || ''} ${quotation.unit || ''}
Validity Days: ${quotation.validity_days || ''}
Delivery Days: ${quotation.delivery_days || ''}
Terms: ${quotation.terms_conditions || ''}

Vendor
------
Name: ${vendor.owner_name || ''}
Company: ${vendor.company_name || ''}
Phone: ${vendor.phone || ''}
Email: ${vendor.email || ''}

${isRegistered ? 'You can also view this quotation in your dashboard.' : 'Register on IndianTradeMart to view quotations in your dashboard.'}
`;

  const html = `
  <div style="font-family: Arial, sans-serif; line-height: 1.6;">
    <h2 style="margin:0 0 10px 0;">Quotation from ${vendor.company_name || vendor.owner_name || 'Vendor'}</h2>

    <h3 style="margin:20px 0 8px 0;">Quotation Details</h3>
    <ul>
      <li><b>Title:</b> ${quotation.title || ''}</li>
      <li><b>Amount:</b> ${quotation.quotation_amount || ''}</li>
      <li><b>Quantity:</b> ${quotation.quantity || ''} ${quotation.unit || ''}</li>
      <li><b>Validity Days:</b> ${quotation.validity_days || ''}</li>
      <li><b>Delivery Days:</b> ${quotation.delivery_days || ''}</li>
    </ul>

    <h3 style="margin:20px 0 8px 0;">Terms & Conditions</h3>
    <p>${(quotation.terms_conditions || '').replace(/\n/g, '<br/>')}</p>

    <h3 style="margin:20px 0 8px 0;">Vendor</h3>
    <ul>
      <li><b>Name:</b> ${vendor.owner_name || ''}</li>
      <li><b>Company:</b> ${vendor.company_name || ''}</li>
      <li><b>Phone:</b> ${vendor.phone || ''}</li>
      <li><b>Email:</b> ${vendor.email || ''}</li>
    </ul>

    <p style="margin-top: 18px;">
      ${isRegistered ? 'You can also view this quotation in your dashboard.' : 'Register on IndianTradeMart to view quotations in your dashboard.'}
    </p>
  </div>
  `;

  const from =
    process.env.MAIL_FROM ||
    process.env.SMTP_USER ||
    process.env.GMAIL_EMAIL ||
    'no-reply@indiantrademart.com';

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
    ...(attachments.length ? { attachments } : {}),
  });
}

// POST /api/quotation/send
router.post('/send', validateQuotationRequest, async (req, res) => {
  try {
    const {
      quotation_title,
      quotation_amount,
      quantity,
      unit, // ✅ still accepted (email me use hoga)
      validity_days,
      delivery_days,
      terms_conditions,
      buyer_email,
      vendor_id,
      vendor_name,
      vendor_company,
      vendor_phone,
      vendor_email,

      // ✅ Optional PDF attachment (base64)
      attachment_name,
      attachment_base64,
      attachment_mime,

      // ⚠️ Ignore buyer_id from request (UI was sending lead.id sometimes)
      buyer_id,
    } = req.body || {};

    if (!buyer_email || !vendor_id || !quotation_title) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const buyerEmail = String(buyer_email).toLowerCase().trim();

    // ✅ Make quantity store-friendly (merge unit into quantity; proposals table has no `unit`)
    let qtyValue = quantity ?? null;
    if (qtyValue !== null && qtyValue !== undefined) {
      const qStr = String(qtyValue).trim();
      const uStr = String(unit || '').trim();
      if (uStr && qStr && !qStr.toLowerCase().includes(uStr.toLowerCase())) {
        qtyValue = `${qStr} ${uStr}`; // e.g. "10 kg"
      } else {
        qtyValue = qStr || null;
      }
    }

    // Check if buyer exists
    const { data: buyerCheck, error: buyerErr } = await supabase
      .from('buyers')
      .select('id, user_id, full_name, email')
      .eq('email', buyerEmail)
      .maybeSingle();

    if (buyerErr) console.warn('Buyer lookup warning:', buyerErr);

    const isRegistered = !!buyerCheck;

    // Buyer candidates depending on FK configuration
    const buyerCandidates = [];
    if (buyerCheck?.id) buyerCandidates.push(buyerCheck.id);
    if (buyerCheck?.user_id && buyerCheck.user_id !== buyerCheck.id) buyerCandidates.push(buyerCheck.user_id);

    // Optional legacy: if buyer_id provided and exists in buyers, accept it as candidate
    if (buyer_id) {
      const { data: buyerById } = await supabase.from('buyers').select('id').eq('id', buyer_id).maybeSingle();
      if (buyerById?.id) buyerCandidates.push(buyerById.id);
    }

    const baseQuotationPayload = {
      vendor_id,
      buyer_id: null,
      buyer_email: buyerEmail,
      title: quotation_title,
      product_name: quotation_title,
      quantity: qtyValue, // ✅ contains unit inside
      // ✅ REMOVED: unit (column doesn't exist in proposals)
      budget: quotation_amount ? parseFloat(quotation_amount) : null,
      description: terms_conditions || '',
      status: 'SENT',
    };

    const tryInsert = async (buyerIdValue) => {
      const payload = { ...baseQuotationPayload, buyer_id: buyerIdValue ?? null };
      return supabase.from('proposals').insert([payload]).select('id, vendor_id, buyer_id, title').single();
    };

    let savedQuotation = null;
    let lastError = null;

    for (const candidate of buyerCandidates) {
      const { data, error } = await tryInsert(candidate);
      if (!error && data) {
        savedQuotation = data;
        break;
      }
      lastError = error;
      const msg = (error?.message || '').toLowerCase();
      const code = error?.code;
      const retryable = msg.includes('foreign key') || code === '23503' || code === '22P02';
      if (!retryable) break;
    }

    if (!savedQuotation) {
      const { data, error } = await tryInsert(null);
      if (!error && data) savedQuotation = data;
      else lastError = error;
    }

    if (!savedQuotation) {
      console.error('Database INSERT error:', lastError);
      return res.status(500).json({
        error: lastError?.message || 'Failed to save quotation',
        details: lastError,
      });
    }

    // Email vendor data
    const vendorData = {
      owner_name: vendor_name,
      company_name: vendor_company,
      phone: vendor_phone,
      email: vendor_email,
    };

    // Send email (non-blocking for DB)
    try {
      await sendQuotationEmail(
        buyerEmail,
        {
          vendor: vendorData,
          quotation: {
            title: quotation_title,
            quotation_amount,
            quantity, // email me quantity original
            unit,     // ✅ email me unit show hoga
            validity_days,
            delivery_days,
            terms_conditions,

            // ✅ attachment
            attachment_name,
            attachment_base64,
            attachment_mime,
          },
        },
        isRegistered
      );

      await supabase.from('quotation_emails').insert([
        {
          quotation_id: savedQuotation.id,
          recipient_email: buyerEmail,
          subject: `Quotation from ${vendor_company || vendor_name}`,
          status: 'SENT',
        },
      ]);
    } catch (emailError) {
      console.error('Email sending error (non-blocking):', emailError);
      try {
        await supabase.from('quotation_emails').insert([
          {
            quotation_id: savedQuotation.id,
            recipient_email: buyerEmail,
            subject: `Quotation from ${vendor_company || vendor_name}`,
            status: 'FAILED',
            error_message: emailError?.message || 'Email failed',
          },
        ]);
      } catch (_) {}
    }

    // Create notification if registered buyer
    if (isRegistered && buyerCheck?.id) {
      try {
        await supabase.from('buyer_notifications').insert([
          {
            buyer_id: buyerCheck.id,
            type: 'QUOTATION_RECEIVED',
            title: `New Quotation from ${vendor_company || vendor_name}`,
            message: `Received quotation: ${quotation_title}`,
            reference_id: savedQuotation.id,
            reference_type: 'quotation',
            is_read: false,
            created_at: new Date().toISOString(),
          },
        ]);
      } catch (notifError) {
        console.warn('Notification creation failed:', notifError);
      }
    } else {
      // Track unregistered buyer
      try {
        await supabase.from('quotation_unregistered').insert([
          {
            email: buyerEmail,
            quotation_id: savedQuotation.id,
            vendor_id,
            created_at: new Date().toISOString(),
          },
        ]);
      } catch (trackError) {
        console.warn('Unregistered tracking failed:', trackError);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Quotation sent successfully to ${buyerEmail}${
        isRegistered ? ' and added to their dashboard' : ' - they will see it after registering'
      }`,
      quotation_id: savedQuotation.id,
      buyer_registered: isRegistered,
    });
  } catch (e) {
    console.error('Quotation route error:', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
});

export default router;
