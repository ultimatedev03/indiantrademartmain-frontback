import path from 'node:path';
import { projectRoot } from './env.mjs';

export const portalConfigs = {
  buyer: {
    label: 'Buyer',
    loginPath: '/buyer/login',
    dashboardPath: '/buyer/dashboard',
    dashboardRegex: /\/buyer\/dashboard(?:[/?#]|$)/,
    emailEnv: 'BUYER_EMAIL',
    passwordEnv: 'BUYER_PASSWORD',
  },
  vendor: {
    label: 'Vendor',
    loginPath: '/vendor/login',
    dashboardPath: '/vendor/dashboard',
    dashboardRegex: /\/vendor\/(?:[^/]+\/)?dashboard(?:[/?#]|$)/,
    emailEnv: 'VENDOR_EMAIL',
    passwordEnv: 'VENDOR_PASSWORD',
  },
  admin: {
    label: 'Admin',
    loginPath: '/admin/login',
    dashboardPath: '/admin/dashboard',
    dashboardRegex: /\/admin\/dashboard(?:[/?#]|$)/,
    emailEnv: 'ADMIN_EMAIL',
    passwordEnv: 'ADMIN_PASSWORD',
  },
  hr: {
    label: 'HR',
    loginPath: '/hr/login',
    dashboardPath: '/hr/dashboard',
    dashboardRegex: /\/hr\/dashboard(?:[/?#]|$)/,
    emailEnv: 'HR_EMAIL',
    passwordEnv: 'HR_PASSWORD',
  },
  finance: {
    label: 'Finance',
    loginPath: '/finance-portal/login',
    dashboardPath: '/finance-portal/dashboard',
    dashboardRegex: /\/finance-portal\/dashboard(?:[/?#]|$)/,
    emailEnv: 'FINANCE_EMAIL',
    passwordEnv: 'FINANCE_PASSWORD',
  },
  dataentry: {
    label: 'Data Entry',
    loginPath: '/employee/login?portal=dataentry',
    dashboardPath: '/employee/dataentry/dashboard',
    dashboardRegex: /\/employee\/dataentry\/dashboard(?:[/?#]|$)/,
    emailEnv: 'DATAENTRY_EMAIL',
    passwordEnv: 'DATAENTRY_PASSWORD',
  },
  support: {
    label: 'Support',
    loginPath: '/employee/login?portal=support',
    dashboardPath: '/employee/support/dashboard',
    dashboardRegex: /\/employee\/support\/dashboard(?:[/?#]|$)/,
    emailEnv: 'SUPPORT_EMAIL',
    passwordEnv: 'SUPPORT_PASSWORD',
  },
  sales: {
    label: 'Sales',
    loginPath: '/employee/login?portal=sales',
    dashboardPath: '/employee/sales/dashboard',
    dashboardRegex: /\/employee\/sales\/dashboard(?:[/?#]|$)/,
    emailEnv: 'SALES_EMAIL',
    passwordEnv: 'SALES_PASSWORD',
  },
  manager: {
    label: 'Manager',
    loginPath: '/employee/login?portal=manager',
    dashboardPath: '/employee/manager/dashboard',
    dashboardRegex: /\/employee\/manager\/dashboard(?:[/?#]|$)/,
    emailEnv: 'MANAGER_EMAIL',
    passwordEnv: 'MANAGER_PASSWORD',
  },
  vp: {
    label: 'VP',
    loginPath: '/employee/login?portal=vp',
    dashboardPath: '/employee/vp/dashboard',
    dashboardRegex: /\/employee\/vp\/dashboard(?:[/?#]|$)/,
    emailEnv: 'VP_EMAIL',
    passwordEnv: 'VP_PASSWORD',
  },
};

export const supportedPortals = Object.keys(portalConfigs);

export const getPortalConfig = (role) => {
  const normalizedRole = String(role || '').trim().toLowerCase();
  return portalConfigs[normalizedRole] || null;
};

export const storageStatePath = (role) =>
  path.join(projectRoot, '.auth', `${String(role || '').trim().toLowerCase()}.json`);
