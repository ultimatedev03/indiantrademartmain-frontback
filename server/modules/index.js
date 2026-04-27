import { authRoutes } from './auth/index.js';
import { billingRoutes } from './billing/index.js';
import { directoryRoutes } from './directory/index.js';
import { engagementRoutes } from './engagement/index.js';
import { operationsRoutes } from './operations/index.js';
import { vendorRoutes } from './vendor/index.js';

export const backendModules = Object.freeze([
  { name: 'auth', routes: authRoutes },
  { name: 'directory', routes: directoryRoutes },
  { name: 'engagement', routes: engagementRoutes },
  { name: 'billing', routes: billingRoutes },
  { name: 'operations', routes: operationsRoutes },
  { name: 'vendor', routes: vendorRoutes },
]);
