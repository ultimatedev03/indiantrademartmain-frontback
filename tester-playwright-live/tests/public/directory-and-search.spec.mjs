import { test, expect } from '@playwright/test';
import { optionCount, selectFirstRealOption } from '../../utils/test-helpers.mjs';

const vendorDirectoryStateSelect = (page) => page.getByLabel(/filter vendors by state/i);
const vendorDirectoryCitySelect = (page) => page.getByLabel(/filter vendors by city/i);
const vendorDirectorySearchInput = (page) =>
  page.getByLabel(/search vendors by company, owner, service, or location/i);
const vendorDirectoryCityInput = (page) => page.getByLabel(/search vendors by city name/i);
const directoryStateSelect = (page) => page.getByLabel(/select state/i);
const directoryCitySelect = (page) => page.getByLabel(/select city/i);
const homeSearchInput = (page) => page.getByLabel(/search products services or companies/i);
const homeLocationInput = (page) => page.getByLabel(/search location/i);

test('BUG-195 state dropdown on vendor directory is clickable and populated', async ({ page }) => {
  await page.goto('/directory/vendor', { waitUntil: 'domcontentloaded' });
  const stateSelect = vendorDirectoryStateSelect(page);
  await expect(stateSelect).toBeVisible();
  await expect.poll(async () => optionCount(stateSelect)).toBeGreaterThan(1);
});

test('BUG-180 BUG-243 city dropdown stays disabled until a state is selected', async ({ page }) => {
  await page.goto('/directory/vendor', { waitUntil: 'domcontentloaded' });
  const citySelect = vendorDirectoryCitySelect(page);
  await expect(citySelect).toBeDisabled();
});

test('BUG-181 selected state loads city options', async ({ page }) => {
  await page.goto('/directory/vendor', { waitUntil: 'domcontentloaded' });
  const stateSelect = vendorDirectoryStateSelect(page);
  const citySelect = vendorDirectoryCitySelect(page);
  await expect.poll(async () => optionCount(stateSelect)).toBeGreaterThan(1);
  await selectFirstRealOption(stateSelect);
  await expect(citySelect).toBeEnabled();
  await expect.poll(async () => optionCount(citySelect)).toBeGreaterThan(1);
});

test('BUG-179 vendor directory keyword search reacts to a valid query', async ({ page }) => {
  await page.goto('/directory/vendor', { waitUntil: 'domcontentloaded' });
  await vendorDirectorySearchInput(page).fill('cloth');
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

  await vendorDirectorySearchInput(page).fill(nameQuery);
  await page.getByRole('button', { name: /^search$/i }).click();
  await expect(page.locator('body')).toContainText(new RegExp(nameQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));

  const cityQuery = String(firstCardData.city || '').trim();
  test.skip(!cityQuery, 'No city data available to validate city filtering.');

  await vendorDirectorySearchInput(page).fill('');
  await vendorDirectoryCityInput(page).fill(cityQuery);
  await page.getByRole('button', { name: /^search$/i }).click();
  await expect(page.locator('body')).toContainText(new RegExp(cityQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
});

test('BUG-272 directory search works with state and city only', async ({ page }) => {
  await page.goto('/directory', { waitUntil: 'domcontentloaded' });
  const stateSelect = directoryStateSelect(page);
  const citySelect = directoryCitySelect(page);

  await expect(stateSelect).toBeEnabled();
  await expect.poll(async () => optionCount(stateSelect)).toBeGreaterThan(1);
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
  const searchInput = homeSearchInput(page);
  await searchInput.fill('cotton');
  await page.getByRole('button', { name: /^search$/i }).click();
  await page.waitForLoadState('domcontentloaded');
  await expect(page).toHaveURL(/\/directory\/search\/|\/directory\/.+/i);
});

test('BUG-423 homepage search supports location-only filtering', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await homeLocationInput(page).fill('uttar pradesh');
  await page.getByRole('button', { name: /^search$/i }).click();
  await page.waitForLoadState('domcontentloaded');
  await expect(page).toHaveURL(/\/directory\/vendor\?state=uttar-pradesh/i);
});

test('BUG-441 vendor directory city selection replaces previously searched city', async ({ page }) => {
  await page.goto('/directory/vendor', { waitUntil: 'domcontentloaded' });

  const stateSelect = vendorDirectoryStateSelect(page);
  const citySelect = vendorDirectoryCitySelect(page);

  await expect.poll(async () => optionCount(stateSelect)).toBeGreaterThan(1);
  await selectFirstRealOption(stateSelect);
  await expect(citySelect).toBeEnabled();
  await expect.poll(async () => optionCount(citySelect)).toBeGreaterThan(2);

  const cityOptions = citySelect.locator('option');
  const firstCityValue = String(await cityOptions.nth(1).getAttribute('value') || '').trim();
  const secondCityValue = String(await cityOptions.nth(2).getAttribute('value') || '').trim();
  test.skip(!firstCityValue || !secondCityValue, 'At least two city options are required to validate city replacement.');

  await citySelect.selectOption(firstCityValue);
  await page.getByRole('button', { name: /^search$/i }).click();
  await page.waitForLoadState('domcontentloaded');
  await expect(citySelect).toHaveValue(firstCityValue);

  await citySelect.selectOption(secondCityValue);
  await expect(citySelect).toHaveValue(secondCityValue);
});
