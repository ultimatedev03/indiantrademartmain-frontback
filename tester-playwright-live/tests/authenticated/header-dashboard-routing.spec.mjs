import { test, expect } from '@playwright/test';
import { hasStoredState, getStoredStatePath } from '../../utils/auth-state.mjs';
import { portalConfigs } from '../../utils/portals.mjs';

const roleCases = [
  { bug: 'BUG-232', role: 'hr' },
  { bug: 'BUG-233', role: 'support' },
  { bug: 'BUG-234', role: 'sales' },
  { bug: 'BUG-235', role: 'vp' },
  { bug: 'BUG-236', role: 'manager' },
  { bug: 'BUG-237', role: 'hr' },
  { bug: 'BUG-238', role: 'finance' },
];

for (const roleCase of roleCases) {
  const config = portalConfigs[roleCase.role];
  const hasState = hasStoredState(roleCase.role);

  test.describe(`${roleCase.bug} header dashboard routing for ${config.label}`, () => {
    if (hasState) {
      test.use({ storageState: getStoredStatePath(roleCase.role) });
    }

    test(`${roleCase.bug} opens ${config.dashboardPath} from the public header`, async ({ page }) => {
      test.skip(!hasState, `Run npm run auth:${roleCase.role} first.`);
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.getByRole('link', { name: /^dashboard$/i }).click();
      await expect(page).toHaveURL(config.dashboardRegex);
    });
  });
}

