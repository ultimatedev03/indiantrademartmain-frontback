# Backend Runtime Target

**Created:** 2026-04-16
**Status:** Active specification for backend separation program

## Overview

This document defines the target architecture for the IndianTradeMart backend after the separation program is complete. It serves as the source of truth for how the Express backend should own API behavior, how Netlify compatibility works during migration, and what frontend consumers should expect.

## Runtime Ownership

### Express is the primary API runtime

All business API logic ultimately lives in Node.js + Express, served from `server/app.js`. The entrypoint `server/server.js` imports the configured app and calls `listen()`.

**Express owns:**
- All `/api/*` route handling (19 route groups)
- Authentication and session management (JWT, cookies, CSRF)
- Rate limiting and input sanitization
- Security headers (CSP, HSTS, etc.)
- Database access via service-role Supabase client
- Background jobs (subscription cron, dev bootstrap)

**Express does NOT own:**
- Frontend rendering (Vite SPA handles this)
- Static asset serving in production (handled by CDN/Netlify)
- Real-time subscriptions (Supabase Realtime, used by frontend directly)

### Reusable app module

The app is bootstrapped in `server/app.js` without calling `listen()`, making it reusable for:
- Local development (`server/server.js`)
- Future test harnesses (supertest, integration tests)
- Future serverless adapters (if needed)

## Adapter Strategy

### Netlify functions during migration

Currently, 20 Netlify functions in `netlify/functions/` duplicate most Express route logic. During migration:

1. **Phase 1 (current):** Netlify functions remain as-is. No changes to prod behavior.
2. **Phase 2:** Frontend modules switch from `/.netlify/functions/*` to `/api/*` endpoints.  
   - The `getAdminBase()` pattern (and similar runtime switches) must be updated to always use `/api/*`.
3. **Phase 3:** Netlify functions are either:
   - **Retired** — deleted after confirming Express endpoints handle all production traffic
   - **Converted to thin proxies** — forward requests to Express if serverless deployment requires it
   - **Left with justification** — `chat.js` (unique function) may remain as a serverless adapter

### How frontend selects runtime

The current pattern in modules like `adminApi.js`:
```javascript
const getAdminBase = () => {
  const override = import.meta.env.VITE_ADMIN_API_BASE;
  if (override) return override;
  return isLocalHost() ? "/api/admin" : "/.netlify/functions/admin";
};
```

**Migration target:** All modules should use `/api/*` unconditionally. The Vite proxy handles routing to localhost:3001 in dev, and production deployment ensures Express is reachable at `/api/*`.

## Auth and Session Boundary

### Cookie-based JWT auth

Authentication uses httpOnly cookies managed by the Express backend:

| Cookie | Purpose | httpOnly | Secure (prod) |
|---|---|---|---|
| `itm_access` | JWT bearer token | ✅ Yes | ✅ Yes |
| `itm_csrf` | CSRF token for mutation requests | ❌ No (readable by JS) | ✅ Yes |

### Auth flow ownership

| Step | Owner | Module |
|---|---|---|
| Login/register | Express | `server/routes/auth.js` |
| JWT signing | Express | `server/lib/auth.js` |
| Cookie management | Express | `server/lib/auth.js` |
| Session validation | Express | `GET /api/auth/me` |
| CSRF validation | Express | Route-level middleware |
| Frontend auth shim | Frontend | `src/lib/customSupabaseClient.js` |

### Auth contract stability

The auth cookie+CSRF contract MUST remain stable throughout migration:
- Cookie names are configurable via env but default to `itm_access` / `itm_csrf`
- The `SameSite=Lax` + optional domain scope must not change
- The `customSupabaseClient.js` auth shim routes through Express and must continue to work

## Environment Variables

### Required for all runtimes

| Variable | Purpose | Example |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side DB access | `eyJ...` |
| `JWT_SECRET` | JWT signing secret | Strong random string |
| `GMAIL_EMAIL` | SMTP sender for OTP/notifications | `noreply@indiantrademart.com` |
| `GMAIL_PASSWORD` | SMTP auth | App password |

### Optional / environment-specific

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | Express listen port | `3001` |
| `NODE_ENV` | Runtime mode | `development` |
| `JSON_BODY_LIMIT` | Max request body size | `10mb` |
| `AUTH_COOKIE_DOMAIN` | Cookie domain scope | (none — current domain) |
| `AUTH_TOKEN_TTL` | JWT expiry | `7d` |
| `API_RATE_WINDOW_MS` | Rate limit window | `60000` |
| `API_RATE_MAX` | Requests per window | `60` (prod) / `300` (dev) |
| `DISABLE_API_RATE_LIMIT` | Bypass all rate limits | `false` |
| `DEBUG_SUBDOMAIN` | Log subdomain detection | `false` |

### Frontend-only

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Frontend Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend Supabase anon key |
| `VITE_API_URL` | API base URL override (empty = same-origin) |

## What Remains Temporarily Compatible

During migration, these patterns remain valid but will be removed in Phase 3:

| Pattern | Location | Why It Exists | Migration Plan |
|---|---|---|---|
| Netlify function duplicates | `netlify/functions/*.js` | Production fallback | Retire in Phase 3 |
| `isLocalHost()` runtime switch | Frontend service files | Routes to Express vs Netlify | Remove in Phase 2 |
| Direct Supabase reads (public) | `publicApi.js`, `directoryApi.js` | Public read-only catalog data | Low priority — migrate if needed |
| Direct Supabase writes (protected) | `employeeApiComplete.js`, `adminKycApi.js`, etc. | Missing Express endpoints | Must migrate in Phase 2 |

## What Must Be Migrated in Phase 2

All protected browser-side Supabase access must move behind Express. Priority:

1. **P1 — Employee/admin protected flows:** ticket CRUD, vendor creation, KYC approval, user management
2. **P2 — Vendor/buyer mixed flows:** product mutations, profile updates, lead operations
3. **P3 — Public reads (optional):** catalog data can stay as direct Supabase during migration

---
*Document created: 2026-04-16*
*Applies to: IndianTradeMart backend separation program, all phases*
