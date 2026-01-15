# Payment Integration Setup Guide

## Overview
This guide covers the setup and configuration of the Razorpay payment integration system for vendor subscriptions.

## Environment Variables

### Backend (.env.local)
Add the following variables to your backend `.env.local` file:

```
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

### Frontend (.env or .env.local)
Add the following variables to your frontend environment:

```
VITE_API_URL=http://localhost:3001
VITE_RAZORPAY_KEY_ID=your_razorpay_key_id
```

## Getting Razorpay Credentials

1. Create a Razorpay account at https://razorpay.com
2. Go to Account Settings → API Keys
3. Copy your Key ID and Key Secret
4. Use test keys for development and production keys for live

## Database Schema

The payment system uses the following existing tables:
- `vendor_plans` - Subscription plans
- `vendor_plan_subscriptions` - Vendor subscriptions
- `vendor_payments` - Payment records
- `vendor_lead_quota` - Lead usage limits

The `vendor_payments` table stores:
- `id` - Payment ID
- `vendor_id` - Vendor reference
- `amount` - Payment amount
- `description` - Payment description
- `status` - Payment status (COMPLETED, PENDING, FAILED)
- `payment_method` - Payment method (Razorpay)
- `transaction_id` - Razorpay transaction ID
- `payment_date` - Payment timestamp
- `invoice_url` - Base64 encoded PDF invoice

## API Endpoints

### 1. Initiate Payment
```
POST /api/payment/initiate
Body: { vendor_id, plan_id }
Returns: { order_id, amount, currency, plan_name, vendor_email }
```

### 2. Verify Payment
```
POST /api/payment/verify
Body: { order_id, payment_id, signature, vendor_id, plan_id }
Returns: { subscription, payment, success }
```

### 3. Get Payment History
```
GET /api/payment/history/:vendor_id
Returns: Array of payment records with subscription details
```

### 4. Get Invoice
```
GET /api/payment/invoice/:payment_id
Returns: { invoice: base64_pdf_data_url }
```

### 5. Get Subscription Plans
```
GET /api/payment/plans
Returns: Array of active vendor plans
```

## Frontend Integration

The payment integration is built into the Services.jsx page (vendor subscription page):

### Features
1. **Plan Selection** - View and select subscription plans
2. **Razorpay Checkout** - Secure payment processing via Razorpay
3. **Invoice Generation** - Automatic PDF invoice generation
4. **Payment History** - View past payments and download invoices
5. **Email Confirmation** - Automatic email with invoice attachment

### Usage
The vendor can:
1. Click on a plan card or the "Upgrade" button
2. For paid plans: Redirected to Razorpay checkout
3. Complete payment in Razorpay modal
4. Receive invoice via email
5. View payment history and download invoices from the "Invoice History" button

## Invoice Generation

Invoices are generated using jsPDF with:
- Indian formatting (₹ currency, en-IN locale)
- Professional header with company branding
- Vendor details and GST information
- Itemized charges
- Payment method and transaction ID
- Email-friendly PDF format

## Email Notifications

Payment confirmations include:
- Invoice PDF attachment
- Subscription details
- Payment confirmation message
- Vendor company details

Email uses existing transporter configuration (SMTP or Gmail).

## Testing

### Razorpay Test Cards
- Card: 4111111111111111
- Expiry: Any future date
- CVV: Any 3 digits

## Troubleshooting

### Payment Not Initiating
- Verify RAZORPAY_KEY_ID is set in .env.local
- Check VITE_RAZORPAY_KEY_ID in frontend environment
- Ensure vendor and plan exist in database

### Invoice Not Generating
- Check jsPDF is installed (npm ls jspdf)
- Verify invoice data is complete
- Check browser console for errors

### Email Not Sent
- Configure SMTP_* or GMAIL_* variables
- Check email address in vendor record
- Verify nodemailer transporter configuration

### Payment Signature Verification Failed
- Ensure RAZORPAY_KEY_SECRET matches your Razorpay account
- Check order_id and payment_id are correct
- Verify signature calculation in payment.js

## Files Created/Modified

### New Files
- `server/routes/payment.js` - Payment API endpoints
- `server/lib/razorpayClient.js` - Razorpay instance
- `server/lib/invoiceGenerator.js` - PDF invoice generation

### Modified Files
- `server/server.js` - Added payment routes
- `src/modules/vendor/pages/Services.jsx` - Added payment integration
- `package.json` - Added dependencies (razorpay, jspdf)

## Security Considerations

1. **Signature Verification** - All payments are verified using HMAC-SHA256
2. **API Keys** - Never commit .env files with real keys
3. **Test Mode** - Use Razorpay test keys during development
4. **HTTPS** - Always use HTTPS in production for payment pages
5. **Database** - Store encrypted payment data when possible

## Production Deployment

Before going live:
1. Switch Razorpay keys to production keys
2. Update frontend VITE_RAZORPAY_KEY_ID with production key
3. Test payment flow end-to-end
4. Configure email with production SMTP settings
5. Set proper invoice storage strategy (database or cloud storage)
6. Monitor payment logs for errors
7. Set up payment reconciliation processes
