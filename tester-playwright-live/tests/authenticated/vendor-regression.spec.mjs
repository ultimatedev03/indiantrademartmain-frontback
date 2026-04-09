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
    await expect(page.locator('body')).toContainText(/subscription plans/i);
    await expect(page.getByText(/^current plan$/i).first()).toBeVisible();
    expect(await page.getByRole('button', { name: /active plan/i }).count()).toBe(0);

    const planCard = page.locator('div[role="button"]').filter({ hasText: /tap card to view full details/i }).first();
    await expect(planCard).toBeVisible();
    await planCard.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/payable now/i)).toBeVisible();
    await expect(dialog.getByRole('button', { name: /^close$/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /cancel/i })).toHaveCount(0);
  });

  test('BUG-163 vendor KYC shortcut opens the KYC documents tab', async ({ page }) => {
    test.skip(!hasVendorState, 'Run npm run auth:vendor first.');
    await page.goto('/vendor/kyc', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/vendor\/profile\?tab=kyc/i);
    await expect(page.locator('body')).toContainText(/KYC Documents/i);
    await expect(page.locator('body')).toContainText(/GST Certificate/i);
  });
});
