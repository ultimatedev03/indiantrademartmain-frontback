BEGIN;

CREATE TABLE IF NOT EXISTS public.regions (
  code text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.regions IS
  'Canonical business regions used by superadmin monitoring and state grouping.';

INSERT INTO public.regions (code, name, sort_order, is_active)
VALUES
  ('NORTH', 'North', 10, true),
  ('WEST', 'West', 20, true),
  ('SOUTH', 'South', 30, true),
  ('EAST', 'East', 40, true),
  ('CENTRAL', 'Central', 50, true),
  ('UNASSIGNED', 'Unassigned', 999, true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    updated_at = now();

ALTER TABLE public.states
  ADD COLUMN IF NOT EXISTS region_code text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'states'
      AND constraint_name = 'states_region_code_fkey'
  ) THEN
    ALTER TABLE public.states
      ADD CONSTRAINT states_region_code_fkey
      FOREIGN KEY (region_code) REFERENCES public.regions(code)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_states_region_code
  ON public.states (region_code);

COMMENT ON COLUMN public.states.region_code IS
  'Canonical business region code for superadmin monitoring and geographic rollups.';

WITH state_region(state_name, region_code) AS (
  VALUES
    ('Andaman and Nicobar Islands', 'SOUTH'),
    ('Andhra Pradesh', 'SOUTH'),
    ('Arunachal Pradesh', 'EAST'),
    ('Assam', 'EAST'),
    ('Bihar', 'EAST'),
    ('Chandigarh', 'NORTH'),
    ('Chhattisgarh', 'CENTRAL'),
    ('Dadra and Nagar Haveli and Daman and Diu', 'WEST'),
    ('Delhi', 'NORTH'),
    ('Goa', 'WEST'),
    ('Gujarat', 'WEST'),
    ('Haryana', 'NORTH'),
    ('Himachal Pradesh', 'NORTH'),
    ('Jammu and Kashmir', 'NORTH'),
    ('Jharkhand', 'EAST'),
    ('Karnataka', 'SOUTH'),
    ('Kerala', 'SOUTH'),
    ('Ladakh', 'NORTH'),
    ('Lakshadweep', 'SOUTH'),
    ('Madhya Pradesh', 'CENTRAL'),
    ('Maharashtra', 'WEST'),
    ('Manipur', 'EAST'),
    ('Meghalaya', 'EAST'),
    ('Mizoram', 'EAST'),
    ('Nagaland', 'EAST'),
    ('Odisha', 'EAST'),
    ('Puducherry', 'SOUTH'),
    ('Punjab', 'NORTH'),
    ('Rajasthan', 'WEST'),
    ('Sikkim', 'EAST'),
    ('Tamil Nadu', 'SOUTH'),
    ('Telangana', 'SOUTH'),
    ('Tripura', 'EAST'),
    ('Uttar Pradesh', 'NORTH'),
    ('Uttarakhand', 'NORTH'),
    ('West Bengal', 'EAST')
)
UPDATE public.states s
SET region_code = sr.region_code,
    updated_at = now()
FROM state_region sr
WHERE lower(s.name) = lower(sr.state_name)
  AND coalesce(s.region_code, '') <> sr.region_code;

UPDATE public.states
SET region_code = 'UNASSIGNED',
    updated_at = now()
WHERE region_code IS NULL;

CREATE TABLE IF NOT EXISTS public.employee_state_scope (
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  state_id uuid NOT NULL REFERENCES public.states(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (employee_id, state_id)
);

COMMENT ON TABLE public.employee_state_scope IS
  'Canonical ADMIN state scope using foreign keys to states instead of free-text names.';

CREATE INDEX IF NOT EXISTS idx_employee_state_scope_state_id
  ON public.employee_state_scope (state_id);

INSERT INTO public.employee_state_scope (employee_id, state_id, created_at, updated_at)
SELECT DISTINCT
  e.id AS employee_id,
  s.id AS state_id,
  now() AS created_at,
  now() AS updated_at
FROM public.employees e
CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(e.states_scope, '[]'::jsonb)) AS scope_item(state_name)
JOIN public.states s
  ON lower(trim(s.name)) = lower(trim(scope_item.state_name))
ON CONFLICT (employee_id, state_id) DO UPDATE
SET updated_at = now();

WITH canonical_scope AS (
  SELECT
    ess.employee_id,
    jsonb_agg(s.name ORDER BY s.name) AS state_names
  FROM public.employee_state_scope ess
  JOIN public.states s
    ON s.id = ess.state_id
  GROUP BY ess.employee_id
)
UPDATE public.employees e
SET states_scope = coalesce(cs.state_names, '[]'::jsonb),
    updated_at = now()
FROM canonical_scope cs
WHERE e.id = cs.employee_id
  AND coalesce(e.states_scope, '[]'::jsonb) <> coalesce(cs.state_names, '[]'::jsonb);

CREATE OR REPLACE FUNCTION public.sync_vendor_division_map_from_vendor()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  resolved_division_id uuid;
  resolved_mapping_source text;
  resolved_confidence numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.vendor_division_map
    WHERE vendor_id = OLD.id;
    RETURN OLD;
  END IF;

  resolved_division_id := NULL;
  resolved_mapping_source := NULL;
  resolved_confidence := NULL;

  IF NEW.city_id IS NOT NULL THEN
    SELECT gd.id
    INTO resolved_division_id
    FROM public.geo_divisions gd
    WHERE coalesce(gd.is_active, true) = true
      AND gd.city_id = NEW.city_id
    ORDER BY gd.pincode_count DESC NULLS LAST, gd.created_at ASC NULLS LAST, gd.id ASC
    LIMIT 1;

    IF resolved_division_id IS NOT NULL THEN
      resolved_mapping_source := 'AUTO_CITY_DISTRICT';
      resolved_confidence := 0.75;
    END IF;
  END IF;

  IF resolved_division_id IS NULL AND NEW.state_id IS NOT NULL THEN
    SELECT gd.id
    INTO resolved_division_id
    FROM public.geo_divisions gd
    WHERE coalesce(gd.is_active, true) = true
      AND gd.state_id = NEW.state_id
    ORDER BY
      CASE WHEN gd.city_id = NEW.city_id THEN 0 ELSE 1 END,
      gd.pincode_count DESC NULLS LAST,
      gd.created_at ASC NULLS LAST,
      gd.id ASC
    LIMIT 1;

    IF resolved_division_id IS NOT NULL THEN
      resolved_mapping_source := 'AUTO_STATE_FALLBACK';
      resolved_confidence := 0.60;
    END IF;
  END IF;

  IF resolved_division_id IS NULL THEN
    DELETE FROM public.vendor_division_map
    WHERE vendor_id = NEW.id;
    RETURN NEW;
  END IF;

  INSERT INTO public.vendor_division_map (
    vendor_id,
    division_id,
    mapped_by_user_id,
    mapping_source,
    confidence,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    resolved_division_id,
    NULL,
    resolved_mapping_source,
    resolved_confidence,
    now(),
    now()
  )
  ON CONFLICT (vendor_id) DO UPDATE
  SET division_id = EXCLUDED.division_id,
      mapping_source = EXCLUDED.mapping_source,
      confidence = EXCLUDED.confidence,
      updated_at = now();

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_sync_vendor_division_map_from_vendor'
      AND tgrelid = 'public.vendors'::regclass
  ) THEN
    CREATE TRIGGER trg_sync_vendor_division_map_from_vendor
    AFTER INSERT OR UPDATE OF state_id, city_id, is_active
    ON public.vendors
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_vendor_division_map_from_vendor();
  END IF;
END $$;

INSERT INTO public.vendor_division_map (
  vendor_id,
  division_id,
  mapped_by_user_id,
  mapping_source,
  confidence,
  created_at,
  updated_at
)
SELECT
  v.id AS vendor_id,
  best_div.id AS division_id,
  NULL AS mapped_by_user_id,
  'AUTO_CITY_DISTRICT' AS mapping_source,
  0.75 AS confidence,
  now() AS created_at,
  now() AS updated_at
FROM public.vendors v
JOIN LATERAL (
  SELECT gd.id
  FROM public.geo_divisions gd
  WHERE coalesce(gd.is_active, true) = true
    AND gd.city_id = v.city_id
  ORDER BY gd.pincode_count DESC NULLS LAST, gd.created_at ASC NULLS LAST, gd.id ASC
  LIMIT 1
) AS best_div ON true
LEFT JOIN public.vendor_division_map vm
  ON vm.vendor_id = v.id
WHERE vm.vendor_id IS NULL
  AND v.city_id IS NOT NULL
ON CONFLICT (vendor_id) DO UPDATE
SET division_id = EXCLUDED.division_id,
    mapping_source = EXCLUDED.mapping_source,
    confidence = EXCLUDED.confidence,
    updated_at = now();

INSERT INTO public.vendor_division_map (
  vendor_id,
  division_id,
  mapped_by_user_id,
  mapping_source,
  confidence,
  created_at,
  updated_at
)
SELECT
  v.id AS vendor_id,
  best_div.id AS division_id,
  NULL AS mapped_by_user_id,
  'AUTO_STATE_FALLBACK' AS mapping_source,
  0.60 AS confidence,
  now() AS created_at,
  now() AS updated_at
FROM public.vendors v
JOIN LATERAL (
  SELECT gd.id
  FROM public.geo_divisions gd
  WHERE coalesce(gd.is_active, true) = true
    AND gd.state_id = v.state_id
  ORDER BY
    CASE WHEN gd.city_id = v.city_id THEN 0 ELSE 1 END,
    gd.pincode_count DESC NULLS LAST,
    gd.created_at ASC NULLS LAST,
    gd.id ASC
  LIMIT 1
) AS best_div ON true
LEFT JOIN public.vendor_division_map vm
  ON vm.vendor_id = v.id
WHERE vm.vendor_id IS NULL
  AND v.state_id IS NOT NULL
ON CONFLICT (vendor_id) DO UPDATE
SET division_id = EXCLUDED.division_id,
    mapping_source = EXCLUDED.mapping_source,
    confidence = EXCLUDED.confidence,
    updated_at = now();

COMMIT;
