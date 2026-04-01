import { test, expect } from '@playwright/test';

const managementLinks = [
  { bug: 'BUG-215', label: 'Data Entry Login', expected: /\/employee\/login\?portal=dataentry$/i },
  { bug: 'BUG-216', label: 'Support Login', expected: /\/employee\/login\?portal=support$/i },
  { bug: 'BUG-217', label: 'Sales Login', expected: /\/employee\/login\?portal=sales$/i },
  { bug: 'BUG-274', label: 'Manager Login', expected: /\/employee\/login\?portal=manager$/i },
  { bug: 'BUG-275', label: 'VP Login', expected: /\/employee\/login\?portal=vp$/i },
];

for (const item of managementLinks) {
  test(`${item.bug} management role card routes correctly`, async ({ page }) => {
    await page.goto('/management', { waitUntil: 'domcontentloaded' });
    await page.hover(`text=${item.label}`);
    await page.getByRole('link', { name: item.label }).click();
    await expect(page).toHaveURL(item.expected);
  });
}

const portalPages = [
  { bug: 'BUG-274', path: '/employee/login?portal=manager', heading: /manager portal/i },
  { bug: 'BUG-275', path: '/employee/login?portal=vp', heading: /vp portal/i },
  { bug: 'BUG-276', path: '/employee/login?portal=sales', heading: /sales portal/i },
];

for (const item of portalPages) {
  test(`${item.bug} login page is reachable`, async ({ page }) => {
    await page.goto(item.path, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: item.heading })).toBeVisible();
  });
}

const backHomePages = [
  { bugs: ['BUG-078', 'BUG-090'], path: '/admin/login' },
  { bugs: ['BUG-090'], path: '/hr/login' },
  { bugs: ['BUG-090'], path: '/finance-portal/login' },
  { bugs: ['BUG-095'], path: '/employee/login?portal=support' },
  { bugs: ['BUG-037'], path: '/buyer/login' },
];

for (const item of backHomePages) {
  test(`${item.bugs.join(' ')} ${item.path} shows Back to Home`, async ({ page }) => {
    await page.goto(item.path, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('link', { name: /back to home/i })).toBeVisible();
  });
}

const passwordTogglePages = [
  { bugs: ['BUG-040', 'BUG-048'], path: '/admin/login' },
  { bugs: ['BUG-228'], path: '/hr/login' },
  { bugs: ['BUG-040'], path: '/employee/login?portal=sales' },
];

for (const item of passwordTogglePages) {
  test(`${item.bugs.join(' ')} ${item.path} exposes a single password visibility control`, async ({ page }) => {
    await page.goto(item.path, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /show password|hide password/i })).toHaveCount(1);
  });
}
