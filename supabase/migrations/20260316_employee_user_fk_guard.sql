-- Employee auth-user guard
-- Prevents admin/staff employee creation from failing when route submits
-- an invalid or stale employees.user_id that is not present in auth.users.

ALTER TABLE public.employees
  ALTER COLUMN user_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.itm_resolve_employee_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  normalized_email text;
  resolved_user_id uuid;
BEGIN
  normalized_email := nullif(lower(trim(coalesce(NEW.email, ''))), '');

  IF NEW.user_id IS NOT NULL THEN
    PERFORM 1
    FROM auth.users
    WHERE id = NEW.user_id;

    IF FOUND THEN
      RETURN NEW;
    END IF;
  END IF;

  IF normalized_email IS NOT NULL THEN
    SELECT id
    INTO resolved_user_id
    FROM auth.users
    WHERE lower(email) = normalized_email
    ORDER BY created_at DESC
    LIMIT 1;

    NEW.user_id := resolved_user_id;
  ELSE
    NEW.user_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_itm_resolve_employee_user_id ON public.employees;

CREATE TRIGGER trg_itm_resolve_employee_user_id
BEFORE INSERT OR UPDATE OF user_id, email
ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.itm_resolve_employee_user_id();
