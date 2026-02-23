-- Superadmin plan customization compatibility patch
-- Safe to rerun: uses IF NOT EXISTS and null-safe backfill only

ALTER TABLE public.vendor_plans
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS daily_limit integer,
  ADD COLUMN IF NOT EXISTS weekly_limit integer,
  ADD COLUMN IF NOT EXISTS yearly_limit integer,
  ADD COLUMN IF NOT EXISTS duration_days integer,
  ADD COLUMN IF NOT EXISTS is_active boolean,
  ADD COLUMN IF NOT EXISTS features jsonb;

ALTER TABLE public.vendor_plans
  ALTER COLUMN daily_limit SET DEFAULT 0,
  ALTER COLUMN weekly_limit SET DEFAULT 0,
  ALTER COLUMN yearly_limit SET DEFAULT 0,
  ALTER COLUMN duration_days SET DEFAULT 365,
  ALTER COLUMN is_active SET DEFAULT true,
  ALTER COLUMN features SET DEFAULT '{}'::jsonb;

UPDATE public.vendor_plans
SET
  daily_limit = COALESCE(daily_limit, 0),
  weekly_limit = COALESCE(weekly_limit, 0),
  yearly_limit = COALESCE(yearly_limit, 0),
  duration_days = CASE
    WHEN duration_days IS NULL OR duration_days <= 0 THEN 365
    ELSE duration_days
  END,
  is_active = COALESCE(is_active, true),
  features = COALESCE(features, '{}'::jsonb)
WHERE
  daily_limit IS NULL
  OR weekly_limit IS NULL
  OR yearly_limit IS NULL
  OR duration_days IS NULL
  OR duration_days <= 0
  OR is_active IS NULL
  OR features IS NULL;
