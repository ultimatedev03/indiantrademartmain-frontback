import { createClient } from '@supabase/supabase-js';
import { setDefaultResultOrder } from 'dns';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '..', '.env.local');

dotenv.config({ path: envPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service role key for admin access
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials in .env.local');
}

try {
  // Networks with unstable IPv6 often cause intermittent fetch/TLS failures.
  setDefaultResultOrder('ipv4first');
} catch {
  // Ignore when not supported by current runtime.
}

const RETRYABLE_HTTP_STATUS = new Set([
  408, 425, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 530,
]);

const MAX_FETCH_RETRIES = Math.max(1, Number(process.env.SUPABASE_FETCH_RETRIES || 3));
const FETCH_RETRY_DELAY_MS = Math.max(
  50,
  Number(process.env.SUPABASE_FETCH_RETRY_DELAY_MS || 250)
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableNetworkError = (error) => {
  const message = String(error?.message || error || '').toLowerCase();
  const code = String(error?.code || error?.cause?.code || '').toUpperCase();
  if (['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND', 'ECONNREFUSED'].includes(code)) {
    return true;
  }
  return (
    message.includes('fetch failed') ||
    message.includes('socket hang up') ||
    message.includes('network error') ||
    message.includes('tls') ||
    message.includes('ssl') ||
    message.includes('handshake')
  );
};

const resilientFetch = async (input, init) => {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_FETCH_RETRIES; attempt += 1) {
    try {
      const response = await fetch(input, init);
      if (!RETRYABLE_HTTP_STATUS.has(response.status) || attempt >= MAX_FETCH_RETRIES) {
        return response;
      }
      try {
        response.body?.cancel?.();
      } catch {
        // no-op
      }
    } catch (error) {
      lastError = error;
      if (!isRetryableNetworkError(error) || attempt >= MAX_FETCH_RETRIES) {
        throw error;
      }
    }

    await sleep(FETCH_RETRY_DELAY_MS * attempt);
  }

  throw lastError || new Error('Supabase fetch failed');
};

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  global: {
    fetch: resilientFetch,
  },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

// Optional anon client (used only for temporary auth verification during migration)
export const supabaseAnon = supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        fetch: resilientFetch,
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  : null;
