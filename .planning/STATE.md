# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-16)

**Core value:** Keep all current product behavior while moving protected business logic behind a proper Node/Express backend boundary.
**Current focus:** Phase 1 complete — ready for Phase 2

## Current Position

Phase: 3 of 3 ✅ COMPLETE (Cutover, Cleanup, and Verification)
Plan: 3 of 3 in current phase — all complete
Status: Backend Separation Milestone Fully Completed
Last activity: 2026-04-16 - Completed all 3 plans in Phase 3

Progress: [██████████] 100%

## Performance Metrics

- Total plans completed: 10
- Average duration: ~15 min per plan
- Total run time: ~150 min

## Accumulated Context

### Decisions

- Backend migration target is Node.js + Express as the primary API runtime.
- Existing `/api/*` behavior must stay compatible while frontend callers migrate.
- Netlify functions are compatibility layers, not the long-term source of truth.
- Express app bootstrap extracted to `server/app.js` for reusability.
- Runtime config centralized in `server/lib/runtimeConfig.js`.
- API response helpers standardized in `server/lib/apiResponder.js`.

### Key Findings (Phase 1)

- **Auth is already behind Express.** The customSupabaseClient.js auth shim uses `/api/auth/*`.
- **Data access is the main migration debt.** Protected flows use direct Supabase from browser.
- **18/20 Netlify functions fully duplicate Express routes** and should be retired.
- **Production uses Netlify for some surfaces** (adminApi runtime switch defaults to `/.netlify/functions/*`).
- **6 frontend modules have purely direct protected Supabase access** (must migrate in Phase 2).

### Pending Todos

None. The backend separation architecture is fully deployed locally and tracked successfully.

## Phase Delivery

| Artifact | Path |
|---|---|
| Complete Backend Target Docs | `docs/backend-separation/backend-runtime-target.md` |
| Express Runbook Docs | `docs/backend-separation/cutover-runbook.md` |
| Parity Baseline Checkers | `tester-playwright-live/fixtures/api-contract-baseline.json` |

## Blockers/Concerns

- `server/routes` and `netlify/functions` contain overlapping logic (documented in audit).
- Frontend modules still perform many direct Supabase reads/writes for protected flows (documented in matrix).

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Product expansion | AI, design overhaul, analytics, real-time chat after backend stabilization | Deferred | 2026-04-16 |

## Session Continuity

Last session: 2026-04-16
Stopped at: Backend API Separation Program complete
Resume file: None
