-- Data Entry location hierarchy access (State -> City -> Division -> Pincode)
-- Safe to rerun.

-- Optional: keep table grants explicit for authenticated users.
GRANT SELECT ON public.states TO authenticated, anon;
GRANT SELECT ON public.cities TO authenticated, anon;
GRANT SELECT ON public.geo_divisions TO authenticated, anon;
GRANT SELECT ON public.geo_division_pincodes TO authenticated, anon;

GRANT INSERT, UPDATE, DELETE ON public.states TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.cities TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.geo_divisions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.geo_division_pincodes TO authenticated;

-- If RLS is enabled, these policies allow DATA_ENTRY/ADMIN/SUPERADMIN writes.
-- If RLS is disabled, these policies are harmless.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'states' AND policyname = 'states_select_public') THEN
    DROP POLICY states_select_public ON public.states;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'states' AND policyname = 'states_write_data_entry') THEN
    DROP POLICY states_write_data_entry ON public.states;
  END IF;
END $$;

CREATE POLICY states_select_public
ON public.states
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY states_write_data_entry
ON public.states
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.user_id = auth.uid()
      AND upper(coalesce(e.status, 'ACTIVE')) = 'ACTIVE'
      AND upper(coalesce(e.role, '')) IN ('DATA_ENTRY', 'DATAENTRY', 'ADMIN', 'SUPERADMIN')
  )
  OR upper(coalesce(auth.jwt() ->> 'role', '')) = 'SUPERADMIN'
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.user_id = auth.uid()
      AND upper(coalesce(e.status, 'ACTIVE')) = 'ACTIVE'
      AND upper(coalesce(e.role, '')) IN ('DATA_ENTRY', 'DATAENTRY', 'ADMIN', 'SUPERADMIN')
  )
  OR upper(coalesce(auth.jwt() ->> 'role', '')) = 'SUPERADMIN'
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cities' AND policyname = 'cities_select_public') THEN
    DROP POLICY cities_select_public ON public.cities;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cities' AND policyname = 'cities_write_data_entry') THEN
    DROP POLICY cities_write_data_entry ON public.cities;
  END IF;
END $$;

CREATE POLICY cities_select_public
ON public.cities
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY cities_write_data_entry
ON public.cities
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.user_id = auth.uid()
      AND upper(coalesce(e.status, 'ACTIVE')) = 'ACTIVE'
      AND upper(coalesce(e.role, '')) IN ('DATA_ENTRY', 'DATAENTRY', 'ADMIN', 'SUPERADMIN')
  )
  OR upper(coalesce(auth.jwt() ->> 'role', '')) = 'SUPERADMIN'
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.user_id = auth.uid()
      AND upper(coalesce(e.status, 'ACTIVE')) = 'ACTIVE'
      AND upper(coalesce(e.role, '')) IN ('DATA_ENTRY', 'DATAENTRY', 'ADMIN', 'SUPERADMIN')
  )
  OR upper(coalesce(auth.jwt() ->> 'role', '')) = 'SUPERADMIN'
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'geo_divisions' AND policyname = 'geo_divisions_select_public') THEN
    DROP POLICY geo_divisions_select_public ON public.geo_divisions;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'geo_divisions' AND policyname = 'geo_divisions_write_data_entry') THEN
    DROP POLICY geo_divisions_write_data_entry ON public.geo_divisions;
  END IF;
END $$;

CREATE POLICY geo_divisions_select_public
ON public.geo_divisions
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY geo_divisions_write_data_entry
ON public.geo_divisions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.user_id = auth.uid()
      AND upper(coalesce(e.status, 'ACTIVE')) = 'ACTIVE'
      AND upper(coalesce(e.role, '')) IN ('DATA_ENTRY', 'DATAENTRY', 'ADMIN', 'SUPERADMIN')
  )
  OR upper(coalesce(auth.jwt() ->> 'role', '')) = 'SUPERADMIN'
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.user_id = auth.uid()
      AND upper(coalesce(e.status, 'ACTIVE')) = 'ACTIVE'
      AND upper(coalesce(e.role, '')) IN ('DATA_ENTRY', 'DATAENTRY', 'ADMIN', 'SUPERADMIN')
  )
  OR upper(coalesce(auth.jwt() ->> 'role', '')) = 'SUPERADMIN'
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'geo_division_pincodes' AND policyname = 'geo_division_pincodes_select_public') THEN
    DROP POLICY geo_division_pincodes_select_public ON public.geo_division_pincodes;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'geo_division_pincodes' AND policyname = 'geo_division_pincodes_write_data_entry') THEN
    DROP POLICY geo_division_pincodes_write_data_entry ON public.geo_division_pincodes;
  END IF;
END $$;

CREATE POLICY geo_division_pincodes_select_public
ON public.geo_division_pincodes
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY geo_division_pincodes_write_data_entry
ON public.geo_division_pincodes
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.user_id = auth.uid()
      AND upper(coalesce(e.status, 'ACTIVE')) = 'ACTIVE'
      AND upper(coalesce(e.role, '')) IN ('DATA_ENTRY', 'DATAENTRY', 'ADMIN', 'SUPERADMIN')
  )
  OR upper(coalesce(auth.jwt() ->> 'role', '')) = 'SUPERADMIN'
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.user_id = auth.uid()
      AND upper(coalesce(e.status, 'ACTIVE')) = 'ACTIVE'
      AND upper(coalesce(e.role, '')) IN ('DATA_ENTRY', 'DATAENTRY', 'ADMIN', 'SUPERADMIN')
  )
  OR upper(coalesce(auth.jwt() ->> 'role', '')) = 'SUPERADMIN'
);
