import { test, expect } from '@playwright/test';
import { getStoredStatePath, hasStoredState } from '../../utils/auth-state.mjs';

const hasVendorState = hasStoredState('vendor');

test.describe('Vendor portal regression', () => {
  if (hasVendorState) {
    test.use({ storageState: getStoredStatePath('vendor') });
  }

  test('BUG-258 notification icon opens notifications instead of a blank page', async ({ page }) => {
    test.skip(!hasVendorState, 'Run npm run auth:vendor first.');
    await page.goto('/vendor/dashboard', { waitUntil: 'domcontentloaded' });
    const notificationButton = page.getByRole('button', { name: /notifications/i });
    await notificationButton.click();
    await expect(page.getByText(/notifications/i).first()).toBeVisible();
  });

  test('BUG-261 BUG-265 Add Product routes open the product form', async ({ page }) => {
    test.skip(!hasVendorState, 'Run npm run auth:vendor first.');
    await page.goto('/vendor/dashboard', { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: /add new product/i }).click();
    await expect(page).toHaveURL(/\/vendor\/products\/add/i);
  });

  test('BUG-264 product edit route is reachable from Products page when an edit action exists', async ({ page }) => {
    test.skip(!hasVendorState, 'Run npm run auth:vendor first.');
    await page.goto('/vendor/products', { waitUntil: 'domcontentloaded' });
    const editLink = page.getByRole('link', { name: /edit/i }).first();
    const editCount = await editLink.count();
    test.skip(editCount === 0, 'No vendor products available for this account.');
    await editLink.click();
    await expect(page).toHaveURL(/\/vendor\/products\/.+\/edit/i);
  });

  test('BUG-283 add product image helper shows the 50KB to 1MB range', async ({ page }) => {
    test.skip(!hasVendorState, 'Run npm run auth:vendor first.');
    await page.goto('/vendor/products/add', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toContainText(/allowed image size:\s*50KB to 1MB/i);
  });

  test('BUG-268 BUG-269 subscription modal opens with visible actions', async ({ page }) => {
    test.skip(!hasVendorState, 'Run npm run auth:vendor first.');
    await page.goto('/vendor/subscriptions', { waitUntil: 'domcontentloaded' });
    const detailsButton = page.getByRole('button', { name: /view full details|current plan|proceed to pay|active plan/i }).first();
    await expect(detailsButton).toBeVisible();
    await detailsButton.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('button', { name: /cancel|proceed|active plan|apply & proceed/i }).first()).toBeVisible();
  });
});
