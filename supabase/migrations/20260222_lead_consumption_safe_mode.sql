-- Lead consumption safe-mode upgrade
-- Date: 22-Feb-2026
-- Goals:
-- 1) Keep lead_purchases backward-compatible while adding richer metadata.
-- 2) Enforce idempotency (one vendor can consume one lead once).
-- 3) Provide transaction-safe lead consumption with row locking.

-- ---------------------------------------------------------------------------
-- 1) lead_purchases compatibility columns (safe to rerun)
-- ---------------------------------------------------------------------------
ALTER TABLE public.lead_purchases
  ADD COLUMN IF NOT EXISTS consumption_type text,
  ADD COLUMN IF NOT EXISTS purchase_price numeric,
  ADD COLUMN IF NOT EXISTS purchase_datetime timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_plan_name text,
  ADD COLUMN IF NOT EXISTS lead_status text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.lead_purchases
  ALTER COLUMN consumption_type SET DEFAULT 'PAID_EXTRA';

ALTER TABLE public.lead_purchases
  ALTER COLUMN lead_status SET DEFAULT 'ACTIVE';

UPDATE public.lead_purchases
SET purchase_price = COALESCE(purchase_price, amount, 0)
WHERE purchase_price IS NULL;

UPDATE public.lead_purchases
SET purchase_datetime = COALESCE(purchase_datetime, purchase_date, now())
WHERE purchase_datetime IS NULL;

UPDATE public.lead_purchases
SET lead_status = CASE
  WHEN UPPER(COALESCE(TRIM(lead_status), '')) IN ('ACTIVE', 'VIEWED', 'CLOSED')
    THEN UPPER(TRIM(lead_status))
  ELSE 'ACTIVE'
END
WHERE COALESCE(TRIM(lead_status), '') = ''
   OR UPPER(COALESCE(TRIM(lead_status), '')) NOT IN ('ACTIVE', 'VIEWED', 'CLOSED')
   OR lead_status <> UPPER(COALESCE(TRIM(lead_status), ''));

UPDATE public.lead_purchases
SET consumption_type = CASE
  WHEN UPPER(COALESCE(TRIM(consumption_type), '')) IN ('DAILY_INCLUDED', 'WEEKLY_INCLUDED', 'PAID_EXTRA')
    THEN UPPER(TRIM(consumption_type))
  WHEN COALESCE(amount, 0) > 0
    THEN 'PAID_EXTRA'
  ELSE 'DAILY_INCLUDED'
END
WHERE COALESCE(TRIM(consumption_type), '') = ''
   OR UPPER(COALESCE(TRIM(consumption_type), '')) NOT IN ('DAILY_INCLUDED', 'WEEKLY_INCLUDED', 'PAID_EXTRA')
   OR (
        UPPER(COALESCE(TRIM(consumption_type), '')) IN ('DAILY_INCLUDED', 'WEEKLY_INCLUDED', 'PAID_EXTRA')
        AND consumption_type <> UPPER(TRIM(consumption_type))
      );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lead_purchases_consumption_type_check'
      AND conrelid = 'public.lead_purchases'::regclass
  ) THEN
    ALTER TABLE public.lead_purchases
      ADD CONSTRAINT lead_purchases_consumption_type_check
      CHECK (consumption_type IN ('DAILY_INCLUDED', 'WEEKLY_INCLUDED', 'PAID_EXTRA'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lead_purchases_lead_status_check'
      AND conrelid = 'public.lead_purchases'::regclass
  ) THEN
    ALTER TABLE public.lead_purchases
      ADD CONSTRAINT lead_purchases_lead_status_check
      CHECK (lead_status IN ('ACTIVE', 'VIEWED', 'CLOSED'));
  END IF;
END
$$;

-- Keep only latest row for duplicate (vendor_id, lead_id) pairs.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY vendor_id, lead_id
      ORDER BY COALESCE(purchase_datetime, purchase_date, now()) DESC, id DESC
    ) AS rn
  FROM public.lead_purchases
  WHERE vendor_id IS NOT NULL AND lead_id IS NOT NULL
)
DELETE FROM public.lead_purchases p
USING ranked r
WHERE p.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_purchases_vendor_lead_unique
  ON public.lead_purchases(vendor_id, lead_id);

CREATE INDEX IF NOT EXISTS idx_lead_purchases_vendor_purchase_datetime
  ON public.lead_purchases(vendor_id, purchase_datetime DESC);

CREATE INDEX IF NOT EXISTS idx_lead_purchases_lead_id
  ON public.lead_purchases(lead_id);

-- ---------------------------------------------------------------------------
-- 2) Transaction-safe lead consumption function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_vendor_lead(
  p_vendor_id uuid,
  p_lead_id uuid,
  p_mode text DEFAULT 'AUTO',
  p_purchase_price numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_today_start timestamptz := date_trunc('day', now());
  v_week_start timestamptz := date_trunc('week', now());
  v_mode text := UPPER(COALESCE(NULLIF(TRIM(p_mode), ''), 'AUTO'));

  v_lead record;
  v_subscription record;
  v_quota record;
  v_existing record;
  v_purchase record;

  v_daily_limit integer := 0;
  v_weekly_limit integer := 0;
  v_yearly_limit integer := 0;

  v_daily_used integer := 0;
  v_weekly_used integer := 0;
  v_yearly_used integer := 0;

  v_daily_remaining integer := 0;
  v_weekly_remaining integer := 0;
  v_yearly_remaining integer := 0;

  v_consumption_type text := NULL;
  v_purchase_price numeric := 0;
  v_lead_purchase_count integer := 0;
BEGIN
  IF p_vendor_id IS NULL OR p_lead_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_INPUT',
      'error', 'vendor_id and lead_id are required'
    );
  END IF;

  -- Lock lead row so concurrent consumption attempts serialize per lead.
  SELECT *
  INTO v_lead
  FROM public.leads
  WHERE id = p_lead_id
  FOR UPDATE;

  IF v_lead IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'LEAD_NOT_FOUND',
      'error', 'Lead not found'
    );
  END IF;

  IF COALESCE(UPPER(TRIM(v_lead.status)), '') NOT IN ('', 'AVAILABLE', 'PURCHASED') THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'LEAD_UNAVAILABLE',
      'error', 'Lead no longer available'
    );
  END IF;

  IF v_lead.vendor_id IS NOT NULL AND v_lead.vendor_id <> p_vendor_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'LEAD_NOT_PURCHASABLE',
      'error', 'This lead is not purchasable'
    );
  END IF;

  -- Active + non-expired subscription is mandatory for all consumption types.
  SELECT
    s.id,
    s.plan_id,
    s.start_date,
    s.end_date,
    s.status,
    vp.name AS plan_name,
    COALESCE(vp.daily_limit, 0)::integer AS daily_limit,
    COALESCE(vp.weekly_limit, 0)::integer AS weekly_limit,
    COALESCE(vp.yearly_limit, 0)::integer AS yearly_limit
  INTO v_subscription
  FROM public.vendor_plan_subscriptions s
  LEFT JOIN public.vendor_plans vp ON vp.id = s.plan_id
  WHERE s.vendor_id = p_vendor_id
    AND UPPER(COALESCE(TRIM(s.status), '')) = 'ACTIVE'
    AND (s.end_date IS NULL OR s.end_date > v_now)
  ORDER BY COALESCE(s.end_date, 'infinity'::timestamptz) DESC, COALESCE(s.start_date, v_now) DESC, s.id DESC
  LIMIT 1
  FOR UPDATE OF s;

  IF v_subscription IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'SUBSCRIPTION_INACTIVE',
      'error', 'No active subscription plan',
      'moved_to_my_leads', false
    );
  END IF;

  v_daily_limit := GREATEST(COALESCE(v_subscription.daily_limit, 0), 0);
  v_weekly_limit := GREATEST(COALESCE(v_subscription.weekly_limit, 0), 0);
  v_yearly_limit := GREATEST(COALESCE(v_subscription.yearly_limit, 0), 0);

  -- Lock quota row (create if missing) and reset rolling counters.
  SELECT *
  INTO v_quota
  FROM public.vendor_lead_quota
  WHERE vendor_id = p_vendor_id
  FOR UPDATE;

  IF v_quota IS NULL THEN
    INSERT INTO public.vendor_lead_quota (
      vendor_id,
      plan_id,
      daily_used,
      weekly_used,
      yearly_used,
      daily_limit,
      weekly_limit,
      yearly_limit,
      daily_reset_at,
      weekly_reset_at,
      updated_at
    )
    VALUES (
      p_vendor_id,
      v_subscription.plan_id,
      0,
      0,
      0,
      v_daily_limit,
      v_weekly_limit,
      v_yearly_limit,
      v_today_start,
      v_week_start,
      v_now
    )
    RETURNING *
    INTO v_quota;
  END IF;

  v_daily_used := GREATEST(COALESCE(v_quota.daily_used, 0), 0);
  v_weekly_used := GREATEST(COALESCE(v_quota.weekly_used, 0), 0);
  v_yearly_used := GREATEST(COALESCE(v_quota.yearly_used, 0), 0);

  IF v_quota.daily_reset_at IS NULL OR v_quota.daily_reset_at < v_today_start THEN
    v_daily_used := 0;
  END IF;

  IF v_quota.weekly_reset_at IS NULL OR v_quota.weekly_reset_at < v_week_start THEN
    v_weekly_used := 0;
  END IF;

  -- Keep quota synchronized with current subscription limits.
  UPDATE public.vendor_lead_quota
  SET
    plan_id = v_subscription.plan_id,
    daily_limit = v_daily_limit,
    weekly_limit = v_weekly_limit,
    yearly_limit = v_yearly_limit,
    daily_used = v_daily_used,
    weekly_used = v_weekly_used,
    yearly_used = v_yearly_used,
    daily_reset_at = v_today_start,
    weekly_reset_at = v_week_start,
    updated_at = v_now
  WHERE vendor_id = p_vendor_id;

  v_daily_remaining := GREATEST(v_daily_limit - v_daily_used, 0);
  v_weekly_remaining := GREATEST(v_weekly_limit - v_weekly_used, 0);
  v_yearly_remaining := GREATEST(v_yearly_limit - v_yearly_used, 0);

  -- Idempotency guard: already consumed by this vendor.
  SELECT *
  INTO v_existing
  FROM public.lead_purchases
  WHERE vendor_id = p_vendor_id
    AND lead_id = p_lead_id
  ORDER BY COALESCE(purchase_datetime, purchase_date, v_now) DESC, id DESC
  LIMIT 1
  FOR UPDATE;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'existing_purchase', true,
      'consumption_type', COALESCE(v_existing.consumption_type, 'PAID_EXTRA'),
      'remaining', jsonb_build_object(
        'daily', v_daily_remaining,
        'weekly', v_weekly_remaining,
        'yearly', v_yearly_remaining
      ),
      'moved_to_my_leads', true,
      'purchase_datetime', COALESCE(v_existing.purchase_datetime, v_existing.purchase_date, v_now),
      'plan_name', COALESCE(v_existing.subscription_plan_name, v_subscription.plan_name),
      'subscription_plan_name', COALESCE(v_existing.subscription_plan_name, v_subscription.plan_name),
      'lead_status', COALESCE(v_existing.lead_status, 'ACTIVE'),
      'purchase', to_jsonb(v_existing)
    );
  END IF;

  -- Max 5 vendors per marketplace lead.
  SELECT COUNT(*)
  INTO v_lead_purchase_count
  FROM public.lead_purchases
  WHERE lead_id = p_lead_id;

  IF v_lead_purchase_count >= 5 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'LEAD_CAP_REACHED',
      'error', 'This lead has reached maximum 5 vendors limit'
    );
  END IF;

  -- Consumption decision engine.
  IF v_yearly_remaining <= 0 THEN
    IF v_mode IN ('BUY_EXTRA', 'PAID') THEN
      v_consumption_type := 'PAID_EXTRA';
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'code', 'PAID_REQUIRED',
        'error', 'Yearly included quota exhausted. Paid consumption required.',
        'remaining', jsonb_build_object(
          'daily', v_daily_remaining,
          'weekly', v_weekly_remaining,
          'yearly', v_yearly_remaining
        ),
        'subscription_plan_name', COALESCE(v_subscription.plan_name, ''),
        'moved_to_my_leads', false
      );
    END IF;
  ELSIF v_daily_remaining > 0 THEN
    IF v_mode IN ('BUY_EXTRA', 'PAID') THEN
      v_consumption_type := 'PAID_EXTRA';
    ELSE
      v_consumption_type := 'DAILY_INCLUDED';
    END IF;
  ELSIF v_weekly_remaining > 0 THEN
    IF v_mode IN ('BUY_EXTRA', 'PAID') THEN
      v_consumption_type := 'PAID_EXTRA';
    ELSE
      -- AUTO behaves like USE_WEEKLY for backward compatibility.
      v_consumption_type := 'WEEKLY_INCLUDED';
    END IF;
  ELSE
    IF v_mode IN ('BUY_EXTRA', 'PAID') THEN
      v_consumption_type := 'PAID_EXTRA';
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'code', 'PAID_REQUIRED',
        'error', 'Included quota exhausted. Paid consumption required.',
        'remaining', jsonb_build_object(
          'daily', v_daily_remaining,
          'weekly', v_weekly_remaining,
          'yearly', v_yearly_remaining
        ),
        'subscription_plan_name', COALESCE(v_subscription.plan_name, ''),
        'moved_to_my_leads', false
      );
    END IF;
  END IF;

  v_purchase_price := GREATEST(COALESCE(p_purchase_price, 0), 0);
  IF v_consumption_type <> 'PAID_EXTRA' THEN
    v_purchase_price := 0;
  END IF;

  INSERT INTO public.lead_purchases (
    vendor_id,
    lead_id,
    amount,
    payment_status,
    purchase_date,
    consumption_type,
    purchase_price,
    purchase_datetime,
    subscription_plan_name,
    lead_status,
    updated_at
  )
  VALUES (
    p_vendor_id,
    p_lead_id,
    v_purchase_price,
    'COMPLETED',
    v_now,
    v_consumption_type,
    v_purchase_price,
    v_now,
    COALESCE(v_subscription.plan_name, ''),
    'ACTIVE',
    v_now
  )
  RETURNING *
  INTO v_purchase;

  -- Included counters only; paid does not consume included slots.
  IF v_consumption_type = 'DAILY_INCLUDED' THEN
    v_daily_used := v_daily_used + 1;
    v_weekly_used := v_weekly_used + 1;
    v_yearly_used := v_yearly_used + 1;
  ELSIF v_consumption_type = 'WEEKLY_INCLUDED' THEN
    v_weekly_used := v_weekly_used + 1;
    v_yearly_used := v_yearly_used + 1;
  END IF;

  UPDATE public.vendor_lead_quota
  SET
    plan_id = v_subscription.plan_id,
    daily_limit = v_daily_limit,
    weekly_limit = v_weekly_limit,
    yearly_limit = v_yearly_limit,
    daily_used = v_daily_used,
    weekly_used = v_weekly_used,
    yearly_used = v_yearly_used,
    daily_reset_at = v_today_start,
    weekly_reset_at = v_week_start,
    updated_at = v_now
  WHERE vendor_id = p_vendor_id;

  UPDATE public.leads
  SET status = 'PURCHASED'
  WHERE id = p_lead_id
    AND COALESCE(UPPER(TRIM(status)), '') <> 'PURCHASED';

  v_daily_remaining := GREATEST(v_daily_limit - v_daily_used, 0);
  v_weekly_remaining := GREATEST(v_weekly_limit - v_weekly_used, 0);
  v_yearly_remaining := GREATEST(v_yearly_limit - v_yearly_used, 0);

  RETURN jsonb_build_object(
    'success', true,
    'existing_purchase', false,
    'consumption_type', v_consumption_type,
    'remaining', jsonb_build_object(
      'daily', v_daily_remaining,
      'weekly', v_weekly_remaining,
      'yearly', v_yearly_remaining
    ),
    'moved_to_my_leads', true,
    'purchase_datetime', v_now,
    'plan_name', COALESCE(v_subscription.plan_name, ''),
    'subscription_plan_name', COALESCE(v_subscription.plan_name, ''),
    'lead_status', 'ACTIVE',
    'purchase', to_jsonb(v_purchase)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_vendor_lead(uuid, uuid, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_vendor_lead(uuid, uuid, text, numeric) TO service_role;
