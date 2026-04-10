-- Subscription Extension Request Escalation Flow
-- SALES creates request → MANAGER forwards → VP forwards → ADMIN resolves (state-scoped)

CREATE TABLE IF NOT EXISTS public.subscription_extension_requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Vendor info
  vendor_id             UUID NOT NULL,
  vendor_name           TEXT NOT NULL,
  vendor_state          TEXT NOT NULL DEFAULT '',  -- used for admin state-scoping

  -- Request details
  reason                TEXT NOT NULL,
  extension_days        INTEGER NOT NULL CHECK (extension_days > 0 AND extension_days <= 365),

  -- Escalation chain
  current_level         TEXT NOT NULL DEFAULT 'SALES'
                        CHECK (current_level IN ('SALES', 'MANAGER', 'VP', 'ADMIN')),
  status                TEXT NOT NULL DEFAULT 'OPEN'
                        CHECK (status IN ('OPEN', 'FORWARDED', 'RESOLVED', 'REJECTED')),

  -- Notes per level
  sales_note            TEXT DEFAULT NULL,
  manager_note          TEXT DEFAULT NULL,
  vp_note               TEXT DEFAULT NULL,
  admin_note            TEXT DEFAULT NULL,

  -- Actors
  created_by_email      TEXT NOT NULL,   -- SALES employee email
  forwarded_by_manager  TEXT DEFAULT NULL,
  forwarded_by_vp       TEXT DEFAULT NULL,
  resolved_by           TEXT DEFAULT NULL,   -- ADMIN email

  -- Resolution
  extension_granted_days INTEGER DEFAULT NULL,
  resolved_at           TIMESTAMPTZ DEFAULT NULL,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_ser_vendor_id
  ON public.subscription_extension_requests (vendor_id);

CREATE INDEX IF NOT EXISTS idx_ser_status
  ON public.subscription_extension_requests (status);

CREATE INDEX IF NOT EXISTS idx_ser_current_level
  ON public.subscription_extension_requests (current_level);

CREATE INDEX IF NOT EXISTS idx_ser_vendor_state
  ON public.subscription_extension_requests (vendor_state);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_ser_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ser_updated_at ON public.subscription_extension_requests;
CREATE TRIGGER trg_ser_updated_at
  BEFORE UPDATE ON public.subscription_extension_requests
  FOR EACH ROW EXECUTE FUNCTION update_ser_updated_at();
