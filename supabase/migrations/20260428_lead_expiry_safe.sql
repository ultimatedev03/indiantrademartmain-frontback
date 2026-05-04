-- Lead expiry support (safe, additive)
-- Date: 28-Apr-2026
-- Notes:
-- - Adds an optional expires_at column for lead freshness.
-- - Backfills existing leads to expire 30 days after creation.
-- - Keeps older rows valid if created_at is missing.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

UPDATE public.leads
SET expires_at = created_at + interval '30 days'
WHERE expires_at IS NULL
  AND created_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_expires_at
  ON public.leads (expires_at);

CREATE INDEX IF NOT EXISTS idx_leads_status_expires_at
  ON public.leads (status, expires_at DESC);
