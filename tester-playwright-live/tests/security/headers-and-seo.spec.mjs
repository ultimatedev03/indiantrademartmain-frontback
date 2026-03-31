import { test, expect } from '@playwright/test';
import { env } from '../../utils/env.mjs';

const securityHeaders = [
  { bugs: ['BUG-119', 'BUG-156'], name: 'Content-Security-Policy', assert: (value) => Boolean(value && value.includes('default-src')) },
  { bugs: ['BUG-120', 'BUG-159'], name: 'X-Frame-Options', assert: (value, response) => Boolean(value) || String(response.headers()['content-security-policy'] || '').includes('frame-ancestors') },
  { bugs: ['BUG-121'], name: 'X-Content-Type-Options', assert: (value) => String(value || '').toLowerCase() === 'nosniff' },
  { bugs: ['BUG-122', 'BUG-157'], name: 'Strict-Transport-Security', assert: (value) => String(value || '').toLowerCase().includes('max-age=') },
  { bugs: ['BUG-123'], name: 'Permissions-Policy', assert: (value) => Boolean(value) },
  { bugs: ['BUG-130'], name: 'Referrer-Policy', assert: (value) => Boolean(value) },
  { bugs: ['BUG-158'], name: 'Cross-Origin-Opener-Policy', assert: (value) => Boolean(value) },
];

for (const header of securityHeaders) {
  test(`${header.bugs.join(' ')} exposes ${header.name} on homepage`, async ({ request }) => {
    const response = await request.get(env.baseUrl);
    expect(response.ok()).toBeTruthy();
    const headerValue = response.headers()[header.name.toLowerCase()];
    expect(header.assert(headerValue, response)).toBeTruthy();
  });
}

test('BUG-124 privacy policy page is reachable', async ({ page }) => {
  await page.goto('/privacy-policy', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/privacy-policy$/);
  await expect(page.getByRole('heading', { name: /privacy policy/i })).toBeVisible();
});

test('BUG-124 terms of service page is reachable', async ({ page }) => {
  await page.goto('/terms-of-service', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/terms-of-service$/);
  await expect(page.getByRole('heading', { name: /terms of use/i })).toBeVisible();
});

test('BUG-125 homepage meta description is meaningful and keyword rich', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const description = await page.locator('meta[name="description"]').getAttribute('content');
  expect(description).toBeTruthy();
  expect(description.length).toBeGreaterThan(120);
  expect(description.toLowerCase()).toContain('b2b');
  expect(description.toLowerCase()).toContain('marketplace');
});

test('BUG-126 homepage publishes structured data', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('script[type="application/ld+json"]').first()).toBeAttached();
});

test('BUG-129 homepage is not blank when JavaScript is disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(env.baseUrl, { waitUntil: 'domcontentloaded' });
  const bodyText = (await page.locator('body').innerText()).trim();
  expect(bodyText.length).toBeGreaterThan(40);
  await context.close();
});

test('BUG-151 html lang attribute is present', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const lang = await page.locator('html').getAttribute('lang');
  expect(String(lang || '').trim().length).toBeGreaterThan(0);
});
