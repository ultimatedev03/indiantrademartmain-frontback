import { test, expect } from '@playwright/test';

test('BUG-198 BUG-199 homepage Tell Us Your Requirement CTA opens the requirement modal', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /tell us your requirement/i }).click();
  const modalHeading = page.getByRole('heading', { name: /post your requirement/i });
  await expect(modalHeading).toBeVisible();
  const modalRoot = modalHeading.locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
  await expect(modalRoot.getByRole('button', { name: /^post requirement$/i })).toBeVisible();
});

test('BUG-127 blog route redirects to the public blog', async ({ page }) => {
  await page.goto('/blog', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await expect(page).toHaveURL(/blog\.indiantrademart\.com/i);
});

test('BUG-128 about us page contains substantive content', async ({ page }) => {
  await page.goto('/about-us', { waitUntil: 'domcontentloaded' });
  const text = await page.locator('main, body').first().innerText();
  expect(text.trim().length).toBeGreaterThan(300);
});

test('BUG-064 press page CTAs work', async ({ page }) => {
  await page.goto('/press', { waitUntil: 'domcontentloaded' });
  await page.getByRole('link', { name: /email press team/i }).click();
  await expect(page).toHaveURL(/\/contact\?/i);
});

test('BUG-065 join sales page CTA works', async ({ page }) => {
  await page.goto('/join-sales', { waitUntil: 'domcontentloaded' });
  await page.getByRole('link', { name: /view current openings/i }).click();
  await expect(page).toHaveURL(/\/career#career-openings$/i);
});

test('BUG-066 BUG-075 success stories open a detail page instead of redirecting elsewhere', async ({ page }) => {
  await page.goto('/success-stories', { waitUntil: 'domcontentloaded' });
  const firstStory = page.getByRole('link', { name: /read full story/i }).first();
  await firstStory.click();
  await expect(page).toHaveURL(/\/success-stories\/.+/i);
  await expect(page).not.toHaveURL(/\/contact/i);
});

test('BUG-067 help page is populated', async ({ page }) => {
  await page.goto('/help', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/browse by topic/i)).toBeVisible();
});

test('BUG-068 customer care page CTAs are functional', async ({ page }) => {
  await page.goto('/customer-care', { waitUntil: 'domcontentloaded' });
  await page.getByRole('link', { name: /submit ticket/i }).click();
  await expect(page).toHaveURL(/\/contact\?/i);
});

test('BUG-069 buy leads page CTA is functional', async ({ page }) => {
  await page.goto('/buyleads', { waitUntil: 'domcontentloaded' });
  const cta = page.getByRole('link').filter({ hasText: /contact|learn|start|buy/i }).first();
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute('href', /.+/);
});

test('BUG-070 learning centre CTA is functional', async ({ page }) => {
  await page.goto('/learning-centre', { waitUntil: 'domcontentloaded' });
  await page.getByRole('link', { name: /enroll now/i }).first().click();
  await expect(page).toHaveURL(/\/contact\?/i);
});

test('BUG-118 Link to Us page is reachable and contains an action link', async ({ page }) => {
  await page.goto('/link-to-us', { waitUntil: 'domcontentloaded' });
  const action = page.getByRole('link').filter({ hasText: /contact|download|learn|submit|request/i }).first();
  await expect(action).toBeVisible();
  await expect(action).toHaveAttribute('href', /.+/);
});

test('BUG-200 customer care email does not overflow its card', async ({ page }) => {
  await page.goto('/customer-care', { waitUntil: 'domcontentloaded' });
  const emailLink = page.getByRole('link', { name: /support@indiantrademart\.com/i });
  await expect(emailLink).toBeVisible();
  const overflow = await emailLink.evaluate((element) => element.scrollWidth > element.clientWidth + 1);
  expect(overflow).toBeFalsy();
});

test('BUG-278 premium brands section shows the ITM brand card', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: /open itm brand page/i })).toBeVisible();
});

test('BUG-279 public header shows a Home navigation link', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('link', { name: /^home$/i })).toBeVisible();
});

test('BUG-201 BUG-240 BUG-241 BUG-242 premium brand card opens a populated matching brand page', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const brandButton = page.getByRole('button', { name: /open .* brand page/i }).first();
  const clickedName = await brandButton.getAttribute('title');
  await brandButton.evaluate((element) => element.click());
  await page.waitForLoadState('domcontentloaded');
  await expect(page).toHaveURL(/\/directory\/vendor\/.+|\/directory\/brand\/.+/i);
  await expect(page.locator('body')).toContainText(String(clickedName || '').trim().split(' ')[0]);
  const bodyText = await page.locator('body').innerText();
  expect(bodyText.trim().length).toBeGreaterThan(200);
});

test('BUG-277 premium-brand fallback page keeps the selected brand content aligned', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /open pss lab brand page/i }).evaluate((element) => element.click());
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByRole('heading', { name: /^pss lab$/i })).toBeVisible();
  await expect(page.locator('body')).toContainText(/lab testing|product evaluation|quality checks/i);
  await expect(page.locator('body')).not.toContainText(/planning and scheduling/i);
});
