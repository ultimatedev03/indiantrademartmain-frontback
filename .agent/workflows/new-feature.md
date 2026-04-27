---
description: Add a feature across the React, Express, and Supabase layers used by this repo
---

# New Feature Workflow

Implement features in this repository without leaving one layer half-done.

## Inputs
- `FEATURE_NAME` - short label for the capability
- `TARGET_SURFACE` - portal or domain area such as `vendor`, `buyer`, `admin`, `directory`, or `public`

## Steps

1. Map the owning frontend area.
Use `src/modules/$TARGET_SURFACE`, `src/shared`, and `src/components` before creating new top-level folders.

2. Map the backend and deployment entry points.
Check `server/routes`, `server/lib`, and `netlify/functions` to see whether the feature belongs in the main Express API, a serverless wrapper, or both.

3. Check data impact first.
If the feature changes tables, policies, or edge behavior, add the work in `supabase/migrations` or `supabase/functions` before wiring UI assumptions around missing schema.

4. Update shared integration points.
Review `src/lib/apiBase.js`, `src/lib/customSupabaseClient.js`, auth contexts, and any subdomain routing logic touched by the feature.

5. Run the local stack.
```bash
npm run dev
```

6. Run the narrowest verification that exists.
```bash
cd tester-playwright-live
npm run test:public
```
If the feature is portal-specific, use `npm run test:auth` after recording the right role.

7. Update operational docs when behavior changes.
Touch `README.md`, `docs/openapi.yaml`, or deployment notes whenever routes, env vars, or external integrations change.
