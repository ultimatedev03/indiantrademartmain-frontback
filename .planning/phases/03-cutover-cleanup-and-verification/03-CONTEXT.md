# Phase 3: Cutover, Cleanup, and Verification - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Finalize the backend separation by switching the frontend fully to the Express-backed contract, removing duplicate or temporary migration shims, and proving parity through regression checks and operational documentation.

</domain>

<decisions>
## Implementation Decisions

### Cutover rules
- **D-01:** Frontend runtime and environment setup must clearly separate client and backend responsibilities.
- **D-02:** Temporary compatibility shims are removed only after parity checks pass.
- **D-03:** Direct protected browser-side Supabase access is treated as cleanup debt to remove before phase completion.

### Verification rules
- **D-04:** Public pages, authentication, vendor flows, and internal portals must be rerun through live-safe regression checks.
- **D-05:** High-risk domains include auth, payments, support, KYC, vendor leads/proposals, and internal approvals.

### Operational readiness
- **D-06:** The milestone is not complete until deployment, rollback, and debugging steps are documented for the separated backend.

### the agent's Discretion
- Exact staging order for final cutover flags and compatibility removals
- Exact runbook layout so long as deploy, rollback, and debugging are clearly covered

</decisions>

<specifics>
## Specific Ideas

- Keep same-origin `/api` behavior for the browser unless a documented deployment override is required.
- Remove compatibility layers only when a replacement backend path has already been verified.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning artifacts
- `.planning/PROJECT.md`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `docs/backend-separation/backend-runtime-target.md`

### Runtime and env wiring
- `src/lib/apiBase.js`
- `vite.config.js`
- `tools/devAll.js`
- `package.json`
- `.env.netlify.example`
- `server/server.js`

### Migration outputs
- `src/lib/customSupabaseClient.js`
- `src/modules/public/services/publicApi.js`
- `src/modules/vendor/services/vendorApi.js`
- `src/modules/admin/services/adminApi.js`
- `src/modules/employee/services/employeeApiComplete.js`
- `netlify/functions/_shared/expressProxy.js`

### Verification and operations
- `tester-playwright-live/README.md`
- `tester-playwright-live/playwright.config.mjs`
- `tester-playwright-live/tests/parity/api-contract-smoke.spec.mjs`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apiUrl` already supports same-origin routing and can remain the browser entrypoint after cutover.
- `tester-playwright-live` already contains public and authenticated smoke tests to extend.

### Established Patterns
- Current frontend services often mix direct Supabase and backend fallbacks; Phase 3 should remove those leftovers.
- Runtime docs and startup scripts are currently optimized for the mixed architecture and must be updated.

### Integration Points
- Final cleanup touches both frontend service files and Netlify compatibility files.
- Operational docs should match how the repo is actually started and deployed after cutover.

</code_context>

<deferred>
## Deferred Ideas

- Repo split into separate frontend/backend repositories after stable cutover

</deferred>

---

*Phase: 03-cutover-cleanup-and-verification*
*Context gathered: 2026-04-16*
