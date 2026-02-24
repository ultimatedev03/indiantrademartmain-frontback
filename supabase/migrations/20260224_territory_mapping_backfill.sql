-- Territory mapping backfill:
-- 1) Fix missing state mapping (Dadra and Nagar Haveli and Daman and Diu)
-- 2) Create missing city master rows from geo_divisions.district_name
-- 3) Backfill geo_divisions.city_id (state+district normalized match)
-- 4) Backfill vendor_division_map by city (best-fit division)
-- 5) Create fallback geo_divisions for uncovered state+city vendor clusters
-- 6) Fill remaining vendor_division_map rows using city-first/state fallback

BEGIN;

-- 1) Ensure missing state exists
INSERT INTO public.states (name, slug, is_active, created_at, updated_at)
SELECT
  'Dadra and Nagar Haveli and Daman and Diu',
  'dadra-and-nagar-haveli-and-daman-and-diu',
  true,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1
  FROM public.states s
  WHERE lower(coalesce(s.slug, '')) = 'dadra-and-nagar-haveli-and-daman-and-diu'
     OR lower(coalesce(s.name, '')) = 'dadra and nagar haveli and daman and diu'
);

-- 1b) Attach state_id for existing null-state divisions from imported file
UPDATE public.geo_divisions g
SET state_id = s.id,
    updated_at = now()
FROM public.states s
WHERE g.state_id IS NULL
  AND s.slug = 'dadra-and-nagar-haveli-and-daman-and-diu'
  AND g.division_key LIKE 'dadra and nagar haveli and daman and diu::%';

-- 2) Insert missing cities using district_name (normalized dedupe by state)
WITH candidate_cities AS (
  SELECT DISTINCT
    g.state_id,
    trim(g.district_name) AS city_name
  FROM public.geo_divisions g
  WHERE g.state_id IS NOT NULL
    AND g.city_id IS NULL
    AND nullif(trim(g.district_name), '') IS NOT NULL
),
existing_city_norm AS (
  SELECT
    c.id,
    c.state_id,
    regexp_replace(
      lower(trim(replace(coalesce(c.name, ''), '&', 'and'))),
      '[^a-z0-9]+',
      ' ',
      'g'
    ) AS norm_name
  FROM public.cities c
)
INSERT INTO public.cities (
  state_id,
  name,
  slug,
  is_active,
  created_at,
  updated_at,
  supplier_count
)
SELECT
  cc.state_id,
  cc.city_name,
  trim(
    both '-'
    FROM regexp_replace(
      concat(
        coalesce(s.slug, 'state'),
        '-',
        regexp_replace(
          lower(replace(cc.city_name, '&', 'and')),
          '[^a-z0-9]+',
          '-',
          'g'
        )
      ),
      '-+',
      '-',
      'g'
    )
  ) AS slug,
  true,
  now(),
  now(),
  0
FROM candidate_cities cc
JOIN public.states s
  ON s.id = cc.state_id
LEFT JOIN existing_city_norm e
  ON e.state_id = cc.state_id
 AND e.norm_name = regexp_replace(
      lower(trim(replace(cc.city_name, '&', 'and'))),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
WHERE e.id IS NULL
ON CONFLICT DO NOTHING;

-- 3) Backfill geo_divisions.city_id from cities (state + district_name normalized)
WITH city_norm AS (
  SELECT
    c.id,
    c.state_id,
    regexp_replace(
      lower(trim(replace(coalesce(c.name, ''), '&', 'and'))),
      '[^a-z0-9]+',
      ' ',
      'g'
    ) AS norm_name
  FROM public.cities c
),
division_norm AS (
  SELECT
    g.id,
    g.state_id,
    regexp_replace(
      lower(trim(replace(coalesce(g.district_name, ''), '&', 'and'))),
      '[^a-z0-9]+',
      ' ',
      'g'
    ) AS norm_name
  FROM public.geo_divisions g
  WHERE g.city_id IS NULL
    AND g.state_id IS NOT NULL
    AND nullif(trim(g.district_name), '') IS NOT NULL
),
matched AS (
  SELECT
    x.division_id,
    x.city_id
  FROM (
    SELECT
      d.id AS division_id,
      c.id AS city_id,
      row_number() OVER (PARTITION BY d.id ORDER BY c.id) AS rn
    FROM division_norm d
    JOIN city_norm c
      ON c.state_id = d.state_id
     AND c.norm_name = d.norm_name
  ) x
  WHERE x.rn = 1
)
UPDATE public.geo_divisions g
SET city_id = m.city_id,
    updated_at = now()
FROM matched m
WHERE g.id = m.division_id
  AND g.city_id IS NULL;

-- 4) Optional: map vendors to a division by city if missing
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
  null AS mapped_by_user_id,
  'AUTO_CITY_DISTRICT' AS mapping_source,
  0.75 AS confidence,
  now() AS created_at,
  now() AS updated_at
FROM public.vendors v
JOIN LATERAL (
  SELECT gd.id
  FROM public.geo_divisions gd
  WHERE gd.is_active = true
    AND gd.city_id = v.city_id
  ORDER BY gd.pincode_count DESC, gd.created_at ASC
  LIMIT 1
) AS best_div ON true
LEFT JOIN public.vendor_division_map vm
  ON vm.vendor_id = v.id
WHERE vm.vendor_id IS NULL
  AND v.city_id IS NOT NULL
  AND coalesce(v.is_active, true) = true
ON CONFLICT (vendor_id) DO UPDATE
SET division_id = excluded.division_id,
    mapping_source = excluded.mapping_source,
    confidence = excluded.confidence,
    updated_at = now();

-- 5) Create synthetic fallback divisions where active vendor state+city has no division
WITH uncovered_state_city AS (
  SELECT
    v.state_id,
    v.city_id,
    count(*)::int AS vendor_count
  FROM public.vendors v
  LEFT JOIN LATERAL (
    SELECT gd.id
    FROM public.geo_divisions gd
    WHERE gd.is_active = true
      AND gd.state_id = v.state_id
      AND gd.city_id = v.city_id
    LIMIT 1
  ) has_div ON true
  WHERE coalesce(v.is_active, true) = true
    AND v.state_id IS NOT NULL
    AND v.city_id IS NOT NULL
    AND has_div.id IS NULL
  GROUP BY v.state_id, v.city_id
),
city_state AS (
  SELECT
    usc.state_id,
    usc.city_id,
    usc.vendor_count,
    c.name AS city_name,
    s.slug AS state_slug
  FROM uncovered_state_city usc
  JOIN public.cities c
    ON c.id = usc.city_id
  JOIN public.states s
    ON s.id = usc.state_id
)
INSERT INTO public.geo_divisions (
  division_key,
  state_id,
  city_id,
  name,
  slug,
  district_name,
  subdistrict_name,
  pincode_count,
  is_active,
  created_at,
  updated_at
)
SELECT
  concat(cs.state_id::text, '::', cs.city_id::text, '::auto-general') AS division_key,
  cs.state_id,
  cs.city_id,
  concat(cs.city_name, ' General Division') AS name,
  trim(
    both '-'
    FROM regexp_replace(
      lower(replace(concat(coalesce(cs.state_slug, 'state'), '-', cs.city_name, '-general-division'), '&', 'and')),
      '[^a-z0-9]+',
      '-',
      'g'
    )
  ) AS slug,
  cs.city_name AS district_name,
  'General' AS subdistrict_name,
  0 AS pincode_count,
  true AS is_active,
  now(),
  now()
FROM city_state cs
ON CONFLICT (division_key) DO UPDATE
SET is_active = true,
    updated_at = now();

-- 6) Fill any remaining vendor mappings using state-level fallback (prefers same city)
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
  null AS mapped_by_user_id,
  'AUTO_STATE_FALLBACK' AS mapping_source,
  0.60 AS confidence,
  now() AS created_at,
  now() AS updated_at
FROM public.vendors v
JOIN LATERAL (
  SELECT gd.id
  FROM public.geo_divisions gd
  WHERE gd.is_active = true
    AND gd.state_id = v.state_id
  ORDER BY
    CASE WHEN gd.city_id = v.city_id THEN 0 ELSE 1 END,
    gd.pincode_count DESC,
    gd.created_at ASC
  LIMIT 1
) AS best_div ON true
LEFT JOIN public.vendor_division_map vm
  ON vm.vendor_id = v.id
WHERE vm.vendor_id IS NULL
  AND coalesce(v.is_active, true) = true
  AND v.state_id IS NOT NULL
  AND v.city_id IS NOT NULL
ON CONFLICT (vendor_id) DO NOTHING;

COMMIT;
