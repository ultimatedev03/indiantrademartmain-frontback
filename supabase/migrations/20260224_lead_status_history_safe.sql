-- Vendor lead lifecycle history (safe-mode, additive)
-- Date: 24-Feb-2026
-- Notes:
-- - Non-destructive: creates new table/indexes/checks only.
-- - Keeps existing lead_purchases + lead data intact.
-- - Backfills one initial status event for existing purchases (idempotent).

CREATE TABLE IF NOT EXISTS public.lead_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  lead_purchase_id uuid NULL REFERENCES public.lead_purchases(id) ON DELETE SET NULL,
  status text NOT NULL,
  note text NULL,
  source text NOT NULL DEFAULT 'MANUAL',
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lead_status_history_status_check'
      AND conrelid = 'public.lead_status_history'::regclass
  ) THEN
    ALTER TABLE public.lead_status_history
      ADD CONSTRAINT lead_status_history_status_check
      CHECK (status IN ('ACTIVE', 'VIEWED', 'CLOSED'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lead_status_history_source_check'
      AND conrelid = 'public.lead_status_history'::regclass
  ) THEN
    ALTER TABLE public.lead_status_history
      ADD CONSTRAINT lead_status_history_source_check
      CHECK (source IN ('MANUAL', 'PURCHASE', 'DIRECT', 'SYSTEM'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_lead_status_history_vendor_created
  ON public.lead_status_history (vendor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_status_history_lead_vendor
  ON public.lead_status_history (lead_id, vendor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_status_history_purchase
  ON public.lead_status_history (lead_purchase_id)
  WHERE lead_purchase_id IS NOT NULL;

INSERT INTO public.lead_status_history (
  lead_id,
  vendor_id,
  lead_purchase_id,
  status,
  note,
  source,
  created_by,
  created_at
)
SELECT
  lp.lead_id,
  lp.vendor_id,
  lp.id,
  CASE
    WHEN UPPER(COALESCE(TRIM(lp.lead_status), '')) IN ('ACTIVE', 'VIEWED', 'CLOSED')
      THEN UPPER(TRIM(lp.lead_status))
    ELSE 'ACTIVE'
  END AS status,
  'Initial lifecycle state',
  'SYSTEM',
  NULL,
  COALESCE(lp.purchase_datetime, lp.purchase_date, lp.updated_at, now())
FROM public.lead_purchases lp
WHERE lp.lead_id IS NOT NULL
  AND lp.vendor_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.lead_status_history h
    WHERE h.lead_purchase_id = lp.id
      AND h.source = 'SYSTEM'
  );
