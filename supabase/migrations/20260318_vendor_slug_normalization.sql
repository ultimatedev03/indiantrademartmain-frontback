ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS slug text;

CREATE OR REPLACE FUNCTION public.slugify_vendor_name(
  p_company_name text,
  p_owner_name text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    NULLIF(
      trim(
        BOTH '-' FROM regexp_replace(
          regexp_replace(
            lower(
              coalesce(
                nullif(btrim(p_company_name), ''),
                nullif(btrim(p_owner_name), ''),
                nullif(split_part(coalesce(p_email, ''), '@', 1), ''),
                'vendor'
              )
            ),
            '&',
            'and',
            'g'
          ),
          '[^a-z0-9]+',
          '-',
          'g'
        )
      ),
      ''
    ),
    'vendor'
  );
$$;

CREATE OR REPLACE FUNCTION public.build_unique_vendor_slug(
  p_vendor_id uuid,
  p_company_name text,
  p_owner_name text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_base text := left(public.slugify_vendor_name(p_company_name, p_owner_name, p_email), 100);
  v_candidate text := left(public.slugify_vendor_name(p_company_name, p_owner_name, p_email), 100);
  v_suffix integer := 2;
  v_exists boolean;
BEGIN
  IF v_base IS NULL OR btrim(v_base) = '' THEN
    v_base := 'vendor';
  END IF;

  v_candidate := v_base;

  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM public.vendors v
      WHERE v.slug = v_candidate
        AND v.id <> p_vendor_id
    )
    INTO v_exists;

    EXIT WHEN NOT v_exists;

    v_candidate := left(v_base, greatest(1, 100 - length(v_suffix::text) - 1)) || '-' || v_suffix::text;
    v_suffix := v_suffix + 1;
  END LOOP;

  RETURN v_candidate;
END;
$$;

DO $$
DECLARE
  v_vendor record;
BEGIN
  FOR v_vendor IN
    SELECT id, company_name, owner_name, email, slug
    FROM public.vendors
    WHERE slug IS NULL
       OR btrim(slug) = ''
       OR lower(btrim(slug)) = lower(id::text)
    ORDER BY created_at NULLS FIRST, id
  LOOP
    UPDATE public.vendors
    SET slug = public.build_unique_vendor_slug(
      v_vendor.id,
      v_vendor.company_name,
      v_vendor.owner_name,
      v_vendor.email
    )
    WHERE id = v_vendor.id;
  END LOOP;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_slug_unique
  ON public.vendors (slug)
  WHERE slug IS NOT NULL AND btrim(slug) <> '';
