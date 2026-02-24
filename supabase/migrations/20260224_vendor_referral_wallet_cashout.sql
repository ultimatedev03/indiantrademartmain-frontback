-- Vendor referral + wallet + cashout infrastructure
-- Safe to rerun.

BEGIN;

-- 1) Global referral program settings (single row)
CREATE TABLE IF NOT EXISTS public.referral_program_settings (
  config_key text PRIMARY KEY DEFAULT 'GLOBAL',
  is_enabled boolean NOT NULL DEFAULT false,
  first_paid_plan_only boolean NOT NULL DEFAULT true,
  allow_coupon_stack boolean NOT NULL DEFAULT false,
  min_plan_amount numeric(12,2) NOT NULL DEFAULT 0,
  min_cashout_amount numeric(12,2) NOT NULL DEFAULT 500,
  reward_hold_days integer NOT NULL DEFAULT 0 CHECK (reward_hold_days >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.referral_program_settings (
  config_key,
  is_enabled,
  first_paid_plan_only,
  allow_coupon_stack,
  min_plan_amount,
  min_cashout_amount,
  reward_hold_days
)
VALUES ('GLOBAL', false, true, false, 0, 500, 0)
ON CONFLICT (config_key) DO NOTHING;

-- 2) Plan-wise referral discount/reward rules
CREATE TABLE IF NOT EXISTS public.referral_plan_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.vendor_plans(id) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT true,

  -- Discount for referred vendor
  discount_type text NOT NULL DEFAULT 'PERCENT'
    CHECK (discount_type IN ('PERCENT', 'FLAT')),
  discount_value numeric(12,2) NOT NULL DEFAULT 0,
  discount_cap numeric(12,2),

  -- Reward for referrer vendor
  reward_type text NOT NULL DEFAULT 'PERCENT'
    CHECK (reward_type IN ('PERCENT', 'FLAT')),
  reward_value numeric(12,2) NOT NULL DEFAULT 0,
  reward_cap numeric(12,2),

  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT referral_plan_rules_unique_plan UNIQUE (plan_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_plan_rules_enabled
  ON public.referral_plan_rules(is_enabled);

-- 3) Referral profile per vendor (stores unique referral code)
CREATE TABLE IF NOT EXISTS public.vendor_referral_profiles (
  vendor_id uuid PRIMARY KEY REFERENCES public.vendors(id) ON DELETE CASCADE,
  referral_code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_referral_profiles_code
  ON public.vendor_referral_profiles(referral_code);

-- 4) Referral relation (one referred vendor maps to one referrer)
CREATE TABLE IF NOT EXISTS public.vendor_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  referred_vendor_id uuid NOT NULL UNIQUE REFERENCES public.vendors(id) ON DELETE CASCADE,
  referral_code text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'QUALIFIED', 'REWARDED', 'REJECTED')),
  qualified_payment_id uuid REFERENCES public.vendor_payments(id) ON DELETE SET NULL,
  qualified_at timestamptz,
  rewarded_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vendor_referrals_no_self_referral CHECK (referrer_vendor_id <> referred_vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_referrals_referrer
  ON public.vendor_referrals(referrer_vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_referrals_status
  ON public.vendor_referrals(status);

-- 5) Wallet per vendor (referral earnings)
CREATE TABLE IF NOT EXISTS public.vendor_referral_wallets (
  vendor_id uuid PRIMARY KEY REFERENCES public.vendors(id) ON DELETE CASCADE,
  available_balance numeric(12,2) NOT NULL DEFAULT 0,
  pending_balance numeric(12,2) NOT NULL DEFAULT 0,
  lifetime_earned numeric(12,2) NOT NULL DEFAULT 0,
  lifetime_paid_out numeric(12,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6) Immutable ledger
CREATE TABLE IF NOT EXISTS public.vendor_referral_wallet_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  referral_id uuid REFERENCES public.vendor_referrals(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.vendor_payments(id) ON DELETE SET NULL,
  cashout_request_id uuid,
  entry_type text NOT NULL CHECK (
    entry_type IN (
      'REFERRAL_REWARD_CREDIT',
      'REFERRAL_REWARD_HOLD',
      'REFERRAL_REWARD_RELEASE',
      'REFERRAL_REWARD_REVERSAL',
      'CASHOUT_DEBIT',
      'CASHOUT_REVERT'
    )
  ),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'COMPLETED'
    CHECK (status IN ('PENDING', 'COMPLETED', 'REVERSED')),
  hold_until timestamptz,
  reference_key text UNIQUE,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_referral_wallet_ledger_vendor
  ON public.vendor_referral_wallet_ledger(vendor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_referral_wallet_ledger_payment
  ON public.vendor_referral_wallet_ledger(payment_id);

-- 7) Cashout requests (manual settlement by finance/accounts)
CREATE TABLE IF NOT EXISTS public.vendor_referral_cashout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  requested_amount numeric(12,2) NOT NULL CHECK (requested_amount > 0),
  status text NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN ('REQUESTED', 'APPROVED', 'REJECTED', 'PAID', 'CANCELLED')),
  bank_detail_id uuid,
  bank_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  approved_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  paid_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  paid_at timestamptz,
  utr_number text,
  receipt_url text,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_referral_cashout_status
  ON public.vendor_referral_cashout_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_referral_cashout_vendor
  ON public.vendor_referral_cashout_requests(vendor_id, created_at DESC);

-- 8) Backlink cashout_request_id in ledger
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vendor_referral_wallet_ledger'
      AND column_name = 'cashout_request_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'vendor_referral_wallet_ledger_cashout_request_id_fkey'
        AND conrelid = 'public.vendor_referral_wallet_ledger'::regclass
    ) THEN
      ALTER TABLE public.vendor_referral_wallet_ledger
      ADD CONSTRAINT vendor_referral_wallet_ledger_cashout_request_id_fkey
      FOREIGN KEY (cashout_request_id)
      REFERENCES public.vendor_referral_cashout_requests(id)
      ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- 9) Optional metadata columns in payment records
ALTER TABLE public.vendor_payments
  ADD COLUMN IF NOT EXISTS offer_type text,
  ADD COLUMN IF NOT EXISTS offer_code text,
  ADD COLUMN IF NOT EXISTS referral_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vendor_payments_referral_id_fkey'
      AND conrelid = 'public.vendor_payments'::regclass
  ) THEN
    ALTER TABLE public.vendor_payments
      ADD CONSTRAINT vendor_payments_referral_id_fkey
      FOREIGN KEY (referral_id)
      REFERENCES public.vendor_referrals(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 10) Update trigger helper
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referral_program_settings_updated_at ON public.referral_program_settings;
CREATE TRIGGER trg_referral_program_settings_updated_at
BEFORE UPDATE ON public.referral_program_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_referral_plan_rules_updated_at ON public.referral_plan_rules;
CREATE TRIGGER trg_referral_plan_rules_updated_at
BEFORE UPDATE ON public.referral_plan_rules
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_vendor_referral_profiles_updated_at ON public.vendor_referral_profiles;
CREATE TRIGGER trg_vendor_referral_profiles_updated_at
BEFORE UPDATE ON public.vendor_referral_profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_vendor_referrals_updated_at ON public.vendor_referrals;
CREATE TRIGGER trg_vendor_referrals_updated_at
BEFORE UPDATE ON public.vendor_referrals
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_vendor_referral_cashout_requests_updated_at ON public.vendor_referral_cashout_requests;
CREATE TRIGGER trg_vendor_referral_cashout_requests_updated_at
BEFORE UPDATE ON public.vendor_referral_cashout_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 11) Seed default rules for existing plans if absent
INSERT INTO public.referral_plan_rules (
  plan_id,
  is_enabled,
  discount_type,
  discount_value,
  discount_cap,
  reward_type,
  reward_value,
  reward_cap,
  created_at,
  updated_at
)
SELECT
  vp.id,
  CASE
    WHEN upper(coalesce(vp.name, '')) = 'TRIAL' THEN false
    ELSE true
  END AS is_enabled,
  'PERCENT' AS discount_type,
  CASE
    WHEN upper(coalesce(vp.name, '')) IN ('DIAMOND', 'GOLD', 'SILVER') THEN 8
    WHEN upper(coalesce(vp.name, '')) = 'TRIAL' THEN 0
    ELSE 10
  END AS discount_value,
  CASE
    WHEN upper(coalesce(vp.name, '')) IN ('DIAMOND', 'GOLD', 'SILVER') THEN 2000
    WHEN upper(coalesce(vp.name, '')) = 'TRIAL' THEN 0
    ELSE 1000
  END AS discount_cap,
  'PERCENT' AS reward_type,
  CASE
    WHEN upper(coalesce(vp.name, '')) = 'TRIAL' THEN 0
    ELSE 10
  END AS reward_value,
  CASE
    WHEN upper(coalesce(vp.name, '')) = 'TRIAL' THEN 0
    ELSE 3000
  END AS reward_cap,
  now(),
  now()
FROM public.vendor_plans vp
ON CONFLICT (plan_id) DO NOTHING;

COMMIT;
