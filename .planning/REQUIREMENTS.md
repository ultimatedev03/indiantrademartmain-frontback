# Requirements: IndianTradeMart Backend Separation Program

**Defined:** 2026-04-16
**Core Value:** The product keeps all existing API-backed features, but the platform becomes easier to scale, test, deploy, and maintain because protected business logic lives behind a proper Node/Express backend.

## v1 Requirements

### Architecture

- [ ] **ARCH-01**: A single backend architecture decision exists for the migration target, with Node.js and Express as the primary runtime for business APIs.
- [ ] **ARCH-02**: Shared backend concerns such as auth, middleware, env loading, security headers, rate limits, logging, and error formatting are centralized instead of being duplicated across runtimes.
- [ ] **ARCH-03**: Current API ownership is mapped for `server/routes`, `netlify/functions`, and frontend modules that still access Supabase directly.
- [ ] **ARCH-04**: Protected business operations move behind the backend boundary instead of running directly from the browser with Supabase client calls.

### API Parity

- [ ] **API-01**: Existing route prefixes such as `/api/auth`, `/api/vendors`, `/api/support`, `/api/payment`, `/api/employee`, `/api/territory`, `/api/finance`, `/api/superadmin`, and related surfaces are inventoried before migration.
- [ ] **API-02**: API payloads, status codes, auth expectations, and critical side effects are documented before migration work begins.
- [ ] **API-03**: The separated Express backend preserves the same user-visible capabilities already available in the current frontend.
- [ ] **API-04**: Frontend integrations can migrate without a full UI rewrite because compatibility is maintained for agreed API contracts.

### Authentication and Security

- [ ] **AUTH-01**: Cookie-based auth, CSRF behavior, role guards, and portal isolation continue to work after backend separation.
- [ ] **AUTH-02**: Rate limiting, sanitization, and protected-route checks remain enforced after moving to the separated backend.

### Data and Runtime Ownership

- [ ] **DATA-01**: Direct browser-side Supabase access is reduced for protected workflows such as profile mutations, payments, ticketing, admin actions, employee operations, and lead/proposal flows.
- [ ] **DATA-02**: Netlify function duplicates are either removed, converted into thin adapters, or explicitly justified as temporary compatibility layers.

### Deployment and Operations

- [ ] **DEP-01**: Frontend and backend can be run and deployed as clearly separated units with defined env variables and startup expectations.
- [ ] **DEP-02**: Rollback and cutover steps are documented for the migration to the separated backend.
- [ ] **OPS-01**: The team has documentation for local dev, deployment, debugging, and future backend ownership after the migration.

### Testing and Verification

- [ ] **TEST-01**: A regression baseline exists before migration using the current live-safe Playwright suite and API parity checklists.
- [ ] **TEST-02**: Public routes and authenticated portal smoke flows are rerun after major migration steps.
- [ ] **TEST-03**: High-risk backend domains such as auth, payments, support, KYC, and vendor lead flows receive explicit verification during cutover.
- [ ] **TEST-04**: Final sign-off proves that the separated backend preserves the same business behavior for the main portals.

## v2 Requirements

These are intentionally deferred until the backend separation milestone is stable.

### Product Expansion

- **FUTURE-01**: AI-assisted vendor catalog tagging and buyer requirement matching
- **FUTURE-02**: Premium design overhaul across directory and portal surfaces
- **FUTURE-03**: Advanced vendor analytics dashboards
- **FUTURE-04**: Expanded real-time messaging and RFQ collaboration

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full frontend redesign during migration | Would mix UI churn with backend parity work and make regressions harder to isolate |
| New product modules unrelated to backend separation | Would dilute the migration milestone and increase context load |
| Immediate repo split into separate repositories | Can be considered later, but first priority is a clean runtime and deployment boundary |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ARCH-01 | Phase 1 | Complete |
| ARCH-02 | Phase 1 | Complete |
| ARCH-03 | Phase 1 | Complete |
| ARCH-04 | Phase 2 | Complete |
| API-01 | Phase 1 | Complete |
| API-02 | Phase 1 | Complete |
| API-03 | Phase 2 | Complete |
| API-04 | Phase 2 | Complete |
| AUTH-01 | Phase 2 | Complete |
| AUTH-02 | Phase 2 | Complete |
| DATA-01 | Phase 2 | Complete |
| DATA-02 | Phase 2 | Complete |
| DEP-01 | Phase 3 | Complete |
| DEP-02 | Phase 3 | Complete |
| OPS-01 | Phase 3 | Complete |
| TEST-01 | Phase 1 | Complete |
| TEST-02 | Phase 3 | Complete |
| TEST-03 | Phase 3 | Complete |
| TEST-04 | Phase 3 | Complete |

**Coverage:**
- v1 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0

---
*Requirements defined: 2026-04-16*
*Last updated: 2026-04-16 after backend separation planning pass*
