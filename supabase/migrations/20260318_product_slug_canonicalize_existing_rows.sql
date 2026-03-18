CREATE OR REPLACE FUNCTION public.merge_product_slug_aliases(
  p_metadata jsonb,
  p_current_slug text,
  p_next_slug text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_current_slug text := nullif(btrim(coalesce(p_current_slug, '')), '');
  v_next_slug text := nullif(btrim(coalesce(p_next_slug, '')), '');
  v_aliases text[];
BEGIN
  SELECT coalesce(array_agg(value ORDER BY first_ord), ARRAY[]::text[])
  INTO v_aliases
  FROM (
    SELECT value, min(ord) AS first_ord
    FROM (
      SELECT nullif(btrim(v_current_slug), '') AS value, 0 AS ord
      UNION ALL
      SELECT nullif(btrim(v_metadata->>'legacy_slug'), ''), 1
      UNION ALL
      SELECT nullif(btrim(legacy_alias.alias_value), ''), 1 + legacy_alias.alias_ord::integer
      FROM jsonb_array_elements_text(coalesce(v_metadata->'legacy_slugs', '[]'::jsonb))
        WITH ORDINALITY AS legacy_alias(alias_value, alias_ord)
    ) AS candidates
    WHERE value IS NOT NULL
      AND (v_next_slug IS NULL OR value <> v_next_slug)
    GROUP BY value
  ) AS dedup;

  v_metadata := v_metadata - 'legacy_slug' - 'legacy_slugs';

  IF coalesce(array_length(v_aliases, 1), 0) > 0 THEN
    v_metadata := jsonb_set(v_metadata, '{legacy_slug}', to_jsonb(v_aliases[1]), true);
    v_metadata := jsonb_set(v_metadata, '{legacy_slugs}', to_jsonb(v_aliases), true);
  END IF;

  RETURN v_metadata;
END;
$$;

DO $$
DECLARE
  v_product record;
  v_current_slug text;
  v_target_slug text;
  v_existing_metadata jsonb;
  v_next_metadata jsonb;
BEGIN
  FOR v_product IN
    SELECT id, name, slug, metadata
    FROM public.products
    ORDER BY created_at NULLS FIRST, id
  LOOP
    v_current_slug := nullif(btrim(coalesce(v_product.slug, '')), '');
    v_existing_metadata := coalesce(v_product.metadata, '{}'::jsonb);
    v_target_slug := public.build_unique_product_slug(v_product.id, v_product.name);
    v_next_metadata := public.merge_product_slug_aliases(
      v_existing_metadata,
      v_current_slug,
      v_target_slug
    );

    IF coalesce(v_current_slug, '') IS DISTINCT FROM v_target_slug
       OR v_existing_metadata IS DISTINCT FROM v_next_metadata THEN
      UPDATE public.products
      SET slug = v_target_slug,
          metadata = v_next_metadata
      WHERE id = v_product.id;
    END IF;
  END LOOP;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_products_metadata_gin
  ON public.products
  USING gin (metadata jsonb_path_ops);
