/**
 * Server entrypoint — imports the reusable Express app and starts listening.
 *
 * All middleware, route mounting, and security configuration lives in
 * `./app.js`. This file is responsible only for:
 *  1. Importing the configured app
 *  2. Running startup side-effects (cron jobs, dev bootstrap)
 *  3. Calling listen()
 */

import app from './app.js';
import runtimeConfig from './lib/runtimeConfig.js';
import { initializeSubscriptionCronJobs } from './lib/subscriptionCronJobs.js';
import { ensureDevAdmin } from './lib/devBootstrap.js';

// Initialize subscription monitoring cron jobs
initializeSubscriptionCronJobs();

// Dev-only admin bootstrap (set DEV_ADMIN_EMAIL + DEV_ADMIN_PASSWORD)
ensureDevAdmin().catch((err) => {
  console.warn('[DevBootstrap] Failed:', err?.message || err);
});

// Start server
const PORT = runtimeConfig.port;

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
  console.log(`Environment: ${runtimeConfig.nodeEnv}`);
  if (runtimeConfig.gmailEmail) {
    console.log(`Mailer: ${runtimeConfig.gmailEmail}`);
  }
});
