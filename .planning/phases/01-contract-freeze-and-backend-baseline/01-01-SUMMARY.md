# Plan 01-01 Summary: API Surface Audit

**Completed:** 2026-04-16
**Status:** ✅ Done

## What Was Done

1. **Express route ownership inventory** (`01-api-surface-inventory.md`)
   - Documented all 19 mounted `/api/*` route groups from `server/server.js`
   - Mapped each to its route file, business domain, and migration risk level
   - Cataloged rate limiting configuration, middleware stack order, and shared backend libraries

2. **Frontend data access matrix** (`01-client-data-access-matrix.md`)
   - Mapped 25+ frontend service modules by access pattern (API vs Direct Supabase)
   - Identified 6 modules with purely direct protected Supabase access (must migrate)
   - Identified 10 mixed-access modules needing per-function triage
   - Documented 13 page-level components with inline direct Supabase access

3. **Netlify compatibility matrix** (`01-netlify-compat-matrix.md`)
   - Mapped all 20 Netlify functions to Express equivalents
   - Found 18/20 are full duplications of Express routes
   - Discovered frontend runtime switch that defaults to Netlify in production for some modules

## Key Findings

- **Auth is already behind Express.** The `customSupabaseClient.js` auth shim routes all auth operations through `/api/auth/*`.
- **Data access is the main migration debt.** Many protected business flows still run directly from the browser via Supabase anon key.
- **Netlify functions are redundant copies.** 18/20 fully duplicate Express routes and can be retired after frontend migration.
- **Production uses Netlify for some surfaces.** The `adminApi.js` runtime switch defaults to `/.netlify/functions/*` in production, meaning Netlify is the de facto API runtime for admin operations in prod.

## Verification

- [x] `01-api-surface-inventory.md` contains `## Mounted Route Groups` and `## High-Risk API Domains`
- [x] `01-api-surface-inventory.md` lists `/api/auth`, `/api/vendors`, `/api/employee`, `/api/finance`
- [x] `01-client-data-access-matrix.md` marks `Protected Flow` and `Public Read-Only` access
- [x] `01-netlify-compat-matrix.md` maps functions with `Retire Later` and `Proxy Candidate` labels

---
*Plan 01-01 completed: 2026-04-16*
