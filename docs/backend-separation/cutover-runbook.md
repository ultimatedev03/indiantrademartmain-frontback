# Cutover Operational Runbook
**Milestone:** Backend API Separation

This document governs the procedures to safely deploy, test, rollback, and debug the fully segregated Node.js/Express backend API configuration for IndianTradeMart.

## Deployment
All front-end web client requests rely on `/api/*` and no longer utilize direct UI-based Supabase data operations or `.netlify` bypasses.
1. Deploy the central Express Server: Ensure the CI/CD pipeline pushes updates to `server.js`.
2. Wait for successful boot up: Healthcheck at `/health` must report `{"status": "OK"}`.
3. Deploy frontend via Netlify Build: It inherently respects the existing `/api/*` proxies routing seamlessly back to the Express cluster.
4. Temporary Proxy Note: `/netlify/functions/xyz` adapters are currently active explicitly as Express proxy funnels.

## Verification
Immediately after deploy, operations engineers must run a LIVE safety pass utilizing `tester-playwright-live`:
1. Run `./tester-playwright-live` checks to guarantee structural API parity.
   ```bash
   npm run test:parity
   npm run test:public
   ```
2. Any parity test returning non-200/403 expected statuses points to an immediately broken Express registration pattern on production edge. 

## Debugging
If `fetchWithCsrf` errors appear repeatedly inside Admin or Employee portals indicating `404 Not Found` or `401 Unauthorized`:
1. Ensure `AUTH_COOKIE_DOMAIN` aligns accurately across the Express and Vite origins post-cutover.
2. Confirm the `itm_csrf` CSRF cookie holds persistence across cross-origin boundary transitions. 
3. Fallback: If `supabase.from()` failovers were still needed in a particular untracked flow, search `src/modules` utilizing `rg "supabase.from"` to spot regression boundaries skipping backend APIs.

## Rollback
If the Express backend repeatedly crashes or suffers latency spikes over 3s causing application faults, run the following:
1. Re-enable `VITE_ADMIN_API_BASE` overrides to point forcibly to `/.netlify/functions/admin` bypass networks for crucial vendor components if their Express pathways break under RLS loads.
2. Reverse deployments through Netlify UI "Rollback to previous deploy" which instantly resets `_redirects` routing.
