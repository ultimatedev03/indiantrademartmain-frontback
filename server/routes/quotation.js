const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendQuotationEmail(to, data, isRegistered) {
  const vendor = data.vendor || {};
  const quotation = data.quotation || {};

  const subject = `Quotation from ${vendor.company_name || vendor.owner_name || 'Vendor'}`;

  const text = `
Quotation Details
-----------------
Title: ${quotation.title || ''}
Amount: ${quotation.quotation_amount || ''}
Quantity: ${quotation.quantity || ''}
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
      <li><b>Quantity:</b> ${quotation.quantity || ''}</li>
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

  const mailOptions = {
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html
  };

  await transporter.sendMail(mailOptions);
}

// POST /api/quotation/send
router.post('/send', async (req, res) => {
  try {
    const {
      quotation_title,
      quotation_amount,
      quantity,
      unit,
      validity_days,
      delivery_days,
      terms_conditions,
      buyer_email,
      vendor_id,
      vendor_name,
      vendor_company,
      vendor_phone,
      vendor_email,

      // ⚠️ Ignore buyer_id from request (UI was sending lead.id)
      buyer_id
    } = req.body || {};

    if (!buyer_email || !vendor_id || !quotation_title) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if buyer is registered in the system
    // NOTE: some setups use buyers.id as FK target, some use buyers.user_id.
    // We fetch both so we can retry safely.
    const { data: buyerCheck } = await supabase
      .from('buyers')
      .select('id, user_id, full_name, email, is_registered')
      .eq('email', buyer_email.toLowerCase())
      .maybeSingle();

    const isRegistered = !!buyerCheck;

    // Candidate buyer_id values to try (depends on FK target)
    const buyerCandidates = [];
    if (buyerCheck?.id) buyerCandidates.push(buyerCheck.id);
    if (buyerCheck?.user_id && buyerCheck.user_id !== buyerCheck.id) buyerCandidates.push(buyerCheck.user_id);

    // Fallback: if some older flow sends a real buyers.id, we can still accept it.
    // But we first validate it exists in buyers.
    if (buyer_id) {
      const { data: buyerById } = await supabase
        .from('buyers')
        .select('id')
        .eq('id', buyer_id)
        .maybeSingle();
      if (buyerById?.id) buyerCandidates.push(buyerById.id);
    }

    // Prepare base quotation data - match proposals table schema
    const baseQuotationPayload = {
      vendor_id: vendor_id,
      buyer_id: null,
      buyer_email: buyer_email.toLowerCase(),
      title: quotation_title,
      product_name: quotation_title,
      quantity: quantity || null,
      budget: quotation_amount ? parseFloat(quotation_amount) : null,
      description: terms_conditions || '',
      status: 'SENT'
    };

    // Save quotation to database with safe retry logic.
    const tryInsert = async (buyerIdValue) => {
      const payload = { ...baseQuotationPayload, buyer_id: buyerIdValue ?? null };
      console.log('Attempting to save quotation with payload:', JSON.stringify(payload, null, 2));
      return supabase
        .from('proposals')
        .insert([payload])
        .select('id, vendor_id, buyer_id, title')
        .single();
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
      if (!error && data) {
        savedQuotation = data;
      } else {
        lastError = error;
      }
    }

    if (!savedQuotation) {
      console.error('Database INSERT error:', JSON.stringify(lastError, null, 2));
      return res.status(500).json({
        error: lastError?.message || 'Failed to save quotation',
        details: lastError
      });
    }

    // Prepare vendor data for email
    const vendorData = {
      owner_name: vendor_name,
      company_name: vendor_company,
      phone: vendor_phone,
      email: vendor_email
    };

    // Send quotation email
    try {
      await sendQuotationEmail(buyer_email, {
        vendor: vendorData,
        quotation: {
          title: quotation_title,
          quotation_amount: quotation_amount,
          quantity: quantity,
          validity_days: validity_days,
          delivery_days: delivery_days,
          terms_conditions: terms_conditions
        }
      }, isRegistered);

      // Log email to quotation_emails table
      await supabase
        .from('quotation_emails')
        .insert([{
          quotation_id: savedQuotation.id,
          recipient_email: buyer_email.toLowerCase(),
          subject: `Quotation from ${vendor_company || vendor_name}`,
          status: 'SENT'
        }]);
    } catch (emailError) {
      console.error('Email sending error (non-blocking):', emailError);
      try {
        await supabase
          .from('quotation_emails')
          .insert([{
            quotation_id: savedQuotation.id,
            recipient_email: buyer_email.toLowerCase(),
            subject: `Quotation from ${vendor_company || vendor_name}`,
            status: 'FAILED',
            error_message: emailError.message
          }]);
      } catch (_) {}
    }

    // Create notification if buyer is registered
    if (isRegistered && buyerCheck?.id) {
      try {
        await supabase
          .from('buyer_notifications')
          .insert([{
            buyer_id: buyerCheck.id,
            type: 'QUOTATION_RECEIVED',
            title: `New Quotation from ${vendor_company || vendor_name}`,
            message: `Received quotation: ${quotation_title}`,
            reference_id: savedQuotation.id,
            reference_type: 'quotation',
            is_read: false,
            created_at: new Date().toISOString()
          }]);
      } catch (notifError) {
        console.warn('Notification creation failed:', notifError);
      }
    } else {
      // Track unregistered buyer quotation
      try {
        await supabase
          .from('quotation_unregistered')
          .insert([{
            email: buyer_email.toLowerCase(),
            quotation_id: savedQuotation.id,
            vendor_id: vendor_id,
            created_at: new Date().toISOString()
          }]);
      } catch (trackError) {
        console.warn('Unregistered tracking failed:', trackError);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Quotation sent successfully to ${buyer_email}${isRegistered ? ' and added to their dashboard' : ' - they will see it after registering'}`,
      quotation_id: savedQuotation.id,
      buyer_registered: isRegistered
    });
  } catch (e) {
    console.error('Quotation route error:', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
});

module.exports = router;
