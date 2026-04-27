# Plan 02-01 Summary: Auth Consolidation

**Completed:** 2026-04-16
**Status:** ✅ Done

## What Was Done

### Task 1: Make Express auth the primary implementation path

**netlify/functions/auth.js** — Replaced the 1529-line fully duplicated auth fork with a thin adapter (~490 lines) that:
- Imports all core auth helpers from `server/lib/auth.js` (shared source of truth):
  `normalizeEmail`, `normalizeRole`, `hashPassword`, `verifyPassword`, `isBcryptHash`,
  `signAuthToken`, `verifyAuthToken`, `createCsrfToken`, `buildAuthUserPayload`,
  `upsertPublicUser`, `getPublicUserByEmail`, `getPublicUserById`,
  `resolveRoleForUser`, `syncProfileUserId`, `setPublicUserPassword`
- Uses `server/lib/supabaseClient.js` instead of creating its own Supabase clients
- Retains Netlify-specific HTTP helpers (cookie serialization via `multiValueHeaders`, CORS headers) since those differ from Express `res.cookie()`
- Preserves all endpoint behavior: login, register, me, logout, password change

**Reduction:** ~50KB → ~15KB (70% reduction)

### Task 2: Align browser auth shim and portal contexts

**src/modules/admin/context/InternalAuthContext.jsx** — Migrated login from:
- ❌ `supabase.auth.signInWithPassword` (direct browser-side auth)
- ❌ `supabase.rpc('login_admin')` (direct RPC call)
- ✅ `fetchWithCsrf(apiUrl('/api/auth/login'))` (backend-first)

**Other contexts were already aligned:**
- **Buyer** — Uses `fetchWithCsrf(apiUrl("/api/auth/buyer/profile"))` as primary
- **Vendor** — Uses `supabase.auth.getSession()` which goes through the `customSupabaseClient.js` shim → `/api/auth/me`
- **Employee** — Uses `employeeApi.auth` which routes through backend

## Verification

- [x] `server/lib/auth|shared` search in `netlify/functions/auth.js` returns 6 matches
- [x] Express `server/routes/auth.js` still contains `login|register|logout` endpoints
- [x] Auth contexts reference `/api/auth`, `SIGNED_IN`, `SIGNED_OUT`, `refreshSession`
- [x] `signInWithPassword` no longer called directly in `InternalAuthContext.jsx` (only in comment)
- [x] Server boots successfully

## Files Changed

| File | Action |
|---|---|
| `netlify/functions/auth.js` | **REWRITTEN** — Thin adapter importing from `server/lib/auth.js` |
| `src/modules/admin/context/InternalAuthContext.jsx` | **MODIFIED** — Login uses `/api/auth/login` instead of direct Supabase |

---
*Plan 02-01 completed: 2026-04-16*
