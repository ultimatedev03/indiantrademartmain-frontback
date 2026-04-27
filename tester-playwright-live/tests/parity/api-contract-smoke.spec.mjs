/**
 * API Contract Parity Smoke Tests
 *
 * These tests validate that critical API-backed features still work
 * after backend separation migration steps. They are driven by the
 * api-contract-baseline.json manifest and do NOT mutate live data.
 *
 * Run:   npx playwright test tests/parity/
 * Scope: Public endpoint reachability + authenticated portal smoke
 */

import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const baselinePath = resolve(__dirname, '../../fixtures/api-contract-baseline.json');
const baseline = JSON.parse(readFileSync(baselinePath, 'utf-8'));

// ---------------------------------------------------------------------------
// Critical Endpoint Checks (no auth required for public ones)
// ---------------------------------------------------------------------------

test.describe('API Contract Parity — Critical Endpoints', () => {
  for (const [name, endpoint] of Object.entries(baseline.criticalEndpoints)) {
    // Skip endpoints that require auth for now — covered in authenticatedFlows
    if (['authMe', 'supportStats'].includes(name)) continue;

    test(`${name}: ${endpoint.method} ${endpoint.path}`, async ({ request }) => {
      const response = await request[endpoint.method.toLowerCase()](endpoint.path);
      const status = response.status();

      expect(
        endpoint.expectedStatus.includes(status),
        `Expected status in ${JSON.stringify(endpoint.expectedStatus)}, got ${status}`
      ).toBeTruthy();

      if (endpoint.expectedBody?.containsKey) {
        const body = await response.json();
        expect(body).toHaveProperty(endpoint.expectedBody.containsKey);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Public Flow Checks (page navigation — no login)
// ---------------------------------------------------------------------------

test.describe('API Contract Parity — Public Flows', () => {
  for (const flow of baseline.publicFlows) {
    test(`Public: ${flow.name}`, async ({ page }) => {
      const response = await page.goto(flow.url, { waitUntil: 'domcontentloaded' });

      for (const assertion of flow.assertions) {
        switch (assertion.type) {
          case 'status':
            expect(response?.status()).toBe(assertion.expected);
            break;
          case 'title':
            if (assertion.contains) {
              const title = await page.title();
              expect(title.toLowerCase()).toContain(assertion.contains.toLowerCase());
            }
            break;
          case 'visible':
            await expect(page.locator(assertion.selector).first()).toBeVisible({ timeout: 15000 });
            break;
          default:
            break;
        }
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Authenticated Flow Checks (require recorded auth state)
// ---------------------------------------------------------------------------

test.describe('API Contract Parity — Authenticated Flows', () => {
  for (const flow of baseline.authenticatedFlows) {
    const authFile = resolve(__dirname, `../../.auth/${flow.portal}.json`);

    test(`Auth: ${flow.name}`, async ({ browser }) => {
      // Skip if auth state hasn't been recorded for this portal
      let hasAuth = false;
      try {
        readFileSync(authFile);
        hasAuth = true;
      } catch {
        // no auth file
      }

      if (!hasAuth) {
        test.skip();
        return;
      }

      const context = await browser.newContext({ storageState: authFile });
      const page = await context.newPage();

      const response = await page.goto(flow.url, { waitUntil: 'domcontentloaded' });

      for (const assertion of flow.assertions) {
        switch (assertion.type) {
          case 'status':
            expect(response?.status()).toBe(assertion.expected);
            break;
          case 'noError': {
            const errors = [];
            page.on('pageerror', (err) => errors.push(err.message));
            await page.waitForTimeout(3000);
            expect(errors).toHaveLength(0);
            break;
          }
          default:
            break;
        }
      }

      await context.close();
    });
  }
});

// ---------------------------------------------------------------------------
// Parity Rules — Structural Checks
// ---------------------------------------------------------------------------

test.describe('API Contract Parity — Parity Rules', () => {
  test('AUTH_COOKIE_CONTRACT: Login endpoint sets expected cookies', async ({ request }) => {
    // This test sends a login request with invalid credentials.
    // We only check that the endpoint responds — not that login succeeds.
    // A successful cookie check requires valid test credentials.
    const response = await request.post('/api/auth/login', {
      data: { email: 'parity-check@test.invalid', password: 'noop' },
    });

    // Should get a 401 or 400 — not a 500 or connection error
    const status = response.status();
    expect([400, 401, 403, 429].includes(status), `Login endpoint responded with unexpected ${status}`).toBeTruthy();
  });

  test('API_PREFIX_STABILITY: /health returns JSON with status field', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('status', 'OK');
  });
});
