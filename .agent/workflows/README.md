---
description: Overview of repo-specific agent workflows
---

# Workflow Index

Use these workflow files as slash-command style checklists for the current repository.

## Available Workflows
- `/new-feature` - scaffold work across frontend modules, Express routes, and Supabase migrations without missing docs or deployment touchpoints.
- `/security-audit` - review client, server, Netlify, and Supabase surfaces for auth, secret, and RLS issues.
- `/performance-audit` - inspect build output, route hot paths, and custom Vite/editor integrations for regressions.
- `/live-regression` - run the standalone Playwright package against the live site with the correct auth-recording flow.

## Notes
- The main app lives at the repo root.
- Live regression tooling lives in `tester-playwright-live`.
- Repo conventions are documented in `AGENTS.md`.
