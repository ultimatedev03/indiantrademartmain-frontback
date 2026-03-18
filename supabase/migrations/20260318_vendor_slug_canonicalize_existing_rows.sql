DO $$
DECLARE
  v_vendor record;
  v_current_slug text;
  v_target_slug text;
BEGIN
  FOR v_vendor IN
    SELECT id, company_name, owner_name, email, slug
    FROM public.vendors
    ORDER BY created_at NULLS FIRST, id
  LOOP
    v_current_slug := nullif(btrim(coalesce(v_vendor.slug, '')), '');
    v_target_slug := public.build_unique_vendor_slug(
      v_vendor.id,
      v_vendor.company_name,
      v_vendor.owner_name,
      v_vendor.email
    );

    IF coalesce(v_current_slug, '') IS DISTINCT FROM v_target_slug THEN
      UPDATE public.vendors
      SET slug = v_target_slug
      WHERE id = v_vendor.id;
    END IF;
  END LOOP;
END;
$$;
