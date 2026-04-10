-- Coupon Approval Flow
-- FINANCE creates coupons in PENDING_APPROVAL state; ADMIN approves or rejects.
-- Existing coupons are treated as APPROVED (backward-compatible default).

ALTER TABLE public.vendor_plan_coupons
  ADD COLUMN IF NOT EXISTS approval_status  TEXT    NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS approved_by      TEXT    DEFAULT NULL,  -- employee email
  ADD COLUMN IF NOT EXISTS approved_at      TIMESTAMPTZ DEFAULT NULL;

-- Index for fast pending lookup
CREATE INDEX IF NOT EXISTS idx_vpc_approval_status
  ON public.vendor_plan_coupons (approval_status);

-- Add check constraint so only valid values are stored
ALTER TABLE public.vendor_plan_coupons
  DROP CONSTRAINT IF EXISTS chk_vpc_approval_status;

ALTER TABLE public.vendor_plan_coupons
  ADD CONSTRAINT chk_vpc_approval_status
  CHECK (approval_status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED'));
