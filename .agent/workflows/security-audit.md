---
description: Review the IndianTradeMart stack for auth, secret, and Supabase security issues
---

# Security Audit Workflow

Perform a repo-aware security pass across frontend, backend, and database surfaces.

## Inputs
- `TARGET_PATH` - optional path to focus on; default to `src server netlify/functions supabase`

## Steps

1. Scan for hardcoded secrets and dangerous tokens.
```bash
rg -n "sk-|SERVICE_ROLE|SUPABASE_SERVICE_ROLE|RAZORPAY_KEY_SECRET|Bearer " src server netlify/functions supabase
```

2. Check client-side environment access.
```bash
rg -n "process\\.env|import\\.meta\\.env" src
```
Flag anything exposing non-public secrets to the browser.

3. Review auth and throttling at the Express entrypoint.
Read `server/server.js` and verify `apiLimiter`, `authLimiter`, `otpLimiter`, security headers, and sanitization still cover new routes.

4. Check route protection boundaries.
Inspect `server/middleware` plus affected files in `server/routes` for missing auth, role checks, or unsafe fallbacks.

5. Review serverless and edge surfaces.
Inspect `netlify/functions` and `supabase/functions` for duplicated auth logic, weak CORS assumptions, or webhook verification gaps.

6. Verify database policy intent.
```bash
rg -n "enable row level security|create policy|alter table" supabase/migrations
```
Flag new tables or queries that do not have matching RLS and policy coverage.

7. Run a safe public regression pass when behavior changed.
```bash
cd tester-playwright-live
npm run test:public
```

8. Report findings by severity.
Use `Critical`, `High`, `Medium`, and `Low`, and include the exact file that needs follow-up.
