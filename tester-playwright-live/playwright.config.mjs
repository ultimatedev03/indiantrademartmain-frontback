import { defineConfig, devices } from '@playwright/test';
import { env } from './utils/env.mjs';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: env.defaultTimeoutMs * 3,
  expect: {
    timeout: env.expectTimeoutMs,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: env.baseUrl,
    headless: env.headless,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: env.defaultTimeoutMs,
    navigationTimeout: env.defaultTimeoutMs,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
