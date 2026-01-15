# Payment Integration - Quick Start

## Issue
The error "Failed to initiate payment" occurs because Razorpay API keys are not configured in `.env.local`.

## Solution - Add Razorpay Credentials

### Step 1: Get Test Keys from Razorpay
1. Go to https://razorpay.com/
2. Sign up or log in to your dashboard
3. Navigate to **Settings → API Keys**
4. Copy your **Key ID** (starts with `rzp_test_` or `rzp_live_`)
5. Copy your **Key Secret** (long string)

### Step 2: Update .env.local
Edit `.env.local` and replace:
```
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

With your actual keys:
```
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
```

### Step 3: Add Frontend Key (Optional but recommended)
Also add to `.env.local`:
```
VITE_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxxxx
```

## Testing with Razorpay Test Cards

Use these credentials to test without real payments:

**Test Card (Success):**
- Card Number: `4111111111111111`
- Expiry: Any future date (e.g., `12/25`)
- CVV: Any 3 digits (e.g., `123`)
- Cardholder Name: Any name

**Test Card (Failure - for testing error handling):**
- Card Number: `4000000000000002`
- Expiry: Any future date
- CVV: Any 3 digits

## Step-by-Step Testing

### 1. Restart Backend Server
```bash
npm run dev:server
```

### 2. Access Subscription Page
```
http://localhost:3000/vendor/subscriptions
```

### 3. Click on a Paid Plan
- Click "Upgrade" on any plan with price > 0
- Modal opens with plan details

### 4. Test Payment Flow
- Click "Upgrade" button in modal
- Razorpay checkout modal appears
- Use test card credentials above
- Click "Pay Now"
- Success page will show

## Expected Behavior

✅ **Free Plans:** Activate instantly without payment gateway
✅ **Paid Plans:** Show Razorpay checkout modal
✅ **On Success:** Subscription created, invoice generated, email sent
✅ **On Failure:** Error message displayed

## API Endpoints

All payment endpoints:
- `POST /api/payment/initiate` - Start payment
- `POST /api/payment/verify` - Verify & create subscription
- `GET /api/payment/history/:vendor_id` - Payment history
- `GET /api/payment/invoice/:payment_id` - Get invoice
- `GET /api/payment/plans` - List plans

## Database Flow

1. **Initiate**: Razorpay order created, returned to frontend
2. **Verify**: Payment signature verified, subscription created
3. **Record**: Payment stored in `vendor_payments` table
4. **Invoice**: PDF generated and stored as base64
5. **Email**: Invoice sent to vendor email

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Failed to initiate payment" | Check RAZORPAY_KEY_ID in .env.local |
| Razorpay modal not appearing | Check VITE_RAZORPAY_KEY_ID in frontend .env |
| Invoice not sending | Verify GMAIL_EMAIL and GMAIL_APP_PASSWORD |
| Payment verified but no subscription | Check vendor_id exists in database |

## Moving to Production

When ready for live payments:

1. Switch Razorpay keys to production (`rzp_live_*`)
2. Update .env.local with live keys
3. Use real credit/debit cards for testing
4. Monitor payment logs for errors
5. Set up payment reconciliation
6. Configure webhook for payment updates

## Files Modified

- `.env.local` - Added Razorpay keys
- `server/routes/payment.js` - Payment endpoints
- `src/modules/vendor/pages/Services.jsx` - Razorpay integration
- `server/lib/razorpayClient.js` - Razorpay instance
- `server/lib/invoiceGenerator.js` - Invoice generation
