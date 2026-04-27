# Phase 2: Surface-by-Surface API Migration - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Move critical product flows behind the proper Express backend while preserving existing user-visible features, route contracts, auth behavior, and portal workflows.

</domain>

<decisions>
## Implementation Decisions

### Migration direction
- **D-01:** Auth and session plumbing migrate first because every other portal depends on it.
- **D-02:** Frontend-facing compatibility is prioritized over internal purity; route paths should remain stable while ownership moves.
- **D-03:** Shared server libraries should be reused by both Express and temporary adapters whenever duplication cannot be removed immediately.

### Scope of migration
- **D-04:** Protected business flows must stop relying on browser-side direct Supabase queries.
- **D-05:** Public and directory reads should move server-side when they currently mix business shaping or compatibility fallback logic.
- **D-06:** Internal portal services must use Express endpoints for stats, mutations, and sensitive reads instead of direct table access.

### Adapter strategy
- **D-07:** Netlify functions are allowed only as thin compatibility wrappers during migration.
- **D-08:** Large duplicated function bodies should be replaced with delegation to shared server logic or explicit proxy behavior.

### the agent's Discretion
- Exact service-layer file naming for extracted backend logic
- Exact batching order within each surface so long as auth compatibility stays first

</decisions>

<specifics>
## Specific Ideas

- Preserve cookie auth + CSRF semantics already used by the browser auth shim.
- Treat mixed service modules like `vendorApi`, `adminApi`, and `employeeApiComplete` as migration hotspots.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning artifacts
- `.planning/PROJECT.md`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/phases/01-contract-freeze-and-backend-baseline/01-api-surface-inventory.md`
- `.planning/phases/01-contract-freeze-and-backend-baseline/01-client-data-access-matrix.md`
- `.planning/phases/01-contract-freeze-and-backend-baseline/01-netlify-compat-matrix.md`
- `docs/backend-separation/backend-runtime-target.md`

### Auth and session
- `server/lib/auth.js`
- `server/routes/auth.js`
- `netlify/functions/auth.js`
- `src/lib/customSupabaseClient.js`

### Public and portal surfaces
- `server/routes/vendorProfile.js`
- `server/routes/dir.js`
- `server/routes/admin.js`
- `server/routes/employee.js`
- `server/routes/territory.js`
- `server/routes/finance.js`
- `server/routes/supportTickets.js`
- `server/routes/superadmin.js`
- `src/modules/public/services/publicApi.js`
- `src/modules/vendor/services/vendorApi.js`
- `src/modules/buyer/services/buyerApi.js`
- `src/modules/buyer/services/buyerProfileApi.js`
- `src/modules/admin/services/adminApi.js`
- `src/modules/employee/services/employeeApiComplete.js`
- `src/modules/employee/services/supportApi.js`
- `src/modules/employee/services/salesApi.js`
- `src/modules/employee/services/territoryApi.js`

### Compatibility layer
- `netlify/functions/auth.js`
- `netlify/functions/vendors.js`
- `netlify/functions/admin.js`
- `netlify/functions/employee.js`
- `netlify/functions/payment.js`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apiUrl` and `fetchWithCsrf` already support same-origin backend calls.
- `server/lib/auth.js` and `server/lib/supabaseClient.js` can anchor shared server behavior.

### Established Patterns
- Some frontend services already prefer Express and then fall back to Supabase when backend coverage is incomplete.
- Netlify functions frequently reimplement Express logic instead of delegating to shared code.

### Integration Points
- `customSupabaseClient.js` must stay aligned with the backend auth/session contract.
- `vendorProfile.js` and `auth.js` are likely anchor points for surface-by-surface extraction.

</code_context>

<deferred>
## Deferred Ideas

- Full repo split into separate frontend/backend repositories
- Product expansion work not directly required for backend separation

</deferred>

---

*Phase: 02-surface-by-surface-api-migration*
*Context gathered: 2026-04-16*
