-- Align employee profile links with public.users, which is the canonical
-- identity source used by app sessions and profile foreign keys.

CREATE OR REPLACE FUNCTION public.itm_resolve_employee_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_email text;
  resolved_user_id uuid;
BEGIN
  normalized_email := nullif(lower(trim(coalesce(NEW.email, ''))), '');

  IF NEW.user_id IS NOT NULL THEN
    PERFORM 1
    FROM public.users
    WHERE id = NEW.user_id;

    IF FOUND THEN
      RETURN NEW;
    END IF;
  END IF;

  IF normalized_email IS NOT NULL THEN
    SELECT id
    INTO resolved_user_id
    FROM public.users
    WHERE lower(email) = normalized_email
    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    LIMIT 1;

    NEW.user_id := resolved_user_id;
  ELSE
    NEW.user_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

UPDATE public.employees e
SET user_id = u.id
FROM public.users u
WHERE lower(e.email) = lower(u.email)
  AND (e.user_id IS NULL OR e.user_id <> u.id);
