# Plan 02-02 Summary: Public/Vendor/Buyer Migration

**Completed:** 2026-04-16
**Status:** ✅ Done

## What Was Done

### Task 1: Expand Express ownership for public/vendor data

Added **8 new backend routes** in `server/routes/vendorProfile.js`:

| Route | Method | Purpose |
|---|---|---|
| `/me/dashboard-stats` | GET | Vendor dashboard counts (products, leads, proposals, messages) |
| `/me/recent-products` | GET | 5 most recent products |
| `/me/recent-leads` | GET | 5 most recent leads |
| `/me/support-stats` | GET | Support ticket total/open counts |
| `/me/products/:productId` | DELETE | Ownership-scoped product delete |
| `/me/products/:productId/status` | PATCH | Ownership-scoped product status update |
| `/me/contact-persons/:contactId` | DELETE | Ownership-scoped contact person delete |
| `/me/messages/:messageId` | DELETE | Ownership-scoped message delete |

All routes verify vendor ownership before performing mutations — more secure than the previous RLS-dependent approach.

### Task 2: Convert surface clients to backend-first

Converted **vendorApi.js** from **18 direct `supabase.from()` calls to 0**:

| Operation | Before | After |
|---|---|---|
| `dashboard.getStats` | 5 x `supabase.from()` | `fetchVendorJson('/api/vendors/me/dashboard-stats')` |
| `getRecentProducts` | 2 x `supabase.from()` | `fetchVendorJson('/api/vendors/me/recent-products')` |
| `getRecentLeads` | 2 x `supabase.from()` | `fetchVendorJson('/api/vendors/me/recent-leads')` |
| `getSupportStats` | 3 x `supabase.from()` | `fetchVendorJson('/api/vendors/me/support-stats')` |
| `products.updateStatus` | 1 x `supabase.from()` | `fetchVendorJson('/api/vendors/me/products/:id/status')` |
| `products.delete` | 1 x `supabase.from()` | `fetchVendorJson('/api/vendors/me/products/:id')` |
| `contactPersons.delete` | 1 x `supabase.from()` | `fetchVendorJson('/api/vendors/me/contact-persons/:id')` |
| `messages.delete` | 1 x `supabase.from()` | `fetchVendorJson('/api/vendors/me/messages/:id')` |

**Public/Buyer status:**
- `publicApi.js` — 1 remaining `supabase.from('leads')` for public listing (acceptable: anon read-only data)
- `buyerApi.js` — 1 remaining notification fallback (defensive: only fires when backend API not used)

## Verification

- [x] `supabase.from()` search in vendorApi.js returns 0 matches
- [x] Server boots successfully with new routes
- [x] All 8 new routes are ownership-scoped with proper auth middleware

## Files Changed

| File | Action |
|---|---|
| `server/routes/vendorProfile.js` | **MODIFIED** — Added 8 new backend-first routes |
| `src/modules/vendor/services/vendorApi.js` | **MODIFIED** — Migrated 18 direct Supabase calls to backend |
