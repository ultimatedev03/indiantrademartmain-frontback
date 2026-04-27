# Phase 1: Contract Freeze and Backend Baseline - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Create the migration baseline for backend separation: inventory the current API estate, define the Node/Express target boundary, and lock a regression baseline before behavior-changing migration work begins.

</domain>

<decisions>
## Implementation Decisions

### Backend ownership
- **D-01:** Node.js + Express becomes the primary runtime for business APIs.
- **D-02:** Existing `/api/*` route contracts stay stable during migration unless a compatibility adapter is added first.
- **D-03:** Netlify functions are treated as temporary adapters or mirrors, not the long-term source of truth.

### Audit scope
- **D-04:** Inventory must cover `server/routes`, `netlify/functions`, and frontend modules that still call Supabase directly.
- **D-05:** Protected browser-side Supabase access is considered migration debt and must be identified explicitly.

### Verification baseline
- **D-06:** Playwright live-safe coverage is the baseline regression harness for public and authenticated portals.
- **D-07:** A route parity manifest is required before major cutover work starts.

### the agent's Discretion
- Exact document layout for inventories and parity manifests
- Exact naming of shared Express bootstrap helpers introduced in this phase

</decisions>

<specifics>
## Specific Ideas

- Keep the same user-visible API behavior while changing backend ownership underneath.
- Use the current mixed architecture as source material, not as the target architecture.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning artifacts
- `.planning/PROJECT.md` — project architecture summary and migration goal
- `.planning/ROADMAP.md` — phase goal, success criteria, and plan counts
- `.planning/REQUIREMENTS.md` — requirement IDs that must map to execution plans
- `.planning/STATE.md` — current focus and migration concerns

### Current backend shape
- `server/server.js` — current Express bootstrap and mounted route prefixes
- `server/lib/auth.js` — shared auth helpers already extracted on the server side
- `server/lib/supabaseClient.js` — server-side Supabase runtime and retry behavior
- `server/routes/auth.js` — Express auth behavior that must remain compatible
- `server/routes/vendorProfile.js` — high-volume vendor/public endpoints used across portals

### Current compatibility mirrors
- `netlify/functions/auth.js` — duplicate auth implementation for Netlify runtime
- `netlify/functions/vendors.js` — duplicate vendor/public implementation for Netlify runtime

### Current frontend data access
- `src/lib/apiBase.js` — same-origin API URL contract
- `src/lib/customSupabaseClient.js` — browser auth shim and API bridge behavior
- `src/modules/public/services/publicApi.js` — direct public Supabase usage
- `src/modules/vendor/services/vendorApi.js` — mixed Express + direct Supabase vendor access
- `src/modules/admin/services/adminApi.js` — internal portal mixed server/client access
- `src/modules/employee/services/employeeApiComplete.js` — employee workflows currently using direct Supabase

### Regression harness
- `tester-playwright-live/README.md` — live-safe testing workflow
- `tester-playwright-live/playwright.config.mjs` — current Playwright runtime contract

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `fetchWithCsrf` plus `apiUrl` already provide a consistent browser-to-API calling pattern.
- `server/lib/auth.js` and `server/lib/supabaseClient.js` already centralize key backend concerns.

### Established Patterns
- Express routes are mounted centrally in `server/server.js`.
- Netlify functions often duplicate large chunks of Express route logic instead of delegating.
- Frontend modules frequently fall back to direct Supabase calls when server endpoints are missing or unreliable.

### Integration Points
- Future migration work must preserve the auth cookie + CSRF contract used by `customSupabaseClient.js`.
- The live Playwright suite is the best current parity safety net for migration.

</code_context>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 01-contract-freeze-and-backend-baseline*
*Context gathered: 2026-04-16*
