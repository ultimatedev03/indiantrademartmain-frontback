import { test, expect } from '@playwright/test';
import { getStoredStatePath, hasStoredState } from '../../utils/auth-state.mjs';

const hasAdminState = hasStoredState('admin');

test.describe('Admin portal regression', () => {
  if (hasAdminState) {
    test.use({ storageState: getStoredStatePath('admin') });
  }

  test('BUG-260 admin sidebar pages load instead of blank screens', async ({ page }) => {
    test.skip(!hasAdminState, 'Run npm run auth:admin first.');
    const pages = [
      { path: '/admin/dashboard', text: /dashboard|vendors|staff/i },
      { path: '/admin/vendors', text: /vendor|total vendors|all vendors/i },
      { path: '/admin/kyc', text: /vendor management|kyc/i },
      { path: '/admin/staff', text: /staff|employee/i },
      { path: '/admin/settings', text: /settings/i },
    ];

    for (const item of pages) {
      await page.goto(item.path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('body')).toContainText(item.text);
    }
  });

  test('BUG-250 KYC approvals do not show 01/01/1970 joined dates', async ({ page }) => {
    test.skip(!hasAdminState, 'Run npm run auth:admin first.');
    await page.goto('/admin/kyc', { waitUntil: 'domcontentloaded' });
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('01/01/1970');
  });
});

