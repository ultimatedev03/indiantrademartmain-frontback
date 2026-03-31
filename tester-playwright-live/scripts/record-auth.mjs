import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { env, projectRoot } from '../utils/env.mjs';
import { getCredentialPair } from '../utils/auth-state.mjs';
import { getPortalConfig, supportedPortals, storageStatePath } from '../utils/portals.mjs';

const requestedRole = String(process.argv[2] || '').trim().toLowerCase();

if (!requestedRole || !supportedPortals.includes(requestedRole)) {
  console.error(`Usage: node scripts/record-auth.mjs <${supportedPortals.join('|')}>`);
  process.exit(1);
}

const portal = getPortalConfig(requestedRole);
const creds = getCredentialPair(requestedRole);

if (creds.missing.length > 0) {
  console.error(`Missing credentials for ${portal.label}: ${creds.missing.join(', ')}`);
  process.exit(1);
}

const authDir = path.join(projectRoot, '.auth');
fs.mkdirSync(authDir, { recursive: true });

const browser = await chromium.launch({ headless: false, slowMo: 100 });
const context = await browser.newContext();
const page = await context.newPage();

try {
  const targetUrl = new URL(portal.loginPath, env.baseUrl).toString();
  console.log(`Opening ${portal.label} login: ${targetUrl}`);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const emailField = page.getByRole('textbox', { name: /work email/i }).first();
  const passwordField = page.getByRole('textbox', { name: /^password$/i }).first();

  await emailField.fill(creds.email);
  await passwordField.fill(creds.password);

  console.log('');
  console.log(`[${portal.label}] Credentials pre-filled.`);
  console.log('Complete CAPTCHA/security check manually on the browser, then submit the form.');
  console.log(`Waiting for dashboard: ${portal.dashboardPath}`);
  console.log('');

  await page.waitForURL(portal.dashboardRegex, { timeout: 0 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);

  const statePath = storageStatePath(requestedRole);
  await context.storageState({ path: statePath });
  console.log(`Saved auth state: ${statePath}`);
} finally {
  await browser.close();
}
