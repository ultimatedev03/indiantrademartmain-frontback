# Plan 01-03 Summary: Test Baseline & Parity Manifest

**Completed:** 2026-04-16
**Status:** ✅ Done

## What Was Done

### Task 1: API parity manifest and smoke test

1. **Created `tester-playwright-live/fixtures/api-contract-baseline.json`** — Baseline manifest listing:
   - 5 critical endpoints (health, auth/me, vendor search, dir search, support stats)
   - 4 public flow checks (homepage, directory, vendor login, buyer login)
   - 2 authenticated flow checks (vendor dashboard, admin dashboard)
   - 4 parity rules (cookie contract, API prefix stability, CSRF enforcement, rate limiting)

2. **Created `tester-playwright-live/tests/parity/api-contract-smoke.spec.mjs`** — Playwright spec that:
   - Reads the manifest JSON instead of hard-coding test cases
   - Validates critical endpoint reachability and response structure
   - Tests public page navigation flows
   - Tests authenticated portal flows (skip if no auth state recorded)
   - Validates parity rules (auth endpoint responds, health returns expected shape)
   - **Never mutates live data**

### Task 2: Update test entrypoints and documentation

3. **Updated `tester-playwright-live/README.md`** — Added "API contract parity checks" section explaining:
   - How to run parity tests
   - When to run them during migration
   - What the manifest covers

4. **Updated `tester-playwright-live/package.json`** — Added `test:parity` script
5. **Updated root `package.json`** — Added `test:parity` script for repo-level discoverability

## Verification

- [x] `api-contract-baseline.json` contains `criticalEndpoints`, `publicFlows`, `authenticatedFlows`
- [x] `api-contract-smoke.spec.mjs` imports from `api-contract-baseline.json`
- [x] README and root package.json reference `parity` / `api contract`
- [x] Test script is discoverable via `npm run test:parity` from both root and `tester-playwright-live`

## Files Changed

| File | Action |
|---|---|
| `tester-playwright-live/fixtures/api-contract-baseline.json` | **NEW** — Parity manifest |
| `tester-playwright-live/tests/parity/api-contract-smoke.spec.mjs` | **NEW** — Parity smoke test |
| `tester-playwright-live/README.md` | **MODIFIED** — Added parity docs |
| `tester-playwright-live/package.json` | **MODIFIED** — Added test:parity script |
| `package.json` | **MODIFIED** — Added root-level test:parity script |

---
*Plan 01-03 completed: 2026-04-16*
