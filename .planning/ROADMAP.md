# Roadmap: IndianTradeMart Backend Separation Program

## Overview

This roadmap replaces the current mixed frontend-plus-Supabase access model with a proper Node/Express backend boundary while preserving the same user-facing features, auth flows, and API behavior already used by the Buyer, Vendor, Admin, Employee, Directory, Finance, and Superadmin surfaces.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): committed migration work
- Decimal phases (2.1, 2.2): emergency insertions if parity gaps appear during migration

- [x] **Phase 1: Contract Freeze and Backend Baseline** - inventory the existing mixed architecture, freeze API contracts, and set up the separated Express foundation
- [x] **Phase 2: Surface-by-Surface API Migration** - move frontend data flows behind Express without changing feature behavior
- [x] **Phase 3: Cutover, Cleanup, and Verification** - switch all critical paths to the new backend, remove duplicate paths, and prove parity with tests

## Phase Details

### Phase 1: Contract Freeze and Backend Baseline
**Goal**: Create a reliable migration baseline so we can separate the backend without breaking existing portals or hidden edge cases.
**Depends on**: Nothing
**Requirements**: ARCH-01, ARCH-02, ARCH-03, API-01, API-02, TEST-01
**Success Criteria** (what must be TRUE):
1. A full API inventory exists for `server/routes`, `netlify/functions`, and frontend callers that still query Supabase directly.
2. The new backend target shape is documented as Node/Express-first, with shared auth, middleware, env, and deployment rules.
3. Regression baselines exist for public pages and authenticated portals before any major endpoint migration starts.
4. We know which routes must remain backward compatible and which duplicate implementations can later be retired.
**Plans**: 3 plans

Plans:
- [x] 01-01: Audit all current API consumers, direct Supabase reads/writes, and Netlify function mirrors
- [x] 01-02: Define the proper backend boundary, shared Express modules, env strategy, and deployment contract
- [x] 01-03: Lock a test baseline using live-safe Playwright smoke coverage plus route-level parity checklists

### Phase 2: Surface-by-Surface API Migration
**Goal**: Move business logic and database access behind Express for every critical surface while keeping the same features and response behavior.
**Depends on**: Phase 1
**Requirements**: ARCH-04, API-03, API-04, AUTH-01, AUTH-02, DATA-01, DATA-02
**Success Criteria** (what must be TRUE):
1. Frontend modules no longer need direct Supabase access for protected business flows that belong in the backend.
2. Auth, vendor, buyer, employee, admin, finance, territory, support, payment, referral, and directory APIs resolve through the proper Express service boundary.
3. Netlify mirrors are either converted into thin proxies/adapters or clearly marked for removal after cutover.
4. Existing API paths and payload expectations continue to work so current frontend screens do not require a breaking rewrite.
**Plans**: 4 plans

Plans:
- [x] 02-01: Migrate auth and shared session plumbing into the separated Express backend contract
- [x] 02-02: Migrate public, vendor, buyer, and directory flows that still depend on direct Supabase queries
- [x] 02-03: Migrate admin, employee, territory, finance, support, and superadmin business flows
- [x] 02-04: Wrap or replace Netlify function duplicates so only one source of truth remains per API capability

### Phase 3: Cutover, Cleanup, and Verification
**Goal**: Finish the separation safely, simplify the stack, and prove that the Express backend fully owns the platform behavior.
**Depends on**: Phase 2
**Requirements**: DEP-01, DEP-02, TEST-02, TEST-03, TEST-04, OPS-01
**Success Criteria** (what must be TRUE):
1. Production and local environments can run with the frontend and backend as clearly separated deployable units.
2. Deprecated duplicate API paths, direct protected Supabase calls, and temporary compatibility shims are removed or isolated behind documented exceptions.
3. Regression tests cover public routes, portal authentication, and the highest-risk business flows after cutover.
4. Deployment, rollback, and debugging steps are documented so future work can continue without rebuilding migration context.
**Plans**: 3 plans

Plans:
- [x] 03-01: Cut frontend consumers to the final Express-backed contract and validate env/runtime separation
- [x] 03-02: Remove duplicate handlers, dead adapters, and leftover direct protected data access
- [x] 03-03: Run final regression, document operations, and freeze the backend separation milestone

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Contract Freeze and Backend Baseline | 3/3 | ✅ Complete | 2026-04-16 |
| 2. Surface-by-Surface API Migration | 4/4 | ✅ Complete | 2026-04-16 |
| 3. Cutover, Cleanup, and Verification | 3/3 | ✅ Complete | 2026-04-16 |

## Deferred After Separation

These remain valuable, but they should land after the backend boundary is stable:
- AI-assisted vendor tagging and buyer matchmaking
- premium design overhaul and landing page revamp
- advanced vendor analytics
- real-time RFQ and chat expansion
