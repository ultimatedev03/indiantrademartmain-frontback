# API Surface Inventory

**Generated:** 2026-04-16
**Source:** `server/server.js` mounted routes, `server/routes/*.js` files

## Mounted Route Groups

| Mount Prefix | Route File | Business Domain | Endpoints (approx) | Migration Risk |
|---|---|---|---|---|
| `/api/auth` | `server/routes/auth.js` | Authentication, JWT, session, register, login, logout, OTP-verify | ~15 | 🔴 HIGH |
| `/api/otp` | `server/routes/otp.js` | OTP generation and email delivery via SMTP | ~3 | 🟡 MEDIUM |
| `/api/quotation` | `server/routes/quotation.js` | Quotation management, PDF generation, email delivery | ~10+ | 🟡 MEDIUM |
| `/api/password-reset` | `server/routes/passwordReset.js` | Password reset flow via OTP | ~3 | 🔴 HIGH |
| `/api/migration` | `server/routes/migration.js` | Legacy data migration utilities | ~3 | 🟢 LOW |
| `/api/support` | `server/routes/supportTickets.js` | Support tickets CRUD, messaging, stats | ~8 | 🟡 MEDIUM |
| `/api/kyc` | `server/routes/kyc.js` | KYC document uploads, approval workflow | ~6 | 🔴 HIGH |
| `/api/admin` | `server/routes/admin.js` | Admin dashboard, vendor management, buyer management, data entry perf | ~20+ | 🔴 HIGH |
| `/api/dir` | `server/routes/dir.js` | Public directory listings, search, vendor profiles | ~6 | 🟡 MEDIUM |
| `/api/vendors` | `server/routes/vendorProfile.js` | Vendor profile CRUD, products, collections, services, leads, proposals | ~40+ | 🔴 HIGH |
| `/api/payment` | `server/routes/payment.js` | Razorpay integration, lead purchases, subscription payments | ~10+ | 🔴 HIGH |
| `/api/finance` | `server/routes/finance.js` | Finance reports, revenue summaries, invoice generation | ~10+ | 🟡 MEDIUM |
| `/api/chat` | `server/routes/chatbot.js` | AI chatbot integration (Groq/OpenAI) | ~3 | 🟢 LOW |
| `/api/superadmin` | `server/routes/superadmin.js` | Superadmin operations, system management, employee management | ~25+ | 🔴 HIGH |
| `/api/employee` | `server/routes/employee.js` | Employee dashboard, data entry, sales, support, territory workflows | ~20+ | 🔴 HIGH |
| `/api/territory` | `server/routes/territory.js` | Territory management, assignment, quota tracking | ~10+ | 🟡 MEDIUM |
| `/api/category-requests` | `server/routes/categoryRequests.js` | Category creation requests from vendors/employees | ~5 | 🟢 LOW |
| `/api/notifications` | `server/routes/notifications.js` | In-app notification delivery and read status | ~5 | 🟢 LOW |
| `/api/referrals` | `server/routes/referrals.js` | Referral program management, tracking, payouts | ~5 | 🟡 MEDIUM |

**Total mounted route groups:** 19
**Health endpoint:** `GET /health` (standalone, not under `/api/`)

## Rate Limiting Configuration

| Limiter | Prefix | Window | Max Requests | Notes |
|---|---|---|---|---|
| `apiLimiter` | `/api/` | 1 min (configurable) | 60 prod / 300 dev | Skips `/auth/` in dev; disabled via `DISABLE_API_RATE_LIMIT` |
| `authLimiter` | `/api/auth` | 1 min (configurable) | 60 prod / 200 dev | Auth-specific stricter limit |
| `otpLimiter` | `/api/otp` | 15 min | 5 | Hardcoded anti-abuse limit |

## High-Risk API Domains

### Auth and Session Critical
- `/api/auth/login` — JWT issuance, cookie-based session, role resolution
- `/api/auth/register` — User creation, role assignment, session bootstrap
- `/api/auth/logout` — Cookie clearing, session invalidation
- `/api/auth/me` — Session validation, cached user refresh
- `/api/auth/password` — Password change via authenticated session
- `/api/password-reset/*` — OTP-based password recovery

### Public Catalog (High Traffic)
- `/api/vendors/public/*` — Public vendor profiles, product listings, search
- `/api/dir/*` — Directory search, vendor listings, category browsing
- `/health` — Health check (deployment probes)

### Internal Portal (Business Critical)
- `/api/admin/dashboard/*` — Dashboard counts, overview, performance reports
- `/api/admin/vendors/*` — Vendor KYC approval, suspension, management
- `/api/employee/*` — Multi-role employee portal (support, sales, data entry, manager, VP)
- `/api/superadmin/*` — System-level operations, employee management, config
- `/api/finance/*` — Revenue reports, invoice generation, payment summaries

### Payment and Support Flows
- `/api/payment/*` — Razorpay order creation, verification, lead purchase payment
- `/api/support/*` — Ticket CRUD, messaging, stats, escalation
- `/api/kyc/*` — Document upload, approval workflow

## Middleware Stack (Applied in Order)

1. **`subdomainMiddleware`** — Detects vendor/buyer/admin/etc subdomain context
2. **`cors`** — Subdomain-aware CORS with production whitelist
3. **Security headers** — CSP, HSTS, X-Frame-Options, etc. from `server/lib/httpSecurity.js`
4. **`subdomainRedirectMiddleware`** — Redirects wrong-subdomain route access
5. **`express.json`** — Body parsing with 10MB limit (for quotation PDF attachments)
6. **`mongoSanitize`** — NoSQL injection protection
7. **Custom XSS sanitizer** — Strips `<>"'` from string body fields
8. **Rate limiters** — Applied per-prefix before route handlers

## Shared Backend Libraries

| File | Purpose | Used By |
|---|---|---|
| `server/lib/auth.js` | JWT sign/verify, bcrypt, cookie helpers, role resolution, user CRUD | All authenticated routes |
| `server/lib/supabaseClient.js` | Service-role Supabase client with retry and IPv4-first DNS | All route handlers |
| `server/lib/httpSecurity.js` | CSP, HSTS, Permissions-Policy header constants | `server/server.js` |
| `server/lib/superadminAuth.js` | Superadmin-specific auth guards | `superadmin.js` |
| `server/lib/notificationService.js` | In-app notification delivery | Multiple routes |
| `server/lib/notify.js` | Email notification service (Nodemailer) | OTP, support, payments |
| `server/lib/razorpayClient.js` | Razorpay SDK initialization | `payment.js` |
| `server/lib/invoiceGenerator.js` | PDF invoice generation | `finance.js` |
| `server/lib/referralProgram.js` | Referral logic and tracking | `referrals.js` |
| `server/lib/leadConsumptionCompat.js` | Lead consumption compatibility layer | `vendorProfile.js` |
| `server/lib/subscriptionCronJobs.js` | Cron-based subscription monitoring | `server.js` (startup) |
| `server/lib/devBootstrap.js` | Dev-only admin user bootstrap | `server.js` (startup) |
| `server/lib/captcha.js` | CAPTCHA/Turnstile verification | `auth.js` |
| `server/lib/audit.js` | Audit log recording | Admin/superadmin routes |
| `server/lib/passwordPolicy.js` | Password strength validation | `auth.js`, `passwordReset.js` |

---
*Inventory generated: 2026-04-16*
*Source: `server/server.js` lines 1–164, `server/routes/` (19 files), `server/lib/` (15 files)*
