CREATE OR REPLACE FUNCTION public.slugify_product_name(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    NULLIF(
      trim(
        BOTH '-' FROM regexp_replace(
          regexp_replace(lower(coalesce(p_name, 'product')), '&', 'and', 'g'),
          '[^a-z0-9]+',
          '-',
          'g'
        )
      ),
      ''
    ),
    'product'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_legacy_random_product_slug(p_slug text, p_name text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_slug text := trim(lower(coalesce(p_slug, '')));
  v_base text := public.slugify_product_name(p_name);
  v_suffix text;
BEGIN
  IF v_slug = '' OR v_base = '' OR v_slug = v_base THEN
    RETURN false;
  END IF;

  IF left(v_slug, length(v_base) + 1) <> v_base || '-' THEN
    RETURN false;
  END IF;

  v_suffix := substring(v_slug from length(v_base) + 2);
  RETURN v_suffix ~ '^[a-z0-9]{6}$';
END;
$$;

CREATE OR REPLACE FUNCTION public.build_unique_product_slug(p_product_id uuid, p_name text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_base text := left(public.slugify_product_name(p_name), 100);
  v_candidate text := left(public.slugify_product_name(p_name), 100);
  v_suffix integer := 2;
  v_exists boolean;
BEGIN
  IF v_base IS NULL OR btrim(v_base) = '' THEN
    v_base := 'product';
  END IF;

  v_candidate := v_base;

  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.slug = v_candidate
        AND p.id <> p_product_id
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
  v_product record;
  v_metadata jsonb;
  v_legacy_slug text;
BEGIN
  FOR v_product IN
    SELECT id, name, slug, metadata
    FROM public.products
    WHERE slug IS NULL
       OR btrim(slug) = ''
       OR public.is_legacy_random_product_slug(slug, name)
    ORDER BY created_at NULLS FIRST, id
  LOOP
    v_metadata := coalesce(v_product.metadata, '{}'::jsonb);
    v_legacy_slug := nullif(btrim(coalesce(v_product.slug, '')), '');

    IF v_legacy_slug IS NOT NULL AND public.is_legacy_random_product_slug(v_legacy_slug, v_product.name) THEN
      v_metadata := jsonb_set(v_metadata, '{legacy_slug}', to_jsonb(v_legacy_slug), true);
    END IF;

    UPDATE public.products
    SET slug = public.build_unique_product_slug(v_product.id, v_product.name),
        metadata = v_metadata
    WHERE id = v_product.id;
  END LOOP;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_products_legacy_slug
  ON public.products ((metadata->>'legacy_slug'));
