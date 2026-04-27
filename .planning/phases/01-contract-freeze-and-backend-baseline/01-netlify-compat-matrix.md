# Netlify Function Compatibility Matrix

**Generated:** 2026-04-16
**Purpose:** Map each Netlify function to its Express route equivalent and determine whether it should be retained as a temporary adapter, proxied, or retired after migration.

## Netlify → Express Parity Map

| Netlify Function | Express Route Equivalent | Overlap | Recommendation | Notes |
|---|---|---|---|---|
| `netlify/functions/auth.js` | `server/routes/auth.js` | 🔴 Full duplication | **Retire Later** | Both implement login, register, logout, me, password reset. The Netlify version contains its own JWT/cookie logic duplicated from `server/lib/auth.js`. Express version is the canonical source. |
| `netlify/functions/vendors.js` | `server/routes/vendorProfile.js` | 🔴 Full duplication | **Retire Later** | Both implement vendor profile CRUD, product listings, lead management, proposal flows. The Netlify version is a near-complete mirror of the Express route at ~107KB. |
| `netlify/functions/admin.js` | `server/routes/admin.js` | 🔴 Full duplication | **Retire Later** | Dashboard overview, counts, vendor/buyer management, data entry performance, recent tickets/vendors. Nearly identical business logic. |
| `netlify/functions/employee.js` | `server/routes/employee.js` | 🔴 Full duplication | **Retire Later** | Multi-role employee portal: support tickets, sales operations, data entry, territory management. |
| `netlify/functions/finance.js` | `server/routes/finance.js` | 🟡 Partial duplication | **Retire Later** | Revenue summaries, payment tracking. Express version may have additional endpoints. |
| `netlify/functions/support.js` | `server/routes/supportTickets.js` | 🔴 Full duplication | **Retire Later** | Ticket CRUD, messaging, stats. Both use the same Supabase queries. |
| `netlify/functions/territory.js` | `server/routes/territory.js` | 🔴 Full duplication | **Retire Later** | Territory management, assignment, vendor allocation. |
| `netlify/functions/otp.js` | `server/routes/otp.js` | 🔴 Full duplication | **Retire Later** | OTP generation and email delivery. Both use Nodemailer. |
| `netlify/functions/payment.js` | `server/routes/payment.js` | 🔴 Full duplication | **Retire Later** | Razorpay order creation, verification, lead purchases. |
| `netlify/functions/quotation.js` | `server/routes/quotation.js` | 🔴 Full duplication | **Retire Later** | Quotation management and PDF generation. |
| `netlify/functions/kyc.js` | `server/routes/kyc.js` | 🔴 Full duplication | **Retire Later** | KYC document management and approval workflow. |
| `netlify/functions/superadmin.js` | `server/routes/superadmin.js` | 🔴 Full duplication | **Retire Later** | System-level operations, employee management. |
| `netlify/functions/dir.js` | `server/routes/dir.js` | 🔴 Full duplication | **Retire Later** | Directory search and vendor listing. |
| `netlify/functions/chatbot.js` | `server/routes/chatbot.js` | 🔴 Full duplication | **Retire Later** | AI chatbot integration. |
| `netlify/functions/migration.js` | `server/routes/migration.js` | 🔴 Full duplication | **Retire Later** | Legacy data migration utilities. |
| `netlify/functions/notifications.js` | `server/routes/notifications.js` | 🔴 Full duplication | **Retire Later** | Notification delivery and read status. |
| `netlify/functions/referrals.js` | `server/routes/referrals.js` | 🔴 Full duplication | **Retire Later** | Referral program management. |
| `netlify/functions/password-reset.js` | `server/routes/passwordReset.js` | 🔴 Full duplication | **Retire Later** | Password reset flow via OTP. |
| `netlify/functions/chat.js` | N/A | 🟢 Unique | **Proxy Candidate** | Lightweight chat function — no direct Express equivalent found. May serve as a real-time adapter. |
| `netlify/functions/category-requests.js` | `server/routes/categoryRequests.js` | 🔴 Full duplication | **Retire Later** | Category creation requests. |

## Duplication Summary

| Category | Count |
|---|---|
| **Full duplication** (Express owns same logic) | 18 |
| **Partial duplication** | 1 |
| **Unique** (no Express equivalent) | 1 |
| **Total Netlify functions** | 20 |

## Frontend Runtime Selection

The frontend uses a runtime switch in `adminApi.js` (and likely similar patterns) to choose between Express and Netlify:

```javascript
const getAdminBase = () => {
  const override = import.meta.env.VITE_ADMIN_API_BASE;
  if (override && String(override).trim()) return String(override).trim();
  return isLocalHost() ? "/api/admin" : "/.netlify/functions/admin";
};
```

**Key finding:** In production (`indiantrademart.com`), some frontend modules default to `/.netlify/functions/*` when `VITE_ADMIN_API_BASE` is not set. This means **Netlify functions are the active production runtime for some surfaces**, not Express. The migration must ensure Express endpoints are reachable in production before Netlify mirrors can be retired.

## Shared Backend Libraries Used by Netlify

Netlify functions that perform auth re-implement their own JWT/cookie handling instead of importing from `server/lib/auth.js`. This creates:

1. **Two sources of truth** for auth behavior (risk of drift)
2. **Two implementations** of cookie options, CSRF validation, and role resolution
3. **Inconsistent error handling** between runtimes

## Migration Action Items (Phase 2)

1. ✅ Ensure all Express routes are reachable from production Netlify deployment (already configured via Vite proxy for dev)
2. Update frontend modules to always use `/api/*` instead of runtime-switching to `/.netlify/functions/*`
3. After frontend migration, mark Netlify functions for removal or convert to thin proxy wrappers
4. `chat.js` — evaluate if it needs an Express equivalent or should remain as a serverless function

---
*Matrix generated: 2026-04-16*
*Source: `netlify/functions/` (20 files), `server/routes/` (19 files), `src/modules/admin/services/adminApi.js` runtime switch pattern*
