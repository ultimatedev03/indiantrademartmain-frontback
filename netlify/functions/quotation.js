import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Setup Gmail SMTP
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_EMAIL,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

// Send Quotation Email
async function sendQuotationEmail(buyerEmail, quotationData, isRegistered) {
  try {
    const { vendor, quotation } = quotationData;
    
    // Registration link for unregistered buyers
    const registrationLink = isRegistered 
      ? '' 
      : `<p style="color: #666; margin: 15px 0; text-align: center; background: #fff3cd; padding: 15px; border-radius: 6px;">
          📌 <strong>New to our platform?</strong> <br/>
          <a href="${process.env.VITE_FRONTEND_URL || 'https://indiantrademart.netlify.app'}/buyer/register?email=${encodeURIComponent(buyerEmail)}" style="color: #00A699; text-decoration: none; font-weight: bold;">
            Click here to Register
          </a> to view all quotations in your dashboard.
         </p>`;

    const mailOptions = {
      from: `${process.env.APP_NAME || 'IndianTradeMart'} <${process.env.GMAIL_EMAIL}>`,
      to: buyerEmail,
      subject: `Quotation from ${vendor.company_name || vendor.owner_name}`,
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
            <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              
              <!-- Header -->
              <div style="text-align: center; margin-bottom: 30px;">
                <h2 style="color: #003D82; margin: 0; font-size: 28px;">New Quotation Received</h2>
              </div>

              <!-- Greeting -->
              <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
                Hello <strong>${buyerEmail.split('@')[0] || 'Buyer'}</strong>,
              </p>

              <!-- Vendor Info Box -->
              <div style="background: linear-gradient(135deg, #f0f8ff 0%, #f0fff4 100%); border-left: 4px solid #00A699; padding: 20px; margin: 20px 0; border-radius: 6px;">
                <p style="margin: 0 0 15px 0; font-weight: bold; color: #003D82; font-size: 16px;">From Vendor:</p>
                
                <div style="margin: 10px 0;">
                  <p style="margin: 5px 0; font-size: 15px;">
                    <strong style="color: #003D82;">👤 Vendor Name:</strong> ${vendor.owner_name || 'N/A'}
                  </p>
                </div>
                
                <div style="margin: 10px 0;">
                  <p style="margin: 5px 0; font-size: 15px;">
                    <strong style="color: #003D82;">🏢 Company:</strong> ${vendor.company_name || 'N/A'}
                  </p>
                </div>
                
                <div style="margin: 10px 0;">
                  <p style="margin: 5px 0; font-size: 15px;">
                    <strong style="color: #003D82;">📞 Phone:</strong> ${vendor.phone || 'N/A'}
                  </p>
                </div>
                
                <div style="margin: 10px 0;">
                  <p style="margin: 5px 0; font-size: 15px;">
                    <strong style="color: #003D82;">📧 Email:</strong> ${vendor.email || 'N/A'}
                  </p>
                </div>
              </div>

              <!-- Quotation Details Box -->
              <div style="background: #f0f8ff; border-left: 4px solid #003D82; padding: 20px; margin: 20px 0; border-radius: 6px;">
                <p style="margin: 0 0 15px 0; font-weight: bold; color: #003D82; font-size: 16px;">📋 Quotation Details:</p>
                
                <div style="margin: 10px 0;">
                  <p style="margin: 5px 0; font-size: 14px;">
                    <strong>Title:</strong> ${quotation.title}
                  </p>
                </div>
                
                <div style="margin: 10px 0; padding: 15px; background: white; border-radius: 6px;">
                  <p style="margin: 0; font-size: 24px; font-weight: bold; color: #00A699; text-align: center;">
                    ₹${quotation.quotation_amount?.toLocaleString?.('en-IN') || quotation.quotation_amount || '0'}
                  </p>
                  <p style="margin: 5px 0 0 0; text-align: center; font-size: 12px; color: #666;">Quote Amount</p>
                </div>

                ${quotation.quantity ? `
                <div style="margin: 10px 0;">
                  <p style="margin: 5px 0; font-size: 14px;">
                    <strong>Quantity:</strong> ${quotation.quantity}
                  </p>
                </div>
                ` : ''}

                ${quotation.validity_days ? `
                <div style="margin: 10px 0;">
                  <p style="margin: 5px 0; font-size: 14px;">
                    <strong>Valid For:</strong> ${quotation.validity_days} days
                  </p>
                </div>
                ` : ''}

                ${quotation.delivery_days ? `
                <div style="margin: 10px 0;">
                  <p style="margin: 5px 0; font-size: 14px;">
                    <strong>Delivery Time:</strong> ${quotation.delivery_days} days
                  </p>
                </div>
                ` : ''}
              </div>

              <!-- Terms & Conditions -->
              ${quotation.terms_conditions ? `
              <div style="background: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 6px;">
                <p style="margin: 0 0 10px 0; font-weight: bold; color: #003D82; font-size: 14px;">📝 Terms & Conditions:</p>
                <p style="margin: 0; font-size: 13px; color: #555; white-space: pre-wrap; line-height: 1.6;">
                  ${quotation.terms_conditions}
                </p>
              </div>
              ` : ''}

              <!-- Action Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.VITE_FRONTEND_URL || 'https://indiantrademart.netlify.app'}/buyer/quotations" 
                   style="background: #00A699; color: white; padding: 14px 40px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
                  View Quotation
                </a>
              </div>

              <!-- Registration Message for Unregistered -->
              ${registrationLink}

              <!-- Footer -->
              <div style="border-top: 1px solid #e0e0e0; margin-top: 30px; padding-top: 20px; text-align: center;">
                <p style="color: #999; font-size: 12px; margin: 5px 0;">
                  This is an automated email from IndianTradeMart.
                </p>
                <p style="color: #999; font-size: 12px; margin: 5px 0;">
                  For inquiries, contact the vendor directly at ${vendor.phone || vendor.email}
                </p>
                <p style="color: #ccc; font-size: 11px; margin: 10px 0 0 0;">
                  © 2025 IndianTradeMart. All rights reserved.
                </p>
              </div>

            </div>
          </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Quotation email sent:', info.messageId, 'to:', buyerEmail);
    return true;
  } catch (error) {
    console.error('Quotation email sending failed:', error);
    throw new Error('Failed to send quotation email');
  }
}

export const handler = async (event) => {
  try {
    // Only POST
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
    }

    // Parse path: /.netlify/functions/quotation/send
    const path = event.path || "";
    const action = path.endsWith("/send") ? "send" : null;

    if (!action) {
      return { statusCode: 404, body: JSON.stringify({ error: "Invalid quotation route" }) };
    }

    const body = JSON.parse(event.body || "{}");

    // ✅ SEND QUOTATION
    if (action === "send") {
      const { 
        quotation_title,
        quotation_amount,
        quantity,
        validity_days,
        delivery_days,
        terms_conditions,
        buyer_email,
        buyer_id,
        vendor_id,
        vendor_name,
        vendor_company,
        vendor_phone,
        vendor_email
      } = body;

      // Validate required fields
      if (!quotation_title || !quotation_amount || !buyer_email || !vendor_id) {
        return { 
          statusCode: 400, 
          body: JSON.stringify({ 
            error: 'Missing required fields: quotation_title, quotation_amount, buyer_email, vendor_id' 
          }) 
        };
      }

      // Validate email format
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer_email)) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid email format' }) };
      }

      // Check if buyer is registered in the system
      const { data: buyerCheck } = await supabase
        .from('buyers')
        .select('id, full_name, email, is_registered')
        .eq('email', buyer_email.toLowerCase())
        .maybeSingle();

      const isRegistered = !!buyerCheck;

      // Prepare quotation data - match proposals table schema
      const quotationPayload = {
        vendor_id: vendor_id,
        buyer_id: buyer_id || null,
        buyer_email: buyer_email.toLowerCase(),
        title: quotation_title,
        product_name: quotation_title,
        quantity: quantity || null,
        budget: quotation_amount ? parseFloat(quotation_amount) : null,
        description: terms_conditions || '',
        status: 'SENT'
      };

      // Save quotation to database
      console.log('Attempting to save quotation with payload:', JSON.stringify(quotationPayload, null, 2));
      
      const { data: insertData, error: dbError } = await supabase
        .from('proposals')
        .insert([quotationPayload]);
      
      // If insert successful, fetch the saved record
      let savedQuotation = null;
      if (!dbError && quotationPayload.vendor_id) {
        const { data: fetchedData } = await supabase
          .from('proposals')
          .select('id, vendor_id, buyer_id, title')
          .eq('vendor_id', quotationPayload.vendor_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        savedQuotation = fetchedData;
      }

      if (dbError) {
        console.error('Database INSERT error:', JSON.stringify(dbError, null, 2));
        return { 
          statusCode: 500, 
          body: JSON.stringify({ 
            error: dbError.message || 'Failed to save quotation', 
            details: dbError 
          }) 
        };
      }
      
      if (!savedQuotation) {
        console.error('No quotation data returned from insert');
        return { 
          statusCode: 500, 
          body: JSON.stringify({ 
            error: 'Failed to save quotation - no data returned' 
          }) 
        };
      }
      
      console.log('Quotation saved successfully:', savedQuotation.id);

      // Prepare vendor data for email
      const vendorData = {
        owner_name: vendor_name,
        company_name: vendor_company,
        phone: vendor_phone,
        email: vendor_email
      };

      // Send quotation email
      let emailSent = false;
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
        emailSent = true;
        
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
        // Log failed email attempt
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
        // Don't fail the quotation if email fails - it's already saved
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

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: `Quotation sent successfully to ${buyer_email}${isRegistered ? ' and added to their dashboard' : ' - they will see it after registering'}`,
          quotation_id: savedQuotation.id,
          buyer_registered: isRegistered
        })
      };
    }

    return { statusCode: 404, body: JSON.stringify({ error: "Unknown action" }) };
  } catch (e) {
    console.error('Quotation function error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message || "Server error" }) };
  }
};
