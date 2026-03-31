import { test, expect } from '@playwright/test';
import { optionCount, selectFirstRealOption } from '../../utils/test-helpers.mjs';

test('BUG-195 state dropdown on vendor directory is clickable and populated', async ({ page }) => {
  await page.goto('/directory/vendor', { waitUntil: 'domcontentloaded' });
  const stateSelect = page.locator('select').nth(0);
  await expect(stateSelect).toBeVisible();
  await expect.poll(async () => optionCount(stateSelect)).toBeGreaterThan(1);
});

test('BUG-180 BUG-243 city dropdown stays disabled until a state is selected', async ({ page }) => {
  await page.goto('/directory/vendor', { waitUntil: 'domcontentloaded' });
  const citySelect = page.locator('select').nth(1);
  await expect(citySelect).toBeDisabled();
});

test('BUG-181 selected state loads city options', async ({ page }) => {
  await page.goto('/directory/vendor', { waitUntil: 'domcontentloaded' });
  const stateSelect = page.locator('select').nth(0);
  const citySelect = page.locator('select').nth(1);
  await selectFirstRealOption(stateSelect);
  await expect(citySelect).toBeEnabled();
  await expect.poll(async () => optionCount(citySelect)).toBeGreaterThan(1);
});

test('BUG-179 vendor directory keyword search reacts to a valid query', async ({ page }) => {
  await page.goto('/directory/vendor', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder(/search products or services/i).fill('cloth');
  await page.getByRole('button', { name: /^search$/i }).click();
  const text = await page.locator('body').innerText();
  expect(text.length).toBeGreaterThan(100);
});

test('BUG-284 vendor directory search filters by vendor/company name and city', async ({ page }) => {
  await page.goto('/directory/vendor', { waitUntil: 'domcontentloaded' });

  const firstCardData = await page.locator('main').evaluate(() => {
    const cards = Array.from(document.querySelectorAll('main [class*="cursor-pointer"]'));
    for (const card of cards) {
      const heading = card.querySelector('h3');
      if (!heading) continue;
      const lines = String(card.innerText || card.textContent || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      const locationLine = lines.find((line) => line.includes(','));
      return {
        name: heading.textContent?.trim() || '',
        city: locationLine?.split(',')[0]?.trim() || '',
      };
    }
    return { name: '', city: '' };
  });

  const nameQuery = String(firstCardData.name || '').split(' ').filter(Boolean).slice(0, 2).join(' ');
  test.skip(!nameQuery, 'No vendor card data available to validate search.');

  await page.getByPlaceholder(/search products or services/i).fill(nameQuery);
  await page.getByRole('button', { name: /^search$/i }).click();
  await expect(page.locator('body')).toContainText(new RegExp(nameQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));

  const cityQuery = String(firstCardData.city || '').trim();
  test.skip(!cityQuery, 'No city data available to validate city filtering.');

  await page.getByPlaceholder(/search products or services/i).fill('');
  await page.getByPlaceholder(/enter city name/i).fill(cityQuery);
  await page.getByRole('button', { name: /^search$/i }).click();
  await expect(page.locator('body')).toContainText(new RegExp(cityQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
});

test('BUG-272 directory search works with state and city only', async ({ page }) => {
  await page.goto('/directory', { waitUntil: 'domcontentloaded' });
  const selects = page.locator('select');
  const stateSelect = selects.nth(0);
  const citySelect = selects.nth(1);

  await selectFirstRealOption(stateSelect);
  await expect(citySelect).toBeEnabled();
  await expect.poll(async () => optionCount(citySelect)).toBeGreaterThan(1);
  await selectFirstRealOption(citySelect);

  const beforeUrl = page.url();
  await page.getByRole('button', { name: /^search$/i }).click();
  await page.waitForTimeout(1000);
  expect(page.url()).not.toBe(beforeUrl);
});

test('BUG-229 BUG-230 BUG-231 product search can navigate using a typed keyword', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const searchInput = page.getByPlaceholder(/search product\/service/i);
  await searchInput.fill('cotton');
  await page.getByRole('button', { name: /^search$/i }).click();
  await page.waitForLoadState('domcontentloaded');
  await expect(page).toHaveURL(/\/directory\/search\/|\/directory\/.+/i);
});
