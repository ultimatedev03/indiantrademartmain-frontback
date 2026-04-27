# IndianTradeMart Live Playwright Suite

This folder is a standalone Playwright package for live-site regression testing on `https://indiantrademart.com`.

It is designed so a tester can:

1. record authenticated sessions once per portal,
2. reuse those saved sessions for portal-only tests,
3. run public/security/navigation checks without logging in,
4. optionally enable mutation tests only when live data changes are acceptable.

## Install

```bash
cd tester-playwright-live
npm install
npm run install:browsers
```

## Configure credentials

Create `tester-playwright-live/.env` from `tester-playwright-live/.env.example` and fill the credentials for the roles you want to test.

Important:

- `BASE_URL` defaults to `https://indiantrademart.com`
- keep `HEADLESS=false` for auth recording, because live login can require CAPTCHA/manual action
- keep `ENABLE_MUTATION_TESTS=false` unless you intentionally want live create/update flows

## Record auth states

Public suites do not need login. Authenticated suites do.

Run one command per role you need:

```bash
npm run auth:buyer
npm run auth:vendor
npm run auth:admin
npm run auth:hr
npm run auth:finance
npm run auth:dataentry
npm run auth:support
npm run auth:sales
npm run auth:manager
npm run auth:vp
```

The recorder:

- opens the correct live login page
- pre-fills email/password from `.env`
- waits for the tester to complete CAPTCHA and submit
- saves storage state under `.auth/`

## Run suites

Run everything:

```bash
npm test
```

Public/security/navigation only:

```bash
npm run test:public
```

Authenticated portal regression:

```bash
npm run test:auth
```

Single bug ID:

```bash
npx playwright test --grep "BUG-260"
```

Headed:

```bash
npm run test:headed
```

Report:

```bash
npm run report
```

## Coverage focus

This package currently covers live-safe checks for:

- security headers and SEO basics
- public/footer page routing and CTA validation
- management portal role-link routing
- login page regressions such as missing home button and password toggle
- directory and vendor-list search/filter behaviour
- header dashboard routing for authenticated users
- admin navigation and KYC joined-date regression
- sales pricing-rule modal structure
- manager and VP dashboard filter behaviour
- vendor dashboard, products, notifications, and subscriptions smoke checks

## API contract parity checks

Parity tests verify that critical API-backed behaviour survives backend migration.
They are driven by the manifest at `fixtures/api-contract-baseline.json` and **never mutate data**.

Run parity checks:

```bash
npm run test:parity
```

Or from the root repo:

```bash
npm run test:parity
```

**When to run:**

- Before and after any major migration step in Phase 2 or Phase 3
- After changing Express route registrations, auth middleware, or Netlify function wiring
- As part of cutover verification in Phase 3

The baseline manifest lists critical endpoints, public page flows, and authenticated portal
smoke checks. It also documents parity rules (cookie contract, API prefix stability, CSRF
enforcement, rate limiting) that must hold throughout the migration.

## Mutation tests

Mutation tests are intentionally separated because they can create or change production data.

They remain skipped unless:

```bash
ENABLE_MUTATION_TESTS=true
```

