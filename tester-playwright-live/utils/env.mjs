import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const projectRoot = path.resolve(__dirname, '..');

for (const file of ['.env', '.env.local']) {
  const fullPath = path.join(projectRoot, file);
  if (fs.existsSync(fullPath)) {
    dotenv.config({ path: fullPath, override: file === '.env.local' });
  }
}

const toBool = (value, fallback = false) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return fallback;
  return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
};

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const env = {
  baseUrl: String(process.env.BASE_URL || 'https://indiantrademart.com').trim(),
  headless: toBool(process.env.HEADLESS, false),
  defaultTimeoutMs: toInt(process.env.DEFAULT_TIMEOUT_MS, 20000),
  expectTimeoutMs: toInt(process.env.EXPECT_TIMEOUT_MS, 10000),
  mutationEnabled: toBool(process.env.ENABLE_MUTATION_TESTS, false),
};

