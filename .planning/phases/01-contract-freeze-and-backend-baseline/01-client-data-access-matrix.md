# Client Data Access Matrix

**Generated:** 2026-04-16
**Purpose:** Map every frontend module's data access pattern — whether it calls the Express API via `fetchWithCsrf`/`apiUrl` or accesses Supabase directly from the browser.

## Access Pattern Legend

| Pattern | Meaning | Migration Status |
|---|---|---|
| **API** | Calls Express API via `fetchWithCsrf` or `apiUrl` | ✅ Already behind backend |
| **Direct (Public Read-Only)** | Browser-side `supabase.from(...)` for public catalog data | 🟡 Low risk — can stay or migrate later |
| **Direct (Protected Flow)** | Browser-side `supabase.from(...)` for authenticated/mutation flows | 🔴 Must migrate to Express |
| **Mixed** | Uses both API calls and direct Supabase in the same module | ⚠️ Needs per-function triage |

---

## Module Access Summary

| Module | Service File | Access Pattern | Direct Supabase Tables | Express Endpoints |
|---|---|---|---|---|
| `publicApi` | `src/modules/public/services/publicApi.js` | **Direct (Public Read-Only)** | states, cities, head_categories, sub_categories, micro_categories, products, product_images, product_videos, vendors, leads, contact_submissions, quotes, requirements, platform_feedback, page_status, notifications | None |
| `vendorApi` | `src/modules/vendor/services/vendorApi.js` | **Mixed** | vendors, products, leads, lead_purchases, buyers, micro_categories, sub_categories, head_categories, states, cities, quotations, services, collections, product_images, product_videos, product_slug_aliases, support_tickets | `/api/vendors/*`, `/api/auth/*` |
| `adminApi` | `src/modules/admin/services/adminApi.js` | **Mixed** | users, vendors, products, buyers, lead_purchases, vendor_payments, employees, support_tickets, ticket_messages, states, cities | `/api/admin/*`, `/api/finance/*`, `/api/support/*` |
| `employeeApiComplete` | `src/modules/employee/services/employeeApiComplete.js` | **Direct (Protected Flow)** | employees, support_tickets, ticket_messages, vendors, kyc_documents, head_categories, sub_categories, micro_categories, requirements, suggestions, leads, quotes | None |
| `buyerApi` | `src/modules/buyer/services/buyerApi.js` | **Mixed** | buyers, leads, proposals, vendors, products | `/api/auth/*` |
| `directoryApi` | `src/modules/directory/services/directoryApi.js` | **Direct (Public Read-Only)** | vendors, products, head_categories, sub_categories, micro_categories, states, cities | None |
| `vendorService` | `src/modules/directory/services/vendorService.js` | **Direct (Public Read-Only)** | vendors, products, product_images | None |
| `leadApi` | `src/modules/lead/services/leadApi.js` | **Mixed** | leads, lead_purchases, buyers, vendors | `/api/vendors/*` |
| `categoryApi` | `src/modules/category/services/categoryApi.js` | **Direct (Public Read-Only)** | head_categories, sub_categories, micro_categories | None |
| `dataEntryApi` | `src/modules/employee/services/dataEntryApi.js` | **Mixed** | vendors, products, head_categories, sub_categories, micro_categories | `/api/vendors/*` |
| `categoryHierarchyApi` | `src/modules/employee/services/categoryHierarchyApi.js` | **Direct (Protected Flow)** | head_categories, sub_categories, micro_categories | None |
| `superAdminApi` | `src/modules/admin/services/superAdminApi.js` | **Direct (Protected Flow)** | employees, vendors, users, system_config | None |
| `adminKycApi` | `src/modules/admin/services/adminKycApi.js` | **Direct (Protected Flow)** | vendors, kyc_documents | None |
| `usersApi` | `src/modules/admin/services/usersApi.js` | **Direct (Protected Flow)** | users | None |
| `hrApi` | `src/modules/hr/services/hrApi.js` | **Mixed** | employees | `/api/employee/*` |
| `salesApi` | `src/modules/employee/services/salesApi.js` | **Mixed** | leads, vendors, products, lead_purchases | `/api/vendors/*` |
| `supportApi` | `src/modules/employee/services/supportApi.js` | **Mixed** | support_tickets, ticket_messages | `/api/support/*` |
| `territoryApi` | `src/modules/employee/services/territoryApi.js` | **Mixed** | territories, territory_assignments, vendors | `/api/territory/*` |
| `employeeApi` | `src/modules/employee/services/employeeApi.js` | **Mixed** | employees | `/api/employee/*` |
| `categoryApi (emp)` | `src/modules/employee/services/categoryApi.js` | **Mixed** | head_categories, sub_categories, micro_categories | `/api/category-requests/*` |
| `referralApi` | `src/modules/vendor/services/referralApi.js` | **API** | None | `/api/referrals/*` |
| `quotationApi` | `src/modules/vendor/services/quotationApi.js` | **API** | None | `/api/quotation/*` |
| `leadsMarketplaceApi` | `src/modules/vendor/services/leadsMarketplaceApi.js` | **API** | None | `/api/vendors/*` |
| `leadPaymentApi` | `src/modules/vendor/services/leadPaymentApi.js` | **API** | None | `/api/payment/*`, `/api/vendors/*` |
| `buyerSession` | `src/modules/buyer/services/buyerSession.js` | **API** | None | `/api/auth/*` |
| `buyerProfileApi` | `src/modules/buyer/services/buyerProfileApi.js` | **API** | None | `/api/vendors/*` |

## Auth Shim (customSupabaseClient.js)

The browser-side Supabase client at `src/lib/customSupabaseClient.js` replaces `supabase.auth.*` methods with a custom shim that routes through the Express backend:

| Auth Method | Routes Through |
|---|---|
| `signInWithPassword` | `POST /api/auth/login` |
| `signUp` | `POST /api/auth/register` |
| `signOut` | `POST /api/auth/logout` |
| `getSession` / `getUser` | `GET /api/auth/me` |
| `updateUser` (password) | `PATCH /api/auth/password` |

**Key finding:** Auth operations are already behind the Express backend. The migration debt is in _data access_, not auth.

## Direct Protected Supabase Access Summary

These modules perform browser-side mutations on protected data and **must migrate to Express in Phase 2**:

| Priority | Module | Critical Protected Operations |
|---|---|---|
| 🔴 P1 | `employeeApiComplete` | Ticket CRUD, vendor creation, KYC uploads, lead creation, requirement status |
| 🔴 P1 | `superAdminApi` | Employee management, system config, user management |
| 🔴 P1 | `adminKycApi` | KYC document approval/rejection |
| 🔴 P1 | `usersApi` | Direct user table mutations |
| 🟡 P2 | `vendorApi` | Mixed — many product/profile mutations still direct |
| 🟡 P2 | `adminApi` | Mixed — fallback direct queries when server endpoints fail |
| 🟡 P2 | `buyerApi` | Some direct buyer profile operations |
| 🟡 P2 | `categoryHierarchyApi` | Category CRUD (data entry role) |
| 🟢 P3 | `publicApi` | All read-only public data — lowest migration priority |
| 🟢 P3 | `directoryApi` | Public catalog reads — can stay as-is during migration |

## Inline Direct Access in Pages (Non-Service Files)

Several page components bypass service files and access Supabase directly:

| File | Tables Accessed | Type |
|---|---|---|
| `vendor/pages/Services.jsx` | services | Protected Flow |
| `vendor/pages/Collections.jsx` | collections | Protected Flow |
| `vendor/pages/auth/Register.jsx` | vendors | Protected Flow |
| `vendor/pages/auth/Login.jsx` | vendors | Protected Flow |
| `shared/components/RealtimeChat.jsx` | chat_messages (realtime) | Protected Flow |
| `employee/pages/dataentry/Vendors.jsx` | vendors | Protected Flow |
| `employee/pages/dataentry/CategoriesFixed.jsx` | categories | Protected Flow |
| `directory/pages/ProductListing.jsx` | products | Public Read-Only |
| `directory/pages/SearchResults.jsx` | products, vendors | Public Read-Only |
| `buyer/pages/auth/Register.jsx` | buyers | Protected Flow |
| `buyer/components/ChatBotModal.jsx` | chat_messages | Protected Flow |
| `admin/context/InternalAuthContext.jsx` | employees (via RPC) | Protected Flow |
| `finance/pages/Dashboard.jsx` | vendor_payments, lead_purchases | Protected Flow |

---
*Matrix generated: 2026-04-16*
*Source: grep for `supabase.from(`, `supabase.rpc(`, `fetchWithCsrf`, `fetchJson`, `apiUrl` across `src/modules/`*
