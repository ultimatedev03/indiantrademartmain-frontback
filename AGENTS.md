# Repository Guidelines

## Project Structure & Module Organization
`src/modules` holds the product surfaces, while reusable UI and shared logic live in `src/components`, `src/shared`, `src/contexts`, `src/hooks`, and `src/lib`. The frontend runs as a Vite SPA with `@` mapped to `src` in `vite.config.js`, plus custom visual-editor and selection plugins under `plugins/`. `server/server.js` wires the Express API on port 3001; route handlers live in `server/routes`, shared backend services in `server/lib`, and request guards in `server/middleware`. Deployment-facing serverless entry points are mirrored in `netlify/functions`. Database schema changes and edge functions belong in `supabase/migrations` and `supabase/functions`.

## Build, Test, and Development Commands
`npm run dev` starts the full local stack by booting the Express server, waiting for `/health`, then launching Vite on port 3000. Use `npm run dev:client` for frontend-only work and `npm run dev:server` for API-only work. `npm run build` regenerates sitemaps and `public/llms.txt`, then runs the Vite build and SEO prerender step. `npm run preview` serves the built app locally. `npm run repair:employees-auth` runs the employee auth repair script in `server/scripts`.

For live-site regression coverage, use `tester-playwright-live`: `npm test`, `npm run test:public`, `npm run test:auth`, and `npx playwright test --grep "BUG-260"`.

## Coding Style & Naming Conventions
This codebase is ESM JavaScript and JSX, not TypeScript. Keep feature work inside the matching frontend and backend domains instead of creating cross-cutting folders. Reuse the design tokens in `src/lib/design-tokens.js`, the shared utilities in `src/lib` and `src/shared`, and the existing Radix/Tailwind patterns before inventing new UI primitives. Preserve the custom Vite plugin hooks unless you are intentionally updating the editor workflow. Tailwind is configured in `tailwind.config.js` with dark-mode class support and project color tokens.

## Testing Guidelines
No root unit-test or lint command is wired in `package.json`, so avoid claiming coverage that was not run. The real automated coverage lives in `tester-playwright-live`, which targets production-safe public and authenticated smoke flows. Mutation suites are intentionally separated and should only run when `ENABLE_MUTATION_TESTS=true` is set on purpose.

## Commit & Pull Request Guidelines
Recent commits use short informal messages such as `done`, `done by dp`, and `flow+code+edit`, so there is no enforced convention yet. Prefer new commits that are specific and imperative, for example `fix: harden OTP rate limiting` or `feat: add vendor dashboard filter`. In pull requests, call out which surfaces changed (`src/modules`, `server/routes`, `netlify/functions`, `supabase/migrations`) and note any required env, data, or deployment follow-up.
