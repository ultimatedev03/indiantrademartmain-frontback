import fs from 'node:fs';
import { getPortalConfig, storageStatePath } from './portals.mjs';

export const getStoredStatePath = (role) => storageStatePath(role);

export const hasStoredState = (role) => fs.existsSync(getStoredStatePath(role));

export const getCredentialPair = (role) => {
  const config = getPortalConfig(role);
  if (!config) return { email: '', password: '', missing: ['portal'] };

  const email = String(process.env[config.emailEnv] || '').trim();
  const password = String(process.env[config.passwordEnv] || '').trim();
  const missing = [];

  if (!email) missing.push(config.emailEnv);
  if (!password) missing.push(config.passwordEnv);

  return { email, password, missing };
};

