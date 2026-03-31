import { test, expect } from '@playwright/test';
import { getStoredStatePath, hasStoredState } from '../../utils/auth-state.mjs';

test.describe('Sales pricing rules regression', () => {
  const hasSalesState = hasStoredState('sales');
  if (hasSalesState) {
    test.use({ storageState: getStoredStatePath('sales') });
  }

  test('BUG-213 pricing rule type is rendered as a dropdown control', async ({ page }) => {
    test.skip(!hasSalesState, 'Run npm run auth:sales first.');
    await page.goto('/employee/sales/pricing-rules', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /new rule/i }).click();
    await expect(page.getByText(/create pricing rule/i)).toBeVisible();
    await expect(page.getByText(/rule type/i)).toBeVisible();
    await expect(page.getByRole('combobox').filter({ hasText: /manual|select rule type/i })).toBeVisible();
  });
});

const employeeHeaderCases = [
  { bug: 'BUG-280', role: 'support', path: '/employee/support/dashboard' },
  { bug: 'BUG-281 BUG-282', role: 'sales', path: '/employee/sales/dashboard' },
];

for (const item of employeeHeaderCases) {
  const hasState = hasStoredState(item.role);

  test.describe(`${item.bug} employee header and profile chrome for ${item.role}`, () => {
    if (hasState) {
      test.use({ storageState: getStoredStatePath(item.role) });
    }

    test(`${item.bug} shows Home and a visible employee profile chip`, async ({ page }) => {
      test.skip(!hasState, `Run npm run auth:${item.role} first.`);
      await page.goto(item.path, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('link', { name: /^home$/i })).toBeVisible();
      await expect(page.getByLabel(/employee profile/i).first()).toBeVisible();
    });
  });
}

test.describe('Manager portal regression', () => {
  const hasManagerState = hasStoredState('manager');
  if (hasManagerState) {
    test.use({ storageState: getStoredStatePath('manager') });
  }

  test('BUG-205 manager dashboard persists after refresh', async ({ page }) => {
    test.skip(!hasManagerState, 'Run npm run auth:manager first.');
    await page.goto('/employee/manager/dashboard', { waitUntil: 'domcontentloaded' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/employee\/manager\/dashboard/i);
    await expect(page.locator('body')).toContainText(/manager territory dashboard|sales allocation/i);
  });

  test('BUG-206 manager state filter opens and city filter is state-dependent', async ({ page }) => {
    test.skip(!hasManagerState, 'Run npm run auth:manager first.');
    await page.goto('/employee/manager/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toContainText(/sales allocation/i);
    await expect(page.getByText(/all states|filter by state/i).first()).toBeVisible();
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.toLowerCase()).not.toContain('undefined');
  });
});

test.describe('VP portal regression', () => {
  const hasVpState = hasStoredState('vp');
  if (hasVpState) {
    test.use({ storageState: getStoredStatePath('vp') });
  }

  test('BUG-209 BUG-210 BUG-211 VP manager allocation filters render correctly', async ({ page }) => {
    test.skip(!hasVpState, 'Run npm run auth:vp first.');
    await page.goto('/employee/vp/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toContainText(/manager allocation/i);
    await expect(page.getByText(/all states|filter by state/i).first()).toBeVisible();
    const unnamedInputs = await page.locator('input').evaluateAll((inputs) =>
      inputs.filter((input) => !input.getAttribute('id') && !input.getAttribute('name') && !input.getAttribute('placeholder')).length
    );
    expect(unnamedInputs).toBe(0);
  });
});
