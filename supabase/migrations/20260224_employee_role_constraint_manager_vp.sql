-- Allow new internal employee roles used by territory hierarchy.
-- Safe to rerun: drops old role constraint if present, then recreates.

ALTER TABLE public.employees
DROP CONSTRAINT IF EXISTS employees_role_check;

ALTER TABLE public.employees
ADD CONSTRAINT employees_role_check
CHECK (
  role IN (
    'ADMIN',
    'HR',
    'DATA_ENTRY',
    'SUPPORT',
    'SALES',
    'MANAGER',
    'VP',
    'FINANCE',
    'SUPERADMIN'
  )
);

