---
description: Run the standalone Playwright suite against the live IndianTradeMart deployment
---

# Live Regression Workflow

Use the dedicated Playwright package for production-safe smoke coverage.

## Steps

1. Install the test workspace if needed.
```bash
cd tester-playwright-live
npm install
npm run install:browsers
```

2. Prepare credentials.
Copy `.env.example` to `.env` inside `tester-playwright-live` and fill only the roles you plan to test.

3. Record auth state for the required portal.
```bash
npm run auth:buyer
npm run auth:vendor
npm run auth:admin
```
Use the matching role command when a portal flow requires login.

4. Run public-safe coverage first.
```bash
npm run test:public
```

5. Run authenticated coverage only after auth state exists.
```bash
npm run test:auth
```

6. Run a narrow bug check when needed.
```bash
npx playwright test --grep "BUG-260"
```

7. Open the HTML report after failures.
```bash
npm run report
```

8. Do not enable mutation tests casually.
Only run mutation suites when production data changes are acceptable and `ENABLE_MUTATION_TESTS=true` is intentional.
