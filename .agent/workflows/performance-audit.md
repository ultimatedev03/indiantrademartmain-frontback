---
description: Audit bundle, rendering, and API hot paths for this Vite plus Express app
---

# Performance Audit Workflow

Use this checklist before shipping changes that can affect load time, build size, or backend latency.

## Inputs
- `TARGET_PATH` - optional focus area such as `src/modules/directory` or `server/routes/payment.js`

## Steps

1. Produce a fresh production build.
```bash
npm run build
```
Use the build output to spot unusually large chunks or failed prerender work.

2. Review Vite-level customizations.
Inspect `vite.config.js` and the `plugins/` folder before changing anything tied to the visual editor, selection mode, fetch monkey-patching, or async stylesheet handling.

3. Check heavy frontend surfaces.
Focus on `src/modules`, `src/shared/pages`, and large Radix-heavy screens for unnecessary rerenders, oversized imports, or duplicate API calls.

4. Review API hot paths.
Inspect affected files in `server/routes` and `server/lib` for repeated Supabase queries, missing pagination, or synchronous work inside request handlers.

5. Re-check SEO and prerender side effects.
If routing or page generation changed, inspect `tools/generateSitemap.js`, `tools/generate-llms.js`, and `tools/prerender-seo.js`.

6. Verify live-safe regression after optimization.
```bash
cd tester-playwright-live
npm run test:public
```

7. Summarize the bottleneck, evidence, and fix.
Call out whether the issue is `bundle`, `render`, `network`, `server`, or `database` bound.
